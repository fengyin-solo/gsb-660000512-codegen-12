import type {
  Problem,
  SyncConflict,
  PermissionIssue,
  PendingSyncSummary,
  ConflictResolution,
} from '../types';
import {
  getPendingOps,
  clearPendingOps,
  getServerBaseline,
  hashProblem,
  overwriteLocalProblem,
  removeLocalProblem,
  type PendingOp,
} from './mockProblemService';
import { getPermission, preserveOwnership } from './permissionService';
import type { User } from '../types';

/**
 * 恢复连接后的同步协调器。
 *
 * 流程（严格按需求顺序）：
 *  1. 拉取服务端最新记录
 *  2. 先汇总「授权问题」（本地改动者已不是负责人/协作者）
 *  3. 再汇总「冲突项」（同一记录双方都改了，且内容不同）
 *  4. 冲突记录不能覆盖，弹窗逐条选择：保留本地 / 采用服务端 / 跳过
 *  5. 归属始终保持不变（preserveOwnership）
 */

export function buildSyncSummary(remoteProblems: Problem[], currentUser: User): PendingSyncSummary {
  const ops = getPendingOps();
  const baseline = getServerBaseline();
  const remoteById = new Map(remoteProblems.map(p => [p.id, p]));

  const conflicts: SyncConflict[] = [];
  const permissionIssues: PermissionIssue[] = [];
  const clean: Problem[] = [];

  // 同一记录可能有多条操作，以最后一条为准进行判断
  const latestOpByProblem = new Map<string, PendingOp>();
  ops.forEach(op => latestOpByProblem.set(op.problemId, op));

  latestOpByProblem.forEach((op) => {
    const remote = remoteById.get(op.problemId);

    // ---- 授权问题优先判断（以服务端最新归属/协作者为准，反映“当前”权限） ----
    const targetForPermission = remote || op.payload;
    if (targetForPermission) {
      const perm = getPermission(targetForPermission, currentUser);
      if (op.type !== 'create' && perm === 'viewer') {
        permissionIssues.push({
          problemId: op.problemId,
          problemTitle: op.problemTitle,
          ownerId: targetForPermission.ownerId || targetForPermission.createdBy || 'unknown',
          ownerName: targetForPermission.ownerName || targetForPermission.ownerId || '未知',
          reason:
            `您（${currentUser.name}）在离线期间${opLabel(op.type)}了该记录，` +
            `但当前仅具有查看权限（负责人：${targetForPermission.ownerName || targetForPermission.ownerId}）。`,
        });
        return;
      }
    }

    // ---- 新建记录：服务端不存在，视为可直接同步（保持本地归属） ----
    if (op.type === 'create') {
      if (!remote && op.payload) {
        clean.push(op.payload);
      }
      // 若服务端已存在同 id（极小概率），按冲突处理
      else if (remote && op.payload && hashProblem(remote) !== hashProblem(op.payload)) {
        conflicts.push({
          problemId: op.problemId,
          problemTitle: op.problemTitle,
          local: op.payload,
          remote,
          baseVersion: baseline[op.problemId],
        });
      }
      return;
    }

    // ---- 删除：服务端记录若已被他人修改，提示冲突，避免误删 ----
    if (op.type === 'delete') {
      if (remote) {
        const baseVersion = baseline[op.problemId];
        const remoteChanged = !baseVersion || remote.updatedAt !== baseVersion;
        if (remoteChanged) {
          conflicts.push({
            problemId: op.problemId,
            problemTitle: op.problemTitle,
            local: { ...remote, __deleted: true } as unknown as Problem,
            remote,
            baseVersion,
          });
        } else {
          clean.push({ ...remote, __deleted: true } as unknown as Problem);
        }
      }
      // 服务端已不存在则删除自然达成，无需处理
      return;
    }

    // ---- 更新：冲突检测 ----
    if (op.type === 'update' && op.payload) {
      const local = op.payload;
      if (!remote) {
        // 记录在服务端已被删除
        conflicts.push({
          problemId: op.problemId,
          problemTitle: op.problemTitle,
          local,
          remote: { ...local, __deleted: true } as unknown as Problem,
          baseVersion: baseline[op.problemId],
        });
        return;
      }

      const baseVersion = baseline[op.problemId];
      const remoteChanged = !baseVersion || remote.updatedAt !== baseVersion;
      const contentDifferent = hashProblem(remote) !== hashProblem(local);

      if (remoteChanged && contentDifferent) {
        // 双方都改了 → 冲突，不能覆盖
        conflicts.push({
          problemId: op.problemId,
          problemTitle: op.problemTitle,
          local,
          remote,
          baseVersion,
        });
      } else if (!remoteChanged) {
        // 只有本地改动 → 可干净同步
        clean.push(local);
      }
      // remoteChanged 但内容一致（指纹相同）→ 无需同步
    }
  });

  return { conflicts, permissionIssues, clean };
}

function opLabel(type: PendingOp['type']): string {
  return type === 'create' ? '新建' : type === 'update' ? '修改' : '删除';
}

export interface ApplyResolutionArgs {
  conflict: SyncConflict;
  resolution: ConflictResolution;
  /** 执行服务端写入（PUT/POST/DELETE），由调用方注入，避免本服务直接依赖网络层 */
  pushUpdate: (problem: Problem) => Promise<Problem>;
  pushCreate: (problem: Problem) => Promise<Problem>;
  pushDelete: (problemId: string) => Promise<void>;
  /** 拉取单条服务端最新值，用于采用服务端方案 */
  fetchRemote: (problemId: string) => Promise<Problem | null>;
}

export async function applyResolution(args: ApplyResolutionArgs): Promise<'synced' | 'skipped'> {
  const { conflict, resolution, pushUpdate, pushCreate, pushDelete, fetchRemote } = args;

  if (resolution === 'skip') {
    return 'skipped';
  }

  if (resolution === 'use_remote') {
    const latest = await fetchRemote(conflict.problemId);
    if (latest) {
      const owned = preserveOwnership(conflict.remote, latest);
      overwriteLocalProblem(owned);
    } else {
      removeLocalProblem(conflict.problemId);
    }
    return 'synced';
  }

  // keep_local：把本地版本推到服务端，归属强制保持为原值
  const isLocalDelete = (conflict.local as any).__deleted === true;
  const isRemoteDelete = (conflict.remote as any).__deleted === true;

  if (isLocalDelete) {
    await pushDelete(conflict.problemId);
    removeLocalProblem(conflict.problemId);
    return 'synced';
  }

  const ownedLocal = preserveOwnership(
    (conflict.remote as any).__deleted ? conflict.local : conflict.remote,
    conflict.local
  );

  if (isRemoteDelete) {
    // 服务端已删除，本地保留则重新创建，但归属不变
    const recreated = await pushCreate(ownedLocal);
    overwriteLocalProblem(preserveOwnership(ownedLocal, recreated));
  } else {
    const saved = await pushUpdate(ownedLocal);
    overwriteLocalProblem(preserveOwnership(ownedLocal, saved));
  }
  return 'synced';
}

/** 干净记录（无冲突、无授权问题）直接同步 */
export async function syncCleanRecord(
  problem: Problem,
  pushUpdate: (p: Problem) => Promise<Problem>,
  pushCreate: (p: Problem) => Promise<Problem>,
  pushDelete: (id: string) => Promise<void>
): Promise<void> {
  const isDelete = (problem as any).__deleted === true;
  if (isDelete) {
    await pushDelete(problem.id);
    removeLocalProblem(problem.id);
    return;
  }
  if (!problem.baseVersion) {
    const created = await pushCreate(problem);
    overwriteLocalProblem({ ...problem, ...created, baseVersion: created.updatedAt });
  } else {
    const saved = await pushUpdate(problem);
    overwriteLocalProblem({ ...problem, ...saved, baseVersion: saved.updatedAt });
  }
}

export function finalizeSync(processedProblemIds?: string[]): void {
  if (!processedProblemIds || processedProblemIds.length === 0) {
    clearPendingOps();
    return;
  }
  // 仅清除已处理（同步或明确处理）记录对应的操作；跳过/授权受阻的保留在队列中
  const ops = getPendingOps();
  const remaining = ops.filter(op => !processedProblemIds.includes(op.problemId));
  clearPendingOps(remaining.map(op => op.opId));
}

/** 标记某条记录的待同步操作已处理 */
export function clearOpsForProblem(problemId: string): void {
  const ops = getPendingOps().filter(op => op.problemId !== problemId);
  clearPendingOps(ops.map(op => op.opId));
}

/** 列出所有待同步操作（用于横幅角标与提示） */
export function listPendingOps(): PendingOp[] {
  return getPendingOps();
}

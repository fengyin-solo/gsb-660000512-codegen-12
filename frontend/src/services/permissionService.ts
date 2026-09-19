import type { Problem, ProblemPermission, User, Collaborator } from '../types';

/**
 * 计算当前用户对一条练习记录的权限：
 *  - owner        负责人，可改动、可授权协作者
 *  - collaborator 授权协作者，可改动、不可转移归属
 *  - viewer       其他用户，只能查看
 */
export function getPermission(problem: Problem, user: User | null): ProblemPermission {
  if (!user) return 'viewer';
  if (problem.ownerId && problem.ownerId === user.id) return 'owner';
  if (problem.createdBy && problem.createdBy === user.id && !problem.ownerId) return 'owner';
  if ((problem.collaborators || []).some(c => c.userId === user.id)) return 'collaborator';
  // 系统内置记录（无负责人）在本地演示中对面试官开放维护，候选人只读
  if (!problem.ownerId && problem.createdBy === 'system') {
    return user.role === 'INTERVIEWER' ? 'collaborator' : 'viewer';
  }
  return 'viewer';
}

export function canEdit(problem: Problem, user: User | null): boolean {
  return getPermission(problem, user) !== 'viewer';
}

export function canDelete(problem: Problem, user: User | null): boolean {
  // 删除属于负责人的权力，协作者不可删除
  return getPermission(problem, user) === 'owner';
}

export function canManageCollaborators(problem: Problem, user: User | null): boolean {
  return getPermission(problem, user) === 'owner';
}

export class PermissionDeniedError extends Error {
  readonly requiredPermission: ProblemPermission;
  readonly actualPermission: ProblemPermission;
  readonly ownerName: string;

  constructor(problem: Problem, actual: ProblemPermission, required: ProblemPermission) {
    const owner = problem.ownerName || problem.ownerId || problem.createdBy || '未知';
    super(
      actual === 'viewer'
        ? `无权改动「${problem.title}」：该记录负责人为 ${owner}，仅负责人与授权协作者可修改，您当前只能查看。`
        : `无权执行此操作：需要「${requiredLabel(required)}」权限，您当前为「${requiredLabel(actual)}」。`
    );
    this.name = 'PermissionDeniedError';
    this.requiredPermission = required;
    this.actualPermission = actual;
    this.ownerName = owner;
  }
}

function requiredLabel(p: ProblemPermission): string {
  return p === 'owner' ? '负责人' : p === 'collaborator' ? '协作者' : '只读';
}

/** 负责人添加授权协作者 */
export function addCollaborator(problem: Problem, collaborator: User, grantedBy: User): Problem {
  const list: Collaborator[] = problem.collaborators ? [...problem.collaborators] : [];
  if (problem.ownerId === collaborator.id) {
    throw new Error('负责人本身已拥有全部权限，无需再添加为协作者');
  }
  if (list.some(c => c.userId === collaborator.id)) {
    throw new Error(`「${collaborator.name}」已是该记录的协作者`);
  }
  list.push({
    userId: collaborator.id,
    userName: collaborator.name,
    grantedAt: new Date().toISOString(),
    grantedBy: grantedBy.id,
  });
  return { ...problem, collaborators: list };
}

export function removeCollaborator(problem: Problem, userId: string): Problem {
  return {
    ...problem,
    collaborators: (problem.collaborators || []).filter(c => c.userId !== userId),
  };
}

/**
 * 确保归属不被改动：更新/同步时强制保留原负责人与协作者。
 * 任何覆盖性写入都应经过此函数。
 */
export function preserveOwnership(existing: Problem, incoming: Problem): Problem {
  return {
    ...incoming,
    id: existing.id,
    ownerId: existing.ownerId,
    ownerName: existing.ownerName,
    createdBy: existing.createdBy,
    collaborators: existing.collaborators,
    createdAt: existing.createdAt,
  };
}

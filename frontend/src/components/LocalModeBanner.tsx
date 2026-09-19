import React, { useEffect, useRef, useState } from 'react';
import { useDataModeStore } from '../store/dataMode';
import { listPendingOps } from '../services/syncService';
import {
  probeServerProblems,
  setUseMockFallback,
} from '../services/problemService';
import { applyServerSnapshot } from '../services/mockProblemService';
import { SyncDialog } from './SyncDialog';
import { buildSyncSummary, applyResolution, syncCleanRecord, finalizeSync, clearOpsForProblem } from '../services/syncService';
import {
  pushCreateToServer,
  pushUpdateToServer,
  pushDeleteToServer,
  fetchProblemFromServer,
} from '../services/problemService';
import { getSessionUser } from '../services/sessionService';
import { useToastStore } from '../store/toast';
import type { Problem, SyncConflict, ConflictResolution, PendingSyncSummary } from '../types';

/**
 * 本地数据模式横幅 + 恢复同步编排。
 * - 后端不可用时常驻显示，明确告知“已切换到本地数据模式”
 * - 周期性探测后端，恢复后先弹出授权问题与冲突项，逐条选择同步
 */
export const LocalModeBanner: React.FC<{ onSynced?: () => void }> = ({ onSynced }) => {
  const { mode, localModeSince, setPendingCount } = useDataModeStore();
  const { success, warning, error, info } = useToastStore();
  const [pending, setPending] = useState(0);
  const [summary, setSummary] = useState<PendingSyncSummary | null>(null);
  const [remoteSnapshot, setRemoteSnapshot] = useState<Problem[]>([]);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const summaryOpenRef = useRef(false);
  /** 已真正同步到服务端的记录 id（关闭时清除其待同步操作） */
  const processedIdsRef = useRef<Set<string>>(new Set());
  /** 用户选择“跳过”的记录 id（保留在待同步队列） */
  const skippedIdsRef = useRef<Set<string>>(new Set());

  const refreshPending = () => {
    const count = listPendingOps().length;
    setPending(count);
    setPendingCount(count);
  };

  useEffect(() => {
    if (mode !== 'local') return;
    refreshPending();
    const timer = setInterval(refreshPending, 2000);
    return () => clearInterval(timer);
  }, [mode]);

  // 自动周期性探测后端是否恢复
  useEffect(() => {
    if (mode !== 'local') return;
    summaryOpenRef.current = false;
    processedIdsRef.current = new Set();
    skippedIdsRef.current = new Set();

    const probeOnce = async (): Promise<boolean> => {
      if (checkingRef.current) return false;
      checkingRef.current = true;
      setChecking(true);
      try {
        const remote = await probeServerProblems();
        if (!remote) return false;

        const s = buildSyncSummary(remote, getSessionUser());
        const hasAnything =
          s.conflicts.length > 0 || s.permissionIssues.length > 0 || s.clean.length > 0;

        if (!hasAnything && listPendingOps().length === 0) {
          // 后端恢复且无任何待处理改动：静默切回在线
          applyServerSnapshot(remote);
          setUseMockFallback(false);
          success('后端服务已恢复，已自动切回在线数据模式');
          onSynced?.();
          return true;
        }
        if (!summaryOpenRef.current) {
          summaryOpenRef.current = true;
          setRemoteSnapshot(remote);
          setSummary(s);
          warning('后端服务已恢复，请先确认授权问题与冲突项');
        }
        return false;
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    };

    const timer = setInterval(() => { probeOnce(); }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode !== 'local') return null;

  const manualCheck = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const remote = await probeServerProblems();
      if (!remote) {
        warning('后端仍不可用，继续使用本地数据模式');
        return;
      }
      const s = buildSyncSummary(remote, getSessionUser());
      if (s.conflicts.length === 0 && s.permissionIssues.length === 0 && s.clean.length === 0
          && listPendingOps().length === 0) {
        // 无待同步改动，直接切回在线
        applyServerSnapshot(remote);
        setUseMockFallback(false);
        success('后端已恢复，无待同步改动，已切回在线模式');
        onSynced?.();
      } else {
        summaryOpenRef.current = true;
        setRemoteSnapshot(remote);
        setSummary(s);
        warning('后端已恢复，请先处理授权问题与冲突项');
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  const handleResolve = async (conflict: SyncConflict, resolution: ConflictResolution) => {
    try {
      const result = await applyResolution({
        conflict,
        resolution,
        pushUpdate: pushUpdateToServer,
        pushCreate: pushCreateToServer,
        pushDelete: pushDeleteToServer,
        fetchRemote: fetchProblemFromServer,
      });
      if (resolution === 'skip') {
        skippedIdsRef.current.add(conflict.problemId);
        info('该记录已跳过，将保留在待同步列表中');
      } else if (result === 'synced') {
        processedIdsRef.current.add(conflict.problemId);
        clearOpsForProblem(conflict.problemId);
        success('该冲突已按选择同步，归属保持不变');
      }
      refreshPending();
    } catch (e) {
      error(e instanceof Error ? e.message : '同步该记录失败');
      throw e;
    }
  };

  const handleSyncClean = async () => {
    if (!summary) return;
    for (const p of summary.clean) {
      await syncCleanRecord(p, pushUpdateToServer, pushCreateToServer, pushDeleteToServer);
      processedIdsRef.current.add(p.id);
      clearOpsForProblem(p.id);
    }
    success(`已同步 ${summary.clean.length} 条无冲突改动`);
    // 刷新 summary，剔除已同步的 clean
    const remote = await probeServerProblems();
    if (remote) {
      setRemoteSnapshot(remote);
      setSummary(buildSyncSummary(remote, getSessionUser()));
    }
    refreshPending();
  };

  const handleClose = () => {
    // 冲突已逐条处理完毕：拉取服务端最新快照、只清除已处理操作、切回在线。
    // 授权受阻与“跳过”的记录保留在本地待同步队列中。
    (async () => {
      const remote = (await probeServerProblems()) || remoteSnapshot;
      const unresolved = listPendingOps().map(op => op.problemId);
      applyServerSnapshot(remote);
      finalizeSync(Array.from(processedIdsRef.current));
      setSummary(null);
      summaryOpenRef.current = false;
      setUseMockFallback(false);
      if (unresolved.length > 0) {
        warning(`已切回在线模式，仍有 ${unresolved.length} 条跳过或授权受阻的改动保留在本地。`);
      } else {
        success('同步完成，已切回在线数据模式');
      }
      onSynced?.();
    })();
  };

  return (
    <>
      <div style={{
        margin: '16px 24px 0',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, rgba(255,152,0,0.18), rgba(255,193,7,0.12))',
        border: '1px solid rgba(255,152,0,0.45)',
        borderRadius: '8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>📴</span>
          <div>
            <div style={{ color: '#ff9800', fontWeight: 600, fontSize: '15px' }}>
              已切换到本地数据模式
            </div>
            <div style={{ color: '#bbb', margin: '3px 0 0', fontSize: '13px' }}>
              后端服务不可用，改动保存在浏览器本地存储中（归属与协作者权限照常生效）。
              {localModeSince && ` 切换于 ${new Date(localModeSince).toLocaleTimeString('zh-CN')}。`}
              {' '}待同步改动 <b style={{ color: '#ff9800' }}>{pending}</b> 条，恢复后将先提示授权问题与冲突，再逐条同步。
            </div>
          </div>
        </div>
        <button
          onClick={manualCheck}
          disabled={checking}
          style={{
            padding: '9px 18px', background: 'rgba(255,152,0,0.25)', color: '#ff9800',
            border: '1px solid rgba(255,152,0,0.5)', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
            opacity: checking ? 0.7 : 1,
          }}>
          {checking ? '检测中...' : '🔌 检测后端并同步'}
        </button>
      </div>

      {summary && (summary.conflicts.length > 0 || summary.permissionIssues.length > 0 || summary.clean.length > 0) && (
        <SyncDialog
          conflicts={summary.conflicts}
          permissionIssues={summary.permissionIssues}
          cleanCount={summary.clean.length}
          onResolve={handleResolve}
          onSyncClean={handleSyncClean}
          onClose={handleClose}
        />
      )}
    </>
  );
};

import React, { useState } from 'react';
import type {
  SyncConflict,
  PermissionIssue,
  ConflictResolution,
  Problem,
} from '../types';
import { getUserName } from '../services/sessionService';

interface SyncDialogProps {
  conflicts: SyncConflict[];
  permissionIssues: PermissionIssue[];
  cleanCount: number;
  onResolve: (conflict: SyncConflict, resolution: ConflictResolution) => Promise<void>;
  onSyncClean: () => Promise<void>;
  onClose: () => void;
  resolving?: boolean;
}

/**
 * 恢复在线后的同步对话框：
 *  1. 先列出授权问题（无权改动的记录）
 *  2. 再逐条列出冲突项，必须逐条选择（冲突不能覆盖）
 */
export const SyncDialog: React.FC<SyncDialogProps> = ({
  conflicts,
  permissionIssues,
  cleanCount,
  onResolve,
  onSyncClean,
  onClose,
}) => {
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [cleanSynced, setCleanSynced] = useState(false);
  const [syncingClean, setSyncingClean] = useState(false);

  const remaining = conflicts.filter(c => !done[c.problemId]);
  const allConflictsDone = remaining.length === 0;

  const choose = async (conflict: SyncConflict, resolution: ConflictResolution) => {
    setBusyId(conflict.problemId);
    try {
      await onResolve(conflict, resolution);
      setResolutions(prev => ({ ...prev, [conflict.problemId]: resolution }));
      setDone(prev => ({ ...prev, [conflict.problemId]: true }));
    } finally {
      setBusyId(null);
    }
  };

  const localDeleted = (p: Problem) => (p as any).__deleted === true;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
    }}>
      <div style={{
        background: '#1e1e1e', borderRadius: '10px', width: '820px',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid #444',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #333' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>🔄 恢复连接 · 数据同步</h2>
          <p style={{ color: '#888', margin: '6px 0 0', fontSize: '13px' }}>
            后端服务已恢复。请先确认授权问题与冲突项，冲突记录不会被自动覆盖，需逐条选择同步方式；记录归属始终保持不变。
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* 授权问题 */}
          {permissionIssues.length > 0 && (
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#f44336', fontSize: '15px', margin: '0 0 10px' }}>
                🔒 授权问题（{permissionIssues.length}）
              </h3>
              {permissionIssues.map((issue, i) => (
                <div key={i} style={{
                  background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.3)',
                  borderRadius: '8px', padding: '12px 16px', marginBottom: '8px',
                }}>
                  <div style={{ color: '#fff', fontWeight: 500, fontSize: '14px' }}>
                    {issue.problemTitle}
                  </div>
                  <div style={{ color: '#bbb', fontSize: '13px', marginTop: '4px' }}>{issue.reason}</div>
                  <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                    负责人：{issue.ownerName}。该本地改动不会被同步，您可联系负责人授权后再试。
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* 无冲突记录 */}
          {cleanCount > 0 && (
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#4caf50', fontSize: '15px', margin: '0 0 10px' }}>
                ✅ 可直接同步的改动（{cleanCount}）
              </h3>
              <div style={{
                background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.3)',
                borderRadius: '8px', padding: '12px 16px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: '#bbb', fontSize: '13px' }}>
                  {cleanSynced ? '这些改动已成功同步到服务端。' : '这些记录仅有本地改动，无冲突，可直接上传，归属保持不变。'}
                </span>
                {!cleanSynced && (
                  <button
                    disabled={syncingClean}
                    onClick={async () => {
                      setSyncingClean(true);
                      try {
                        await onSyncClean();
                        setCleanSynced(true);
                      } finally {
                        setSyncingClean(false);
                      }
                    }}
                    style={{
                      padding: '8px 18px', background: '#4caf50', color: '#fff',
                      border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                      opacity: syncingClean ? 0.7 : 1,
                    }}>
                    {syncingClean ? '同步中...' : '一键同步'}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* 冲突项 */}
          {conflicts.length > 0 && (
            <section>
              <h3 style={{ color: '#ff9800', fontSize: '15px', margin: '0 0 10px' }}>
                ⚠️ 冲突项（剩余 {remaining.length} / 共 {conflicts.length}）
              </h3>
              {conflicts.map((conflict) => {
                const isDone = !!done[conflict.problemId];
                const localDel = localDeleted(conflict.local);
                const remoteDel = localDeleted(conflict.remote);
                return (
                  <div key={conflict.problemId} style={{
                    background: isDone ? '#1a1a1a' : 'rgba(255,152,0,0.06)',
                    border: `1px solid ${isDone ? '#333' : 'rgba(255,152,0,0.35)'}`,
                    borderRadius: '8px', padding: '14px 16px', marginBottom: '12px',
                    opacity: isDone ? 0.6 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#fff', fontWeight: 500, fontSize: '14px' }}>
                        {conflict.problemTitle}
                      </span>
                      <span style={{ color: '#888', fontSize: '12px' }}>
                        负责人：{getUserName(conflict.remote.ownerId || conflict.local.ownerId)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ background: '#252525', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ color: '#667eea', fontSize: '12px', marginBottom: '4px' }}>本地版本（离线期间）</div>
                        <div style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5 }}>
                          {localDel ? '🗑 本地已删除' : conflict.local.description?.slice(0, 90) || conflict.local.title}
                        </div>
                        {conflict.local.updatedAt && (
                          <div style={{ color: '#666', fontSize: '11px', marginTop: '6px' }}>
                            {new Date(conflict.local.updatedAt).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                      <div style={{ background: '#252525', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ color: '#4caf50', fontSize: '12px', marginBottom: '4px' }}>服务端版本（他人已改）</div>
                        <div style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5 }}>
                          {remoteDel ? '🗑 服务端已删除' : conflict.remote.description?.slice(0, 90) || conflict.remote.title}
                        </div>
                        {conflict.remote.updatedAt && (
                          <div style={{ color: '#666', fontSize: '11px', marginTop: '6px' }}>
                            {new Date(conflict.remote.updatedAt).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </div>

                    {isDone ? (
                      <div style={{ color: '#4caf50', fontSize: '13px' }}>✓ 已处理：{labelOf(resolutions[conflict.problemId])}</div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          disabled={busyId === conflict.problemId}
                          onClick={() => choose(conflict, 'keep_local')}
                          style={choiceBtn('#667eea')}>
                          {localDel ? '确认本地删除并同步' : '保留本地版本'}
                        </button>
                        <button
                          disabled={busyId === conflict.problemId}
                          onClick={() => choose(conflict, 'use_remote')}
                          style={choiceBtn('#4caf50')}>
                          {remoteDel ? '接受服务端删除' : '采用服务端版本'}
                        </button>
                        <button
                          disabled={busyId === conflict.problemId}
                          onClick={() => choose(conflict, 'skip')}
                          style={choiceBtn('#888')}>
                          暂不同步（跳过）
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {conflicts.length === 0 && permissionIssues.length === 0 && cleanCount === 0 && (
            <div style={{ color: '#888', textAlign: 'center', padding: '32px' }}>
              离线期间没有待同步的改动。
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid #333',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#888', fontSize: '12px' }}>
            {allConflictsDone ? '所有冲突已逐条处理。' : '冲突记录需逐条选择，不会自动覆盖。'}
          </span>
          <button
            onClick={onClose}
            disabled={!allConflictsDone || busyId !== null}
            style={{
              padding: '10px 24px', borderRadius: '6px',
              border: 'none', background: allConflictsDone ? '#667eea' : '#444',
              color: '#fff', cursor: allConflictsDone ? 'pointer' : 'not-allowed', fontSize: '14px',
            }}>
            {allConflictsDone ? '完成' : `还有 ${remaining.length} 条冲突待处理`}
          </button>
        </div>
      </div>
    </div>
  );
};

function labelOf(r?: ConflictResolution): string {
  if (r === 'keep_local') return '保留本地版本';
  if (r === 'use_remote') return '采用服务端版本';
  return '已跳过';
}

function choiceBtn(color: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: '6px', border: `1px solid ${color}`,
    background: 'transparent', color, cursor: 'pointer', fontSize: '13px',
  };
}

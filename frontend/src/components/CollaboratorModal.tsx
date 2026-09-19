import React, { useState } from 'react';
import type { Problem, User } from '../types';
import { PRACTICE_USERS } from '../services/sessionService';
import { addProblemCollaborator, removeProblemCollaborator } from '../services/problemService';
import { useToastStore } from '../store/toast';

interface CollaboratorModalProps {
  problem: Problem;
  onClose: () => void;
  onChanged: (problem: Problem) => void;
}

/** 负责人管理授权协作者；其他角色只能查看名单 */
export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ problem, onClose, onChanged }) => {
  const { success, error } = useToastStore();
  const [busy, setBusy] = useState(false);
  const collaborators = problem.collaborators || [];

  const candidates = PRACTICE_USERS.filter(
    u => u.id !== problem.ownerId && !collaborators.some(c => c.userId === u.id)
  );

  const handleAdd = async (user: User) => {
    setBusy(true);
    try {
      const updated = await addProblemCollaborator(problem.id, user);
      success(`已授权「${user.name}」为协作者`);
      onChanged(updated);
    } catch (e) {
      error(e instanceof Error ? e.message : '添加协作者失败');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setBusy(true);
    try {
      const updated = await removeProblemCollaborator(problem.id, userId);
      success('已移除协作者授权');
      onChanged(updated);
    } catch (e) {
      error(e instanceof Error ? e.message : '移除协作者失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500,
    }}>
      <div style={{
        background: '#1e1e1e', borderRadius: '10px', width: '520px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid #333',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>👥 管理协作者</h2>
            <p style={{ color: '#888', margin: '4px 0 0', fontSize: '12px' }}>
              「{problem.title}」· 负责人：{problem.ownerName || problem.ownerId}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '22px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#ccc', fontSize: '13px', margin: '0 0 10px' }}>已授权协作者（可改动记录）</h3>
            {collaborators.length === 0 ? (
              <p style={{ color: '#666', fontSize: '13px' }}>暂无协作者，其他用户仅能查看此记录。</p>
            ) : (
              collaborators.map(c => (
                <div key={c.userId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#252525', borderRadius: '6px', padding: '10px 14px', marginBottom: '8px',
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '14px' }}>{c.userName}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>授权于 {new Date(c.grantedAt).toLocaleString('zh-CN')}</div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => handleRemove(c.userId)}
                    style={{
                      padding: '6px 12px', background: 'rgba(244,67,54,0.1)',
                      color: '#f44336', border: '1px solid rgba(244,67,54,0.3)',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                    }}>
                    移除
                  </button>
                </div>
              ))
            )}
          </div>

          <div>
            <h3 style={{ color: '#ccc', fontSize: '13px', margin: '0 0 10px' }}>可添加的用户</h3>
            {candidates.length === 0 ? (
              <p style={{ color: '#666', fontSize: '13px' }}>没有更多可添加的用户。</p>
            ) : (
              candidates.map(u => (
                <div key={u.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#252525', borderRadius: '6px', padding: '10px 14px', marginBottom: '8px',
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '14px' }}>{u.name}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>{u.email} · {u.role}</div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => handleAdd(u)}
                    style={{
                      padding: '6px 12px', background: 'rgba(102,126,234,0.1)',
                      color: '#667eea', border: '1px solid rgba(102,126,234,0.3)',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                    }}>
                    + 授权协作
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #333', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 22px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

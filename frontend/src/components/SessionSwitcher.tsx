import React from 'react';
import { PRACTICE_USERS, getSessionUser, setSessionUser } from '../services/sessionService';
import { useInterviewStore } from '../store/interview';

/** 切换当前会话用户（演示用：不同角色提交的记录归属不同、权限不同） */
export const SessionSwitcher: React.FC<{ onChange?: () => void }> = ({ onChange }) => {
  const { setCurrentUser } = useInterviewStore();
  const current = getSessionUser();

  return (
    <select
      value={current.id}
      onChange={(e) => {
        const user = PRACTICE_USERS.find(u => u.id === e.target.value);
        if (user) {
          setSessionUser(user);
          setCurrentUser(user);
          onChange?.();
        }
      }}
      title="切换当前用户（模拟不同角色登录）"
      style={{
        padding: '8px 12px', borderRadius: '6px',
        border: '1px solid #444', background: '#2d2d2d', color: '#fff',
        fontSize: '13px', cursor: 'pointer', maxWidth: '220px',
      }}
    >
      {PRACTICE_USERS.map(u => (
        <option key={u.id} value={u.id}>
          {u.name}（{u.role === 'INTERVIEWER' ? '面试官' : '候选人'}）
        </option>
      ))}
    </select>
  );
};

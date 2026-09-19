import type { User } from '../types';

const SESSION_KEY = 'code_interview_session_user';

/**
 * 预置的练习用户，用于区分不同角色提交记录的负责人。
 * 实际项目中应由登录接口下发，这里以本地会话模拟。
 */
export const PRACTICE_USERS: User[] = [
  {
    id: 'user-alice',
    name: '爱丽丝（面试官）',
    email: 'alice@example.com',
    role: 'INTERVIEWER',
    createdAt: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'user-bob',
    name: '鲍勃（面试官）',
    email: 'bob@example.com',
    role: 'INTERVIEWER',
    createdAt: new Date('2026-01-02').toISOString(),
  },
  {
    id: 'user-carol',
    name: '卡罗尔（候选人）',
    email: 'carol@example.com',
    role: 'CANDIDATE',
    createdAt: new Date('2026-01-03').toISOString(),
  },
];

const DEFAULT_USER = PRACTICE_USERS[0];

export function getSessionUser(): User {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as User;
      const matched = PRACTICE_USERS.find(u => u.id === parsed.id);
      return matched || parsed;
    }
  } catch (e) {
    console.warn('读取会话用户失败，使用默认用户：', e);
  }
  return DEFAULT_USER;
}

export function setSessionUser(user: User): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('保存会话用户失败：', e);
  }
}

export function getUserById(userId?: string): User | undefined {
  if (!userId) return undefined;
  return PRACTICE_USERS.find(u => u.id === userId);
}

export function getUserName(userId?: string): string {
  if (!userId) return '未知负责人';
  if (userId === 'system') return '系统内置';
  return getUserById(userId)?.name || userId;
}

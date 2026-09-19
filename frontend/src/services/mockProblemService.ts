import type { Problem, CreateProblemRequest, UpdateProblemRequest } from '../types';

/**
 * 浏览器本地存储模式（后端不可用时使用）。
 *
 * 存储三类数据：
 *  1. problems        —— 本地记录快照（含归属、协作者、内容指纹）
 *  2. pendingOps      —— 离线期间的写操作队列，恢复后用于同步与冲突检测
 *  3. baseline        —— 切换到本地模式那一刻从服务端读到的基线（id -> updatedAt）
 */
const STORAGE_KEY = 'code_interview_problems';
const PENDING_OPS_KEY = 'code_interview_pending_ops';
const BASELINE_KEY = 'code_interview_server_baseline';

export type PendingOpType = 'create' | 'update' | 'delete';

export interface PendingOp {
  opId: string;
  type: PendingOpType;
  problemId: string;
  problemTitle: string;
  /** 提交该操作的用户（操作归属） */
  actorId: string;
  actorName: string;
  timestamp: string;
  /** update 时保存的本地新内容；create 保存完整记录 */
  payload?: Problem;
}

export const SYSTEM_PROBLEM_OWNER = 'system';

const seedProblems: Problem[] = [
  {
    id: 'mock-1',
    title: '两数之和',
    difficulty: 'easy',
    description: '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值 target 的那两个整数，并返回它们的数组下标。你可以假设每种输入只会对应一个答案。但是，数组中同一个元素在答案里不能重复出现。你可以按任意顺序返回答案。',
    examples: [
      { input: '[2,7,11,15], target = 9', output: '[0,1]', explanation: '因为 nums[0] + nums[1] == 9 ，返回 [0, 1]' },
      { input: '[3,2,4], target = 6', output: '[1,2]', explanation: '因为 nums[1] + nums[2] == 6 ，返回 [1, 2]' },
    ],
    testCases: [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', hidden: false },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]', hidden: false },
      { input: '[3,3]\n6', expectedOutput: '[0,1]', hidden: true },
      { input: '[-1,-2,-3,-4,-5]\n-8', expectedOutput: '[2,4]', hidden: true },
    ],
    tags: ['数组', '哈希表'],
    timeLimit: 2000,
    memoryLimit: 256,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    createdBy: SYSTEM_PROBLEM_OWNER,
    ownerId: SYSTEM_PROBLEM_OWNER,
    ownerName: '系统内置',
    collaborators: [],
  },
  {
    id: 'mock-2',
    title: '有效的括号',
    difficulty: 'easy',
    description: "给定一个只包括 '(', ')', '{', '}', '[', ']' 的字符串 s ，判断字符串是否有效。有效字符串需满足：左括号必须用相同类型的右括号闭合。左括号必须以正确的顺序闭合。每个右括号都有一个对应的相同类型的左括号。",
    examples: [
      { input: 's = "()"', output: 'true', explanation: '输入: "()"\n输出: true' },
      { input: 's = "()[]{}"', output: 'true', explanation: '输入: "()[]{}"\n输出: true' },
      { input: 's = "(]"', output: 'false', explanation: '输入: "(]"\n输出: false' },
    ],
    testCases: [
      { input: '"()"', expectedOutput: 'true', hidden: false },
      { input: '"()[]{}"', expectedOutput: 'true', hidden: false },
      { input: '"(]"', expectedOutput: 'false', hidden: false },
      { input: '"([)]"', expectedOutput: 'false', hidden: true },
      { input: '"{[]}"', expectedOutput: 'true', hidden: true },
    ],
    tags: ['栈', '字符串'],
    timeLimit: 2000,
    memoryLimit: 256,
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    createdBy: SYSTEM_PROBLEM_OWNER,
    ownerId: SYSTEM_PROBLEM_OWNER,
    ownerName: '系统内置',
    collaborators: [],
  },
  {
    id: 'mock-3',
    title: '无重复字符的最长子串',
    difficulty: 'medium',
    description: '给定一个字符串 s ，请你找出其中不含有重复字符的最长子串的长度。',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: '因为无重复字符的最长子串是 "abc"，所以其长度为 3。' },
      { input: 's = "bbbbb"', output: '1', explanation: '因为最长子串是 "b"，所以长度为 1。' },
      { input: 's = "pwwkew"', output: '3', explanation: '因为最长子串是 "wke"，所以长度为 3。' },
    ],
    testCases: [
      { input: '"abcabcbb"', expectedOutput: '3', hidden: false },
      { input: '"bbbbb"', expectedOutput: '1', hidden: false },
      { input: '"pwwkew"', expectedOutput: '3', hidden: false },
      { input: '""', expectedOutput: '0', hidden: true },
    ],
    tags: ['字符串', '滑动窗口', '哈希表'],
    timeLimit: 2000,
    memoryLimit: 256,
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    createdBy: SYSTEM_PROBLEM_OWNER,
    ownerId: SYSTEM_PROBLEM_OWNER,
    ownerName: '系统内置',
    collaborators: [],
  },
];

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`读取本地存储 ${key} 失败：`, e);
  }
  return fallback;
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`写入本地存储 ${key} 失败：`, e);
  }
}

const loadFromStorage = (): Problem[] => {
  const stored = readJSON<Problem[] | null>(STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length >= 0) {
    // 兼容旧数据：补齐归属字段
    return stored.map(normalizeOwnership);
  }
  return seedProblems.map(p => ({ ...p, contentHash: hashProblem(p), baseVersion: p.updatedAt }));
};

/** 为缺少归属信息的旧记录补默认值，保证“不同角色提交的记录区分负责人” */
function normalizeOwnership(p: Problem): Problem {
  const ownerId = p.ownerId || p.createdBy || 'unknown';
  return {
    ...p,
    ownerId,
    ownerName: p.ownerName || (ownerId === SYSTEM_PROBLEM_OWNER ? '系统内置' : ownerId),
    collaborators: p.collaborators || [],
  };
}

const saveToStorage = (problems: Problem[]) => {
  writeJSON(STORAGE_KEY, problems);
};

let problemsCache: Problem[] | null = null;

const getProblemsCache = (): Problem[] => {
  if (!problemsCache) {
    problemsCache = loadFromStorage();
  }
  return problemsCache;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 内容指纹：剔除易变元数据，仅对题目实质内容做哈希，用于冲突判断 */
export function hashProblem(problem: Problem): string {
  const core = {
    title: problem.title,
    difficulty: problem.difficulty,
    description: problem.description,
    examples: problem.examples,
    testCases: problem.testCases,
    tags: problem.tags,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
  };
  const str = JSON.stringify(core);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `h${hash}_${str.length}`;
}

export async function mockGetProblems(params?: { difficulty?: string; tag?: string }): Promise<Problem[]> {
  await delay(200);
  let problems = getProblemsCache();
  if (params?.difficulty && params.difficulty !== 'all') {
    problems = problems.filter(p => p.difficulty === params.difficulty);
  }
  if (params?.tag) {
    problems = problems.filter(p => p.tags.includes(params.tag!));
  }
  return problems.map(p => ({ ...p }));
}

export async function mockGetProblemById(id: string): Promise<Problem> {
  await delay(150);
  const problem = getProblemsCache().find(p => p.id === id);
  if (!problem) throw new Error('题目不存在');
  return { ...problem };
}

export async function mockCreateProblem(data: CreateProblemRequest): Promise<Problem> {
  await delay(300);
  const problems = getProblemsCache();
  const now = new Date().toISOString();
  const newProblem: Problem = normalizeOwnership({
    ...data,
    id: 'problem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    createdAt: now,
    updatedAt: now,
    createdBy: data.ownerId || data.createdBy || 'current-user',
    collaborators: data.collaborators || [],
  });
  newProblem.contentHash = hashProblem(newProblem);
  newProblem.baseVersion = undefined; // 本地新建，服务端尚无基线
  problemsCache = [newProblem, ...problems];
  saveToStorage(problemsCache);
  enqueueOp({
    type: 'create',
    problemId: newProblem.id,
    problemTitle: newProblem.title,
    payload: newProblem,
  });
  return { ...newProblem };
}

export async function mockUpdateProblem(id: string, data: UpdateProblemRequest): Promise<Problem> {
  await delay(300);
  const problems = getProblemsCache();
  const index = problems.findIndex(p => p.id === id);
  if (index === -1) throw new Error('题目不存在');

  // 归属保持不变：更新时不允许覆盖 ownerId/ownerName；
  // collaborators 仅在显式传入（负责人授权操作）时才更新
  const updatedProblem: Problem = {
    ...problems[index],
    ...data,
    id,
    ownerId: problems[index].ownerId,
    ownerName: problems[index].ownerName,
    createdBy: problems[index].createdBy,
    collaborators: data.collaborators !== undefined
      ? data.collaborators
      : problems[index].collaborators,
    updatedAt: new Date().toISOString(),
  };
  updatedProblem.contentHash = hashProblem(updatedProblem);

  problemsCache = [...problems];
  problemsCache[index] = updatedProblem;
  saveToStorage(problemsCache);
  enqueueOp({
    type: 'update',
    problemId: id,
    problemTitle: updatedProblem.title,
    payload: updatedProblem,
  });
  return { ...updatedProblem };
}

export async function mockDeleteProblem(id: string): Promise<void> {
  await delay(200);
  const problems = getProblemsCache();
  const target = problems.find(p => p.id === id);
  problemsCache = problems.filter(p => p.id !== id);
  saveToStorage(problemsCache);
  enqueueOp({
    type: 'delete',
    problemId: id,
    problemTitle: target?.title || id,
  });
}

/* ---------------- 离线操作队列 ---------------- */

export function getPendingOps(): PendingOp[] {
  return readJSON<PendingOp[]>(PENDING_OPS_KEY, []);
}

export function clearPendingOps(ids?: string[]): void {
  if (!ids) {
    writeJSON(PENDING_OPS_KEY, []);
    return;
  }
  const remaining = getPendingOps().filter(op => !ids.includes(op.opId));
  writeJSON(PENDING_OPS_KEY, remaining);
}

function enqueueOp(partial: Omit<PendingOp, 'opId' | 'actorId' | 'actorName' | 'timestamp'>): void {
  const ops = getPendingOps();
  // 同一记录的连续更新合并为一条，避免冗余
  const merged = [...ops];
  if (partial.type === 'update') {
    const lastIdx = merged.map(op => op.problemId).lastIndexOf(partial.problemId);
    if (lastIdx >= 0 && merged[lastIdx].type === 'update') {
      merged[lastIdx] = { ...merged[lastIdx], ...partial, timestamp: new Date().toISOString() };
      writeJSON(PENDING_OPS_KEY, merged);
      return;
    }
  }
  // actorId/actorName 由 problemService 在调用时通过 setPendingActor 注入
  merged.push({
    ...partial,
    opId: 'op-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8),
    actorId: pendingActor?.actorId || 'unknown',
    actorName: pendingActor?.actorName || '未知用户',
    timestamp: new Date().toISOString(),
  });
  writeJSON(PENDING_OPS_KEY, merged);
}

let pendingActor: { actorId: string; actorName: string } | null = null;
export function setPendingActor(actor: { actorId: string; actorName: string } | null): void {
  pendingActor = actor;
}

/* ---------------- 服务端基线（进入本地模式时记录） ---------------- */

export function saveServerBaseline(remoteProblems: Problem[]): void {
  const baseline: Record<string, string> = {};
  remoteProblems.forEach(p => {
    if (p.id && p.updatedAt) baseline[p.id] = p.updatedAt;
  });
  writeJSON(BASELINE_KEY, baseline);
}

export function getServerBaseline(): Record<string, string> {
  return readJSON<Record<string, string>>(BASELINE_KEY, {});
}

export function clearServerBaseline(): void {
  writeJSON(BASELINE_KEY, {});
}

/* ---------------- 模式切换 / 重置 ---------------- */

/** 进入本地模式：用服务端数据作为本地快照与基线 */
export function enterLocalMode(remoteProblems: Problem[] | null): void {
  if (remoteProblems && remoteProblems.length > 0) {
    const normalized = remoteProblems.map(p => {
      const withOwner = normalizeOwnership(p);
      return { ...withOwner, contentHash: hashProblem(withOwner), baseVersion: withOwner.updatedAt };
    });
    problemsCache = normalized;
    saveToStorage(normalized);
    saveServerBaseline(normalized);
  } else {
    getProblemsCache();
  }
}

export function getLocalProblems(): Problem[] {
  return getProblemsCache().map(p => ({ ...p }));
}

export function overwriteLocalProblem(problem: Problem): void {
  const problems = getProblemsCache();
  const index = problems.findIndex(p => p.id === problem.id);
  const stamped = { ...problem, contentHash: hashProblem(problem) };
  if (index === -1) {
    problemsCache = [stamped, ...problems];
  } else {
    problemsCache = [...problems];
    problemsCache[index] = stamped;
  }
  saveToStorage(problemsCache);
}

export function removeLocalProblem(id: string): void {
  problemsCache = getProblemsCache().filter(p => p.id !== id);
  saveToStorage(problemsCache);
}

/** 同步完成后用服务端最新数据整体替换本地快照并清空队列 */
export function applyServerSnapshot(remoteProblems: Problem[]): void {
  const normalized = remoteProblems.map(p => {
    const withOwner = normalizeOwnership(p);
    return { ...withOwner, contentHash: hashProblem(withOwner), baseVersion: withOwner.updatedAt };
  });
  problemsCache = normalized;
  saveToStorage(normalized);
  saveServerBaseline(normalized);
}

export const resetMockData = () => {
  problemsCache = seedProblems.map(p => ({ ...p, contentHash: hashProblem(p), baseVersion: p.updatedAt }));
  saveToStorage(problemsCache);
  clearPendingOps();
  clearServerBaseline();
};

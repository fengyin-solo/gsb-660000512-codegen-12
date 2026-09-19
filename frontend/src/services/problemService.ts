import { request } from './api';
import type { Problem, CreateProblemRequest, UpdateProblemRequest, User } from '../types';
import {
  mockGetProblems,
  mockGetProblemById,
  mockCreateProblem,
  mockUpdateProblem,
  mockDeleteProblem,
  enterLocalMode,
  setPendingActor,
  getLocalProblems,
  applyServerSnapshot,
  getPendingOps,
} from './mockProblemService';
import {
  canEdit,
  canDelete,
  PermissionDeniedError,
  getPermission,
  addCollaborator,
  removeCollaborator,
} from './permissionService';
import { getSessionUser } from './sessionService';
import { useDataModeStore } from '../store/dataMode';

export interface ProblemListParams {
  difficulty?: string;
  tag?: string;
}

let useMockFallback = false;

export const setUseMockFallback = (value: boolean) => {
  const prev = useMockFallback;
  useMockFallback = value;
  const { setMode } = useDataModeStore.getState();
  if (value) {
    setMode('local');
    if (!prev) {
      console.warn('⚠️ 后端服务不可用，已切换到【本地数据模式】。数据将保存在浏览器本地存储中，恢复后可同步。');
    }
  } else {
    setMode('online');
  }
};

export const isUsingMockData = () => useMockFallback;

const handleApiError = (error: any) => {
  if (error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('load failed') ||
      error.status === 0) {
    setUseMockFallback(true);
    return true;
  }
  return false;
};

const currentUser = (): User => getSessionUser();

/** 把当前会话用户注入离线操作队列（操作归属） */
const withActor = <T>(fn: () => Promise<T>): Promise<T> => {
  const user = currentUser();
  setPendingActor({ actorId: user.id, actorName: user.name });
  return fn().finally(() => setPendingActor(null));
};

export async function getProblems(params?: ProblemListParams): Promise<Problem[]> {
  if (useMockFallback) {
    return mockGetProblems(params);
  }
  try {
    const queryParams = new URLSearchParams();
    if (params?.difficulty) queryParams.append('difficulty', params.difficulty);
    if (params?.tag) queryParams.append('tag', params.tag);
    const queryString = queryParams.toString();
    const response = await request<any[]>(`/problems${queryString ? `?${queryString}` : ''}`);
    const parsed = parseProblemListResponse(response);
    // 在线时持续刷新本地快照，作为断网切换时的最新基线（不清空待同步队列）
    if (getPendingOps().length === 0) {
      applyServerSnapshot(parsed);
    }
    return parsed;
  } catch (error: any) {
    if (handleApiError(error)) {
      // 进入本地模式：优先使用最近一次在线快照
      enterLocalMode(null);
      return mockGetProblems(params);
    }
    throw error;
  }
}

export async function getProblemById(id: string): Promise<Problem> {
  if (useMockFallback) {
    return mockGetProblemById(id);
  }
  try {
    const response = await request<any>(`/problems/${id}`);
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleApiError(error)) {
      return mockGetProblemById(id);
    }
    throw error;
  }
}

export async function createProblem(data: CreateProblemRequest): Promise<Problem> {
  const user = currentUser();
  // 新建记录的负责人即提交者
  const ownedData: CreateProblemRequest = {
    ...data,
    ownerId: data.ownerId || user.id,
    ownerName: data.ownerName || user.name,
    collaborators: data.collaborators || [],
  };

  if (useMockFallback) {
    return withActor(() => mockCreateProblem({ ...ownedData, createdBy: user.id }));
  }
  try {
    const payload = toServerPayload(ownedData);
    payload.createdBy = user.id;
    const response = await request<any>('/problems', { method: 'POST', body: payload });
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleApiError(error)) {
      return withActor(() => mockCreateProblem({ ...ownedData, createdBy: user.id }));
    }
    throw error;
  }
}

export async function updateProblem(id: string, data: UpdateProblemRequest): Promise<Problem> {
  const user = currentUser();

  // 权限校验（本地模式同样强制执行）
  const existing = await resolveProblemForPermission(id);
  if (existing) {
    const perm = getPermission(existing, user);
    if (!canEdit(existing, user)) {
      throw new PermissionDeniedError(existing, perm, 'collaborator');
    }
  }

  // 归属字段禁止通过普通更新修改
  const safeData: UpdateProblemRequest = { ...data, id };
  delete (safeData as any).ownerId;
  delete (safeData as any).ownerName;
  delete (safeData as any).createdBy;
  delete (safeData as any).collaborators;

  if (useMockFallback) {
    return withActor(() => mockUpdateProblem(id, safeData));
  }
  try {
    const payload = toServerPayload(safeData);
    delete payload.id;
    const response = await request<any>(`/problems/${id}`, { method: 'PUT', body: payload });
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleApiError(error)) {
      return withActor(() => mockUpdateProblem(id, safeData));
    }
    throw error;
  }
}

export async function deleteProblem(id: string): Promise<void> {
  const user = currentUser();
  const existing = await resolveProblemForPermission(id);
  if (existing) {
    const perm = getPermission(existing, user);
    if (!canDelete(existing, user)) {
      throw new PermissionDeniedError(existing, perm, 'owner');
    }
  }

  if (useMockFallback) {
    return withActor(() => mockDeleteProblem(id));
  }
  try {
    return await request<void>(`/problems/${id}`, { method: 'DELETE' });
  } catch (error: any) {
    if (handleApiError(error)) {
      return withActor(() => mockDeleteProblem(id));
    }
    throw error;
  }
}

/** 负责人添加协作者（仅 owner）。离线时写入本地并入队，恢复后同步。 */
export async function addProblemCollaborator(id: string, collaborator: User): Promise<Problem> {
  const user = currentUser();
  const existing = await resolveProblemForPermission(id);
  if (!existing) throw new Error('题目不存在');
  const perm = getPermission(existing, user);
  if (perm !== 'owner') {
    throw new PermissionDeniedError(existing, perm, 'owner');
  }
  const updated = addCollaborator(existing, collaborator, user);

  if (useMockFallback) {
    return withActor(() => mockUpdateProblem(id, {
      id,
      collaborators: updated.collaborators,
    } as UpdateProblemRequest));
  }
  try {
    const response = await request<any>(`/problems/${id}`, {
      method: 'PUT',
      body: { collaborators: JSON.stringify(updated.collaborators || []) },
    });
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleApiError(error)) {
      return withActor(() => mockUpdateProblem(id, {
        id,
        collaborators: updated.collaborators,
      } as UpdateProblemRequest));
    }
    throw error;
  }
}

export async function removeProblemCollaborator(id: string, collaboratorId: string): Promise<Problem> {
  const user = currentUser();
  const existing = await resolveProblemForPermission(id);
  if (!existing) throw new Error('题目不存在');
  const perm = getPermission(existing, user);
  if (perm !== 'owner') {
    throw new PermissionDeniedError(existing, perm, 'owner');
  }
  const updated = removeCollaborator(existing, collaboratorId);

  if (useMockFallback) {
    return withActor(() => mockUpdateProblem(id, {
      id,
      collaborators: updated.collaborators,
    } as UpdateProblemRequest));
  }
  try {
    const response = await request<any>(`/problems/${id}`, {
      method: 'PUT',
      body: { collaborators: JSON.stringify(updated.collaborators || []) },
    });
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleApiError(error)) {
      return withActor(() => mockUpdateProblem(id, {
        id,
        collaborators: updated.collaborators,
      } as UpdateProblemRequest));
    }
    throw error;
  }
}

/** 取一条记录用于权限判断：本地模式从本地快照读，在线模式直接请求 */
async function resolveProblemForPermission(id: string): Promise<Problem | null> {
  if (useMockFallback) {
    return getLocalProblems().find(p => p.id === id) || null;
  }
  try {
    return await getProblemById(id);
  } catch {
    return null;
  }
}

function toServerPayload(data: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = { ...data };
  if (data.examples) payload.examples = JSON.stringify(data.examples);
  if (data.testCases) payload.testCases = JSON.stringify(data.testCases);
  if (data.tags) payload.tags = JSON.stringify(data.tags);
  if (data.collaborators) payload.collaborators = JSON.stringify(data.collaborators);
  return payload;
}

export function parseProblemResponse(problem: any): Problem {
  return {
    ...problem,
    examples: safeParse(problem.examples, []),
    testCases: safeParse(problem.testCases, []),
    tags: safeParse(problem.tags, []),
    collaborators: safeParse(problem.collaborators, []),
    ownerId: problem.ownerId || problem.createdBy,
    ownerName: problem.ownerName,
  };
}

function safeParse(value: any, fallback: any) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseProblemListResponse(problems: any[]): Problem[] {
  return problems.map(parseProblemResponse);
}

/* ---------------- 恢复同步时使用的底层网络操作（不走本地回退） ---------------- */

/** 探测后端是否可用，可用则返回服务端最新题目列表 */
export async function probeServerProblems(): Promise<Problem[] | null> {
  try {
    const response = await request<any[]>('/problems');
    return parseProblemListResponse(response);
  } catch (error: any) {
    if (error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('load failed') ||
        error.status === 0) {
      return null;
    }
    // 服务端有响应但返回错误，也视为在线（不应停留在本地模式）
    return null;
  }
}

export async function fetchProblemFromServer(id: string): Promise<Problem | null> {
  try {
    return parseProblemResponse(await request<any>(`/problems/${id}`));
  } catch {
    return null;
  }
}

export async function pushCreateToServer(problem: Problem): Promise<Problem> {
  const payload = toServerPayload({
    title: problem.title,
    difficulty: problem.difficulty,
    description: problem.description,
    examples: problem.examples,
    testCases: problem.testCases,
    tags: problem.tags,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    ownerId: problem.ownerId,
    ownerName: problem.ownerName,
    createdBy: problem.ownerId || problem.createdBy,
    collaborators: problem.collaborators || [],
  });
  return parseProblemResponse(await request<any>('/problems', { method: 'POST', body: payload }));
}

export async function pushUpdateToServer(problem: Problem): Promise<Problem> {
  const payload = toServerPayload({
    title: problem.title,
    difficulty: problem.difficulty,
    description: problem.description,
    examples: problem.examples,
    testCases: problem.testCases,
    tags: problem.tags,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    ownerId: problem.ownerId,
    ownerName: problem.ownerName,
    collaborators: problem.collaborators || [],
  });
  return parseProblemResponse(
    await request<any>(`/problems/${problem.id}`, { method: 'PUT', body: payload })
  );
}

export async function pushDeleteToServer(id: string): Promise<void> {
  await request<void>(`/problems/${id}`, { method: 'DELETE' });
}

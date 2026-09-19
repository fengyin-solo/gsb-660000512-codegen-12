import React, { useState, useEffect } from 'react';
import { useInterviewStore } from '../store/interview';
import { useToastStore } from '../store/toast';
import {
  getProblems,
  deleteProblem,
  isUsingMockData,
} from '../services/problemService';
import { resetMockData } from '../services/mockProblemService';
import { getDifficultyTag, DIFFICULTY_TAGS, type Problem, type ProblemPermission } from '../types';
import { ProblemFormModal } from './ProblemFormModal';
import { CollaboratorModal } from './CollaboratorModal';
import { getSessionUser, getUserName } from '../services/sessionService';
import { getPermission } from '../services/permissionService';
import { useDataModeStore } from '../store/dataMode';

export const ProblemBankPage: React.FC = () => {
  const { problems, setProblems, removeProblem, updateProblem: updateProblemInStore, currentUser } = useInterviewStore();
  const { success, error, info, warning } = useToastStore();
  const mode = useDataModeStore(s => s.mode);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [collabProblem, setCollabProblem] = useState<Problem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const user = currentUser || getSessionUser();

  const loadProblems = async (silent = false) => {
    setLoading(true);
    try {
      const params: { difficulty?: string; tag?: string } = {};
      if (selectedDifficulty !== 'all') params.difficulty = selectedDifficulty;
      if (selectedTag) params.tag = selectedTag;
      const data = await getProblems(params);
      setProblems(data);
      if (isUsingMockData()) {
        if (!silent) warning('后端服务不可用，已切换到本地数据模式，改动保存在浏览器本地存储中。');
      } else if (!silent) {
        info(`已加载 ${data.length} 道题目`);
      }
    } catch (err) {
      console.error('Failed to load problems:', err);
      error('加载题目列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDifficulty, selectedTag]);

  const handleCreateProblem = () => {
    setEditingProblem(null);
    setIsModalOpen(true);
  };

  const handleEditProblem = (problem: Problem) => {
    const perm = getPermission(problem, user);
    if (perm === 'viewer') {
      error(`「${problem.title}」由 ${problem.ownerName || getUserName(problem.ownerId)} 负责，您只有查看权限，不能修改。`);
      return;
    }
    setEditingProblem(problem);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (problem: Problem) => {
    const perm = getPermission(problem, user);
    if (perm !== 'owner') {
      error(
        perm === 'collaborator'
          ? `您是「${problem.title}」的协作者，可编辑但不能删除；删除仅负责人可操作。`
          : `「${problem.title}」由 ${problem.ownerName || getUserName(problem.ownerId)} 负责，您只有查看权限。`
      );
      return;
    }
    setDeleteConfirmId(problem.id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteProblem(deleteConfirmId);
      removeProblem(deleteConfirmId);
      setDeleteConfirmId(null);
      success('题目删除成功');
    } catch (err) {
      console.error('Failed to delete problem:', err);
      error(err instanceof Error ? err.message : '删除题目失败，请稍后重试');
    }
  };

  const handleSuccess = (problem: Problem) => {
    if (editingProblem) {
      success(`题目「${problem.title}」更新成功（负责人：${problem.ownerName || getUserName(problem.ownerId)}）`);
    } else {
      success(`题目「${problem.title}」创建成功，负责人：${problem.ownerName || user.name}`);
    }
    loadProblems(true);
  };

  const filteredProblems = problems.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    );
  });

  const allTags = Array.from(new Set(problems.flatMap(p => p.tags))).filter(t => t);

  const inputStyle = {
    padding: '10px 16px',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#2d2d2d',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 24px 32px' }}>
      <div style={{ margin: '8px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '28px', margin: '0 0 8px 0' }}>题库管理</h1>
          <p style={{ color: '#888', margin: 0 }}>
            管理所有面试编程题目 · 记录按负责人归属，仅负责人与授权协作者可改动
          </p>
        </div>
        <button
          onClick={handleCreateProblem}
          style={{
            padding: '10px 24px',
            background: '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}>
          + 新增题目
        </button>
      </div>

      {mode === 'local' && (
        <div style={{
          marginBottom: '16px', display: 'flex', gap: '10px',
        }}>
          <button
            onClick={() => {
              resetMockData();
              loadProblems(true);
              success('已重置本地数据与待同步队列');
            }}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,152,0,0.15)',
              color: '#ff9800',
              border: '1px solid rgba(255,152,0,0.4)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}>
            🔄 重置本地数据
          </button>
        </div>
      )}

      <div style={{
        background: '#1e1e1e',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #333',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索题目标题、描述或标签..."
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        <div>
          <label style={{ color: '#888', fontSize: '12px', marginBottom: '4px', display: 'block' }}>难度筛选</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSelectedDifficulty('all')}
              style={{
                padding: '6px 16px',
                borderRadius: '16px',
                border: `1px solid ${selectedDifficulty === 'all' ? '#667eea' : '#444'}`,
                background: selectedDifficulty === 'all' ? 'rgba(102,126,234,0.15)' : 'transparent',
                color: selectedDifficulty === 'all' ? '#667eea' : '#888',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              全部
            </button>
            {DIFFICULTY_TAGS.map(tag => (
              <button
                key={tag.value}
                onClick={() => setSelectedDifficulty(tag.value)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '16px',
                  border: `1px solid ${selectedDifficulty === tag.value ? tag.color : '#444'}`,
                  background: selectedDifficulty === tag.value ? tag.bgColor : 'transparent',
                  color: selectedDifficulty === tag.value ? tag.color : '#888',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div style={{ minWidth: '200px' }}>
            <label style={{ color: '#888', fontSize: '12px', marginBottom: '4px', display: 'block' }}>标签筛选</label>
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              <option value="">所有标签</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#888', fontSize: '14px' }}>共 {filteredProblems.length} 道题目</span>
        <button
          onClick={() => loadProblems(false)}
          style={{ background: 'transparent', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px' }}
        >
          🔄 刷新列表
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#888' }}>加载中...</div>
      ) : filteredProblems.length === 0 ? (
        <div style={{
          background: '#1e1e1e', borderRadius: '12px', padding: '64px 24px',
          textAlign: 'center', border: '1px dashed #333',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
          <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>暂无题目</h3>
          <p style={{ color: '#888', margin: '0 0 24px 0' }}>
            {searchQuery || selectedDifficulty !== 'all' || selectedTag
              ? '没有找到匹配的题目，请调整筛选条件'
              : '点击右上角按钮创建您的第一道题目'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredProblems.map((problem) => {
            const diffTag = getDifficultyTag(problem.difficulty);
            const perm = getPermission(problem, user);
            return (
              <div
                key={problem.id}
                style={{
                  background: '#1e1e1e',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  border: '1px solid #333',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>{problem.title}</h3>
                      <span style={{
                        padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 500,
                        background: diffTag.bgColor, color: diffTag.color,
                      }}>
                        {diffTag.label}
                      </span>
                      <PermissionBadge perm={perm} />
                    </div>

                    {/* 归属信息 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '3px 10px', borderRadius: '10px', fontSize: '12px',
                        background: 'rgba(102,126,234,0.12)', color: '#9aa7f5',
                      }}>
                        👤 负责人：{problem.ownerName || getUserName(problem.ownerId || problem.createdBy)}
                        {perm === 'owner' && <span style={{ color: '#4caf50' }}>（我）</span>}
                      </span>
                      {(problem.collaborators || []).length > 0 && (
                        <span style={{
                          padding: '3px 10px', borderRadius: '10px', fontSize: '12px',
                          background: 'rgba(76,175,80,0.1)', color: '#7fd883',
                        }}>
                          👥 协作者：{(problem.collaborators || []).map(c =>
                            c.userName + (c.userId === user.id ? '（我）' : '')).join('、')}
                        </span>
                      )}
                    </div>

                    <p style={{ color: '#888', margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.5 }}>
                      {problem.description.length > 150
                        ? problem.description.substring(0, 150) + '...'
                        : problem.description}
                    </p>
                    {problem.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {problem.tags.map((tag, idx) => (
                          <span key={idx} style={{
                            padding: '4px 10px', background: 'rgba(102,126,234,0.1)',
                            color: '#667eea', borderRadius: '4px', fontSize: '12px',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {perm === 'owner' && (
                      <button
                        onClick={() => setCollabProblem(problem)}
                        style={{
                          padding: '8px 14px', background: 'rgba(76,175,80,0.1)',
                          color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                        }}
                      >
                        👥 协作者
                      </button>
                    )}
                    <button
                      onClick={() => handleEditProblem(problem)}
                      title={perm === 'viewer' ? '仅负责人与授权协作者可编辑' : '编辑'}
                      style={{
                        padding: '8px 16px',
                        background: perm === 'viewer' ? 'rgba(102,126,234,0.04)' : 'rgba(102,126,234,0.1)',
                        color: perm === 'viewer' ? '#555' : '#667eea',
                        border: `1px solid ${perm === 'viewer' ? '#333' : 'rgba(102,126,234,0.3)'}`,
                        borderRadius: '6px',
                        cursor: perm === 'viewer' ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {perm === 'viewer' ? '🔒 查看' : '编辑'}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(problem)}
                      title={perm === 'owner' ? '删除' : '仅负责人可删除'}
                      style={{
                        padding: '8px 16px',
                        background: perm === 'owner' ? 'rgba(244,67,54,0.1)' : 'rgba(244,67,54,0.04)',
                        color: perm === 'owner' ? '#f44336' : '#553333',
                        border: `1px solid ${perm === 'owner' ? 'rgba(244,67,54,0.3)' : '#333'}`,
                        borderRadius: '6px',
                        cursor: perm === 'owner' ? 'pointer' : 'not-allowed',
                        fontSize: '13px',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', color: '#666', fontSize: '12px' }}>
                  <span>⏱ {problem.timeLimit}ms</span>
                  <span>💾 {problem.memoryLimit}MB</span>
                  <span>📊 {problem.testCases.length} 个测试用例</span>
                  {problem.createdAt && (
                    <span>创建于 {new Date(problem.createdAt).toLocaleDateString('zh-CN')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#1e1e1e', borderRadius: '8px', padding: '24px', width: '400px', border: '1px solid #333' }}>
            <h3 style={{ color: '#fff', margin: '0 0 12px 0' }}>确认删除</h3>
            <p style={{ color: '#888', margin: '0 0 24px 0' }}>
              确定要删除这条记录吗？此操作在同步到服务端前若遇冲突会再次请您确认。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '10px 24px', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{ padding: '10px 24px', borderRadius: '4px', border: 'none', background: '#f44336', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      <ProblemFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        editingProblem={editingProblem}
      />

      {collabProblem && (
        <CollaboratorModal
          problem={collabProblem}
          onClose={() => setCollabProblem(null)}
          onChanged={(p) => {
            updateProblemInStore(p);
            setCollabProblem(p);
          }}
        />
      )}
    </div>
  );
};

const PermissionBadge: React.FC<{ perm: ProblemPermission }> = ({ perm }) => {
  const map: Record<ProblemPermission, { text: string; bg: string; color: string }> = {
    owner: { text: '我是负责人', bg: 'rgba(102,126,234,0.15)', color: '#9aa7f5' },
    collaborator: { text: '授权协作者', bg: 'rgba(76,175,80,0.15)', color: '#7fd883' },
    viewer: { text: '只读', bg: 'rgba(150,150,150,0.12)', color: '#999' },
  };
  const m = map[perm];
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
      background: m.bg, color: m.color, fontWeight: 500,
    }}>
      {m.text}
    </span>
  );
};

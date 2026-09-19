import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { JoinRoomPage } from './components/JoinRoomPage';
import { InterviewerRoomView } from './components/InterviewerRoomView';
import CandidateRoomView from './components/CandidateRoomView';
import { ProblemBankPage } from './components/ProblemBankPage';
import { useInterviewStore } from './store/interview';
import { InterviewRoom } from './types';
import { CreateRoomModal } from './components/CreateRoomModal';
import { getRoomsByInterviewer } from './services/interviewRoomService';
import { ToastContainer } from './components/Toast';
import { useToastStore } from './store/toast';
import { SessionSwitcher } from './components/SessionSwitcher';
import { LocalModeBanner } from './components/LocalModeBanner';
import { getSessionUser } from './services/sessionService';

const InterviewerHomePage: React.FC = () => {
  const { currentUser, setCurrentUser, myRooms, setMyRooms, setCurrentRoom } = useInterviewStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 以本地会话中的用户作为当前用户（区分不同角色提交记录的负责人）
    setCurrentUser(getSessionUser());
  }, [setCurrentUser]);

  useEffect(() => {
    if (currentUser) {
      loadMyRooms();
    }
  }, [currentUser]);

  const loadMyRooms = async () => {
    if (!currentUser) return;
    try {
      const rooms = await getRoomsByInterviewer(currentUser.id);
      setMyRooms(rooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  const handleCreateRoomSuccess = (room: InterviewRoom) => {
    setCurrentRoom(room);
    navigate(`/room/${room.id}/interviewer`);
  };

  const handleEnterRoom = (room: InterviewRoom) => {
    setCurrentRoom(room);
    navigate(`/room/${room.id}/interviewer`);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'WAITING': return '#ff9800';
      case 'ACTIVE': return '#4caf50';
      case 'COMPLETED': return '#2196f3';
      case 'CANCELLED': return '#f44336';
      default: return '#666';
    }
  };

  const activeTab = location.pathname === '/problem-bank' ? 'bank' : 'interviews';

  const tabButtonStyle = (active: boolean) => ({
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    color: active ? '#fff' : '#888',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: active ? 500 : 400,
    borderBottom: active ? '2px solid #667eea' : '2px solid transparent',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', fontFamily: 'sans-serif' }}>
      <div style={{
        background: '#1e1e1e',
        borderBottom: '1px solid #333',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'bold', fontSize: '16px',
          }}>
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 500 }}>{currentUser?.name}</div>
            <div style={{ color: '#888', fontSize: '12px' }}>{currentUser?.role}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SessionSwitcher />
          {activeTab === 'bank' ? null : (
            <button
              onClick={() => setIsCreateModalOpen(true)}
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
              + 创建面试房间
            </button>
          )}
        </div>
      </div>

      <LocalModeBanner />

      <div style={{ background: '#1e1e1e', borderBottom: '1px solid #333' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '8px' }}>
          <Link
            to="/"
            style={{ textDecoration: 'none' }}
          >
            <button style={tabButtonStyle(activeTab === 'interviews')}>
              📋 我的面试
            </button>
          </Link>
          <Link
            to="/problem-bank"
            style={{ textDecoration: 'none' }}
          >
            <button style={tabButtonStyle(activeTab === 'bank')}>
              📝 题库管理
            </button>
          </Link>
        </div>
      </div>

      {activeTab === 'interviews' && (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
          <h1 style={{ color: '#fff', fontSize: '28px', margin: '0 0 8px 0' }}>我的面试</h1>
          <p style={{ color: '#888', margin: '0 0 32px 0' }}>管理您创建的所有面试房间</p>

          {myRooms.length === 0 ? (
            <div style={{
              background: '#1e1e1e',
              borderRadius: '12px',
              padding: '64px 24px',
              textAlign: 'center',
              border: '1px dashed #333',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>暂无面试房间</h3>
              <p style={{ color: '#888', margin: '0 0 24px 0' }}>点击右上角按钮创建您的第一个面试房间</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  padding: '12px 32px',
                  background: '#4caf50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                创建面试房间
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {myRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleEnterRoom(room)}
                  style={{
                    background: '#1e1e1e',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    border: '1px solid #333',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#4caf50';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ color: '#fff', margin: '0 0 4px 0', fontSize: '18px' }}>{room.title}</h3>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '13px' }}>房间码: <span style={{ color: '#4caf50', fontFamily: 'monospace', fontWeight: 'bold' }}>{room.roomCode}</span></span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: getStatusBadgeColor(room.status) + '20',
                          color: getStatusBadgeColor(room.status),
                        }}>
                          {room.status}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: '#4caf50', fontSize: '20px' }}>→</span>
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    创建于 {new Date(room.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bank' && (
        <ProblemBankPage />
      )}

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateRoomSuccess}
      />
    </div>
  );
};

const InterviewerRoomPage: React.FC = () => {
  return <InterviewerRoomView />;
};

const App: React.FC = () => {
  const { toasts, removeToast } = useToastStore();
  return (
    <>
      <Routes>
        <Route path="/" element={<InterviewerHomePage />} />
        <Route path="/problem-bank" element={<InterviewerHomePage />} />
        <Route path="/join" element={<JoinRoomPage />} />
        <Route path="/room/:roomId/interviewer" element={<InterviewerRoomPage />} />
        <Route path="/room/:roomId/candidate" element={<CandidateRoomView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default App;

/**
 * 医生端问诊聊天页面 - 主组件
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

// 组件
import { ChatHeader } from './ChatHeader';
import { PatientInfo } from './PatientInfo';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';
import { AIReportCard } from './AIReportCard';

// 服务和类型
import { WebSocketService, ChatMessage as WSChatMessage } from '../../../services/websocket';
import { userStore } from '../../../store';
import {
  getConsultationDetail,
  getConsultationMessages,
  sendMessage,
  closeConsultation,
} from './api';
import { ConsultationDetail, ChatMessage } from './types';

// API 配置
const WS_URL = (import.meta.env as { VITE_API_BASE_URL: string; VITE_WS_URL?: string }).VITE_WS_URL || 'ws://localhost:3000';

export const DoctorChatPage = observer(function DoctorChatPage() {
  const { id: consultationId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 状态管理
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  // WebSocket 引用
  const wsRef = useRef<WebSocketService | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 加载问诊详情
  const loadConsultationDetail = useCallback(async () => {
    if (!consultationId) return;

    try {
      setLoading(true);
      setError(null);
      const detail = await getConsultationDetail(consultationId);
      setConsultation(detail);
      // 后端暂未返回 patient 对象，默认为在线
      setIsOnline(detail.patient?.isOnline ?? true);
    } catch (err: any) {
      console.error('加载问诊详情失败:', err);
      setError(err.message || '加载问诊详情失败');
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  // 加载消息历史
  const loadMessages = useCallback(async () => {
    if (!consultationId) return;

    try {
      const msgs = await getConsultationMessages(consultationId);
      // 确保 API 返回的消息有默认 contentType
      const messagesWithDefaults = msgs.map((msg) => ({
        ...msg,
        contentType: msg.contentType || 'text',
      }));
      setMessages(messagesWithDefaults);
    } catch (err: any) {
      console.error('加载消息失败:', err);
    }
  }, [consultationId]);

  // 初始化 WebSocket 连接
  const initWebSocket = useCallback(() => {
    if (!consultationId || !userStore.accessToken) return;

    // 如果已连接且 token 未变，不需要重连
    if (wsRef.current && wsRef.current.isConnected()) {
      // 重新加入会话
      wsRef.current.join(consultationId);
      return;
    }

    // 清理现有连接
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    // 创建新的 WebSocket 连接
    const ws = new WebSocketService(`${WS_URL}/ws`, userStore.accessToken);
    wsRef.current = ws;

    // 连接 WebSocket
    ws.connect()
      .then(() => {
        console.log('WebSocket 连接成功');
        // 加入问诊房间
        if (consultationId) {
          ws.join(consultationId);
        }
      })
      .catch((err: unknown) => {
        console.error('WebSocket 连接失败:', err);
        // 重连逻辑
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('尝试重新连接 WebSocket...');
          initWebSocket();
        }, 3000);
      });

    // 监听消息
    ws.onMessage((message: WSChatMessage) => {
      console.log('收到新消息:', message);
      setMessages((prev) => {
        // 检查是否已存在该消息
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;

        // 转换消息格式：处理 metadata.imageUrl 和 contentType 默认值
        const chatMessage: ChatMessage = {
          ...message,
          contentType: message.contentType || 'text',
          imageUrl: message.imageUrl || (message as any).metadata?.imageUrl,
        };

        return [...prev, chatMessage];
      });
    });

    // 监听系统消息（如在线状态变化）
    ws.onSystem((text: string) => {
      console.log('系统消息:', text);
      // 可以在这里处理系统消息，如显示提示
    });

    // 监听输入状态
    ws.onTyping((senderId: string) => {
      console.log('用户输入中:', senderId);
      // 可以在这里显示"对方正在输入..."
    });

    return () => {
      ws.disconnect();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [consultationId]);

  // 发送消息
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!consultationId || !content.trim()) return;

      try {
        // 通过 WebSocket 发送消息
        if (wsRef.current) {
          wsRef.current.sendMessage(consultationId, content);
        } else {
          setError('WebSocket 未连接');
        }
      } catch (err: any) {
        console.error('发送消息失败:', err);
        setError(err.message || '发送消息失败');
      }
    },
    [consultationId]
  );

  // 结束问诊
  const handleCloseConsultation = useCallback(async () => {
    if (!consultationId) return;

    // 确认对话框
    const confirmed = window.confirm('确认结束本次问诊吗？');
    if (!confirmed) return;

    try {
      await closeConsultation(consultationId);

      // 离开 WebSocket 房间
      if (wsRef.current) {
        wsRef.current.leave(consultationId);
      }

      // 返回工作台
      navigate('/doctor/console');
    } catch (err: any) {
      console.error('结束问诊失败:', err);
      setError(err.message || '结束问诊失败');
    }
  }, [consultationId, navigate]);

  // 查看完整 AI 报告
  const handleViewFullReport = useCallback(() => {
    // TODO: 实现查看完整报告的功能
    console.log('查看完整 AI 报告');
  }, []);

  // 初始化
  useEffect(() => {
    loadConsultationDetail();
    loadMessages();
  }, [loadConsultationDetail, loadMessages]);

  // 初始化 WebSocket
  useEffect(() => {
    initWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // 只在 consultationId 或 accessToken 变化时重新连接
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, userStore.accessToken]);

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !consultation) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/doctor/console')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* 顶部导航栏 */}
      {consultation && (
        <ChatHeader
          patientName={consultation.patient?.name || '患者'}
          isOnline={isOnline}
          onMoreClick={() => console.log('更多操作')}
        />
      )}

      {/* 患者信息横幅 */}
      {consultation && consultation.patient && <PatientInfo patient={consultation.patient} />}

      {/* AI 报告卡片（如果有） */}
      {consultation?.aiReport && (
        <AIReportCard report={consultation.aiReport} onViewFullReport={handleViewFullReport} />
      )}

      {/* 聊天区域 */}
      <ChatArea messages={messages} currentUserId={userStore.user?.id || ''} />

      {/* 输入区域 */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onCloseConsultation={handleCloseConsultation}
        disabled={consultation?.status === 'completed' || consultation?.status === 'cancelled'}
      />

      {/* 错误提示 */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
});

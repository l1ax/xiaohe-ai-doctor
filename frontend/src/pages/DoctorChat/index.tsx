import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';
import { WebSocketService, ChatMessage } from '../../services/websocket';
import { useSmartNavigation } from '../../utils/navigation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
// WebSocket URL: 在开发环境使用完整 URL，在生产环境使用相对路径
const WS_URL = import.meta.env.VITE_WS_URL || 
  (import.meta.env.DEV ? 'ws://localhost:3000/ws' : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);

interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  doctor: {
    name: string;
    title: string;
    department: string;
  };
}

interface Message {
  id: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

const DoctorChat = observer(function DoctorChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { navigateBack } = useSmartNavigation();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchConsultation();
    connectWebSocket();
    return () => {
      wsRef.current?.disconnect();
      wsRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConsultation = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/consultations/${id}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setConsultation(data.data);
      } else {
        setError(data.message || '加载问诊详情失败');
      }
    } catch (error) {
      console.error('Failed to fetch consultation:', error);
      setError('加载问诊详情失败，请检查网络连接');
    }
  };

  const loadMessageHistory = async (consultationId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/${consultationId}/messages`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        console.log('[DoctorChat] 📜 已加载历史消息', { count: data.data.length });
        setMessages(data.data);
      } else {
        setError(data.message || '加载消息历史失败');
      }
    } catch (error) {
      console.error('Failed to load message history:', error);
      setError('加载消息历史失败，请检查网络连接');
    }
  };

  const connectWebSocket = async () => {
    if (!id || !userStore.accessToken) return;

    console.log('[DoctorChat] 🔵 开始连接 WebSocket', {
      consultationId: id,
      userId: userStore.user?.id,
      userRole: userStore.user?.role,
      wsUrl: WS_URL,
    });

    const ws = new WebSocketService(WS_URL, userStore.accessToken);
    wsRef.current = ws;

    try {
      await ws.connect();
      setIsConnected(true);
      console.log('[DoctorChat] ✅ WebSocket 连接成功');

      ws.join(id);
      console.log('[DoctorChat] 📥 已发送 join 请求', { consultationId: id });

      // 加载历史消息
      await loadMessageHistory(id);

      ws.onMessage((message: ChatMessage) => {
        console.log('[DoctorChat] 📨 收到消息', {
          messageId: message.id,
          senderId: message.senderId,
          senderType: message.senderType,
          content: message.content,
          currentUserId: userStore.user?.id,
        });
        setMessages((prev) => {
          // 如果是自己发送的消息，替换临时消息
          const isOwnMessage = message.senderId === userStore.user?.id;
          if (isOwnMessage) {
            // 找到临时消息并替换
            const tempIndex = prev.findIndex((m) => m.id.startsWith('temp_') && m.content === message.content);
            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = message;
              return updated;
            }
            // 没找到临时消息，检查是否已存在
            const exists = prev.some((m) => m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          }
          // 其他人的消息，直接添加
          const exists = prev.some((m) => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      });

      ws.onTyping(() => setIsTyping(true));
    } catch (error) {
      console.warn('[DoctorChat] ❌ WebSocket 连接失败', error);
      setIsConnected(false);
      setError('WebSocket 连接失败，请检查网络连接');
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !id || !wsRef.current) return;

    const tempId = `temp_${Date.now()}`;
    const message = {
      id: tempId,
      senderId: userStore.user?.id || '',
      senderType: (userStore.user?.role === 'doctor' ? 'doctor' : 'patient') as 'patient' | 'doctor',
      content: inputValue,
      createdAt: new Date().toISOString(),
    };

    console.log('[DoctorChat] 📤 发送消息', {
      tempId: message.id,
      senderId: message.senderId,
      content: inputValue,
      conversationId: id,
    });

    // 先添加到本地列表
    setMessages((prev) => [...prev, message]);
    setInputValue('');

    // 通过 WebSocket 发送
    wsRef.current.sendMessage(id, inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCloseConsultation = async () => {
    if (!id) return;
    if (!confirm('确定要结束问诊吗？')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/${id}/close`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        console.log('[DoctorChat] ✅ 问诊已结束');
        alert('问诊已结束');
        navigate('/consultations');
      }
    } catch (error) {
      console.error('Failed to close consultation:', error);
      alert('结束问诊失败，请重试');
    }
  };

  if (!consultation) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => navigateBack('/consultations')}
          className="p-2 -ml-2"
          aria-label="返回"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-bold">{consultation.doctor?.name}</h1>
          <p className="text-sm text-gray-500">{consultation.doctor?.department}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          {userStore.user?.role === 'patient' && (
            <button
              onClick={handleCloseConsultation}
              className="px-3 py-1 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
            >
              结束问诊
            </button>
          )}
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === userStore.user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                msg.senderId === userStore.user?.id
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white rounded-bl-sm'
              }`}
            >
              <p>{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.senderId === userStore.user?.id ? 'text-white/70' : 'text-gray-400'}`}>
                {new Date(msg.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2">
              <p className="text-sm text-gray-500">对方正在输入...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t p-4">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:border-primary"
            placeholder="输入消息..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center disabled:bg-gray-300"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default DoctorChat;

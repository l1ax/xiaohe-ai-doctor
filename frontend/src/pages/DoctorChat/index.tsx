import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';
import { WebSocketService, ChatMessage } from '../../services/websocket';

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
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchConsultation();
    connectWebSocket();
    return () => wsRef.current?.disconnect();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConsultation = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/${id}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setConsultation(data.data);
    } catch (error) {
      console.error('Failed to fetch consultation:', error);
    }
  };

  const connectWebSocket = async () => {
    if (!id || !userStore.accessToken) return;

    const ws = new WebSocketService(WS_URL, userStore.accessToken);
    wsRef.current = ws;

    try {
      await ws.connect();
      setIsConnected(true);
      ws.join(id);

      ws.onMessage((message: ChatMessage) => {
        setMessages((prev) => [...prev, {
          id: message.id,
          senderId: message.senderId,
          senderType: message.senderType,
          content: message.content,
          createdAt: message.createdAt,
        }]);
      });

      ws.onTyping(() => setIsTyping(true));
    } catch (error) {
      console.warn('WebSocket 连接失败，消息将使用本地显示');
      setIsConnected(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !id || !wsRef.current) return;

    const message = {
      id: Date.now().toString(),
      senderId: userStore.user?.id || '',
      senderType: (userStore.user?.role === 'doctor' ? 'doctor' : 'patient') as 'patient' | 'doctor',
      content: inputValue,
      createdAt: new Date().toISOString(),
    };

    // 先添加到本地列表
    setMessages((prev) => [...prev, message]);

    // 发送消息
    wsRef.current.sendMessage(id, inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  if (!consultation) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-bold">{consultation.doctor?.name}</h1>
          <p className="text-sm text-gray-500">{consultation.doctor?.department}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </header>

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

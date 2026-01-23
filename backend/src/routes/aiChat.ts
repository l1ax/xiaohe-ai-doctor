import express from 'express';
import { aiChatController } from '../controllers/aiChatController';

const router = express.Router();

/**
 * GET /api/ai-chat/stream
 * Stream chat endpoint using SSE
 */
router.get('/stream', (req, res) => {
  aiChatController.streamChat(req, res);
});

/**
 * POST /api/ai-chat/conversations
 * Create a new conversation
 */
router.post('/conversations', (req, res) => {
  aiChatController.createConversation(req, res);
});

/**
 * GET /api/ai-chat/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', (req, res) => {
  aiChatController.getMessages(req, res);
});

export default router;
export { aiChatController };


import express from 'express';
import { aiChatController } from '../controllers/aiChatController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/ai-chat/stream
 * Stream chat endpoint using SSE (changed from GET to POST)
 * 
 * 关键：不要让路由处理函数立即返回，保持响应打开直到 SSE 连接真正结束
 */
router.post('/stream', authMiddleware, async (req, res) => {
  // @ts-ignore
  res._isSSE = true;
  
  try {
    await aiChatController.streamChat(req, res);
  } catch (error: any) {
    console.error('[Route] Stream chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Stream processing failed',
        data: { error: error.message }
      });
    }
  }
});

/**
 * GET /api/ai-chat/conversations
 * List conversations for the current user
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    await aiChatController.listConversations(req, res);
  } catch (error: any) {
    console.error('[Route] List conversations error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to list conversations',
        data: { error: error.message }
      });
    }
  }
});

/**
 * GET /api/ai-chat/conversations/:id
 * Get conversation with messages
 */
router.get('/conversations/:id', authMiddleware, async (req, res) => {
  try {
    await aiChatController.getConversationWithMessages(req, res);
  } catch (error: any) {
    console.error('[Route] Get conversation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get conversation',
        data: { error: error.message }
      });
    }
  }
});

/**
 * DELETE /api/ai-chat/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', authMiddleware, async (req, res) => {
  try {
    await aiChatController.deleteConversation(req, res);
  } catch (error: any) {
    console.error('[Route] Delete conversation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete conversation',
        data: { error: error.message }
      });
    }
  }
});

/**
 * POST /api/ai-chat/conversations
 * Create a new conversation
 */
router.post('/conversations', authMiddleware, (req, res) => {
  aiChatController.createConversation(req, res);
});

/**
 * GET /api/ai-chat/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', authMiddleware, (req, res) => {
  aiChatController.getMessages(req, res);
});

export default router;
export { aiChatController };

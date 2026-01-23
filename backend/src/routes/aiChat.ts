import express from 'express';
import { runAgent } from '../agent';

const router = express.Router();

router.get('/stream', async (req, res) => {
  const { message, conversationId = 'default' } = req.query;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 发送思考状态
    res.write(`data: ${JSON.stringify({ 
      type: 'thinking', 
      data: '正在分析您的问题...' 
    })}\n\n`);

    // 调用 Agent
    const result = await runAgent({
      messages: [{ role: 'user', content: message as string }],
      conversationId: conversationId as string,
    });

    // 发送意图识别结果
    res.write(`data: ${JSON.stringify({ 
      type: 'intent', 
      data: { intent: result.userIntent } 
    })}\n\n`);

    // 发送最终响应
    const finalMessage = result.messages[result.messages.length - 1];
    res.write(`data: ${JSON.stringify({ 
      type: 'content', 
      data: { content: finalMessage.content } 
    })}\n\n`);

    // 完成
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('Agent error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      data: error.message 
    })}\n\n`);
    res.end();
  }
});

export default router;

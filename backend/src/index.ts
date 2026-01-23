import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import aiChatRouter, { aiChatController } from './routes/aiChat';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Chat routes
app.use('/api/ai-chat', aiChatRouter);

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown handlers
const gracefulShutdown = (signal: string) => {
  console.log(`\n💡 Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log('📡 HTTP server closed');

    // Cleanup controller resources
    aiChatController.shutdown();

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});


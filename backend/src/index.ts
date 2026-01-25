import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'http';
import aiChatRouter, { aiChatController } from './routes/aiChat';
import authRouter from './routes/auth';
import consultationsRouter from './routes/consultations';
import appointmentsRouter from './routes/appointments';
import uploadRouter from './routes/upload';
import schedulesRouter from './routes/schedules';
import doctorsRouter from './routes/doctors';
import { wsManager } from './services/websocket/WebSocketManager';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// I4: Request logging middleware with response status and duration tracking
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    if (level === 'warn') {
      logger.warn(`${req.method} ${req.path} - ${res.statusCode}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      });
    } else {
      logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      });
    }
  });

  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Chat routes
app.use('/api/ai-chat', aiChatRouter);

// Auth routes
app.use('/api/auth', authRouter);

// Consultations routes
app.use('/api/consultations', consultationsRouter);

// Appointments routes
app.use('/api/appointments', appointmentsRouter);

// Upload routes
app.use('/api/upload', uploadRouter);

// Doctor schedules routes
app.use('/api/doctors/schedules', schedulesRouter);

// Doctor routes
app.use('/api/doctors', doctorsRouter);

// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Route not found',
    data: null,
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}) as Server;

// Initialize WebSocket server
wsManager.initialize(server);

// Graceful shutdown handlers
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');

    // Cleanup WebSocket manager
    wsManager.shutdown();

    // Cleanup controller resources
    aiChatController.shutdown();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason, { promise });
  gracefulShutdown('unhandledRejection');
});


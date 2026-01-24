// backend/src/utils/errorHandler.ts

/**
 * 自定义错误类型
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class LLMError extends AgentError {
  constructor(message: string, public originalError?: any) {
    super(message, 'LLM_ERROR', 503);
    this.name = 'LLMError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AgentError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AgentError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AgentError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 错误处理中间件
 * @deprecated This utility is currently unused. It's kept for potential future use with async route handlers.
 * If you start using it, remove this comment and document its usage in the codebase.
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return (...args: T): Promise<R> => {
    return fn(...args).catch((error) => {
      if (error instanceof AgentError) {
        throw error;
      }
      // 将未知错误包装为 AgentError
      throw new AgentError(
        error.message || 'Internal server error',
        'INTERNAL_ERROR',
        500
      );
    });
  };
}

/**
 * Express 错误处理中间件
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // C1: Use logger.error instead of console.error
  // I3: Include stack trace in structured format
  logger.error(
    'Error handled by middleware',
    {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: (err as any).code,
    },
    {
      path: req.path,
      method: req.method,
      ip: req.ip,
    }
  );

  if (err instanceof AgentError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      data: null,
    });
  } else {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      data: null,
    });
  }
}

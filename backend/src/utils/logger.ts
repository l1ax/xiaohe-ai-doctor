// backend/src/utils/logger.ts

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  conversationId?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  error(message: string, error?: any, context?: LogContext): void {
    // I3: Capture and include stack trace in structured format
    const errorData = error ? {
      message: error.message || String(error),
      stack: error.stack,
      name: error.name,
      code: error.code,
    } : {};

    console.error(
      this.formatMessage(LogLevel.ERROR, message, context),
      JSON.stringify(errorData)
    );
  }

  agent(message: string, context?: LogContext): void {
    console.log(`🤖 ${message}`, context || '');
  }

  tool(tool: string, status: string, context?: LogContext): void {
    const icon = this.getToolIcon(tool);
    console.log(`${icon} [${tool}] ${status}`, context || '');
  }

  private getToolIcon(tool: string): string {
    const icons: Record<string, string> = {
      coze_knowledge: '📚',
      web_search: '🔍',
      hospital_query: '🏥',
      medicine_query: '💊',
      ocr: '📷',
      symptom_analysis: '🩺',
    };
    return icons[tool] || '🔧';
  }
}

export const logger = new Logger();

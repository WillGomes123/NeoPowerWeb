// Logger utility for structured logging in development and production

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogOptions {
  context?: string;
  data?: unknown;
}

const isDevelopment = import.meta.env.MODE === 'development';

class Logger {
  private log(level: LogLevel, message: string, options?: LogOptions): void {
    const timestamp = new Date().toISOString();
    const context = options?.context ? `[${options.context}]` : '';
    const logMessage = `${timestamp} ${context} ${message}`;

    // In production, only log errors to console
    if (!isDevelopment && level !== 'error') {
      return;
    }

    switch (level) {
      case 'error':
        console.error(logMessage, options?.data ?? '');
        break;
      case 'warn':
        console.warn(logMessage, options?.data ?? '');
        break;
      case 'info':
      case 'debug':
        // eslint-disable-next-line no-console
        console.log(logMessage, options?.data ?? '');
        break;
    }
  }

  info(message: string, options?: LogOptions): void {
    this.log('info', message, options);
  }

  warn(message: string, options?: LogOptions): void {
    this.log('warn', message, options);
  }

  error(message: string, options?: LogOptions): void {
    this.log('error', message, options);
  }

  debug(message: string, options?: LogOptions): void {
    this.log('debug', message, options);
  }
}

export const logger = new Logger();

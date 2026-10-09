import { createLogger, format, transports } from 'winston';
import { env } from './index';

const { combine, timestamp, printf, colorize, align } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        align(),
        logFormat
      ),
    }),
    // Add other transports for production (e.g., file, daily rotate file, external logging service)
    // new transports.File({ filename: 'error.log', level: 'error' }),
    // new transports.File({ filename: 'combined.log' }),
  ],
  exceptionHandlers: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        align(),
        logFormat
      ),
    }),
    // new transports.File({ filename: 'exceptions.log' }),
  ],
  rejectionHandlers: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        align(),
        logFormat
      ),
    }),
    // new transports.File({ filename: 'rejections.log' }),
  ],
});

export default logger;

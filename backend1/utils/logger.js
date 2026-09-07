/**
 * Simple structured console logger with timestamps and levels
 */
const logger = {
  info: (msg, meta = '') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO]: ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta = '') => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]: ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  error: (msg, error = '') => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]: ${msg}`, error instanceof Error ? error.stack || error.message : error);
  },
  debug: (msg, meta = '') => {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      console.debug(`[${timestamp}] [DEBUG]: ${msg}`, meta ? JSON.stringify(meta) : '');
    }
  }
};

module.exports = logger;

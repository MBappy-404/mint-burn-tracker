export const logger = {
  info: (...args) => console.log(`[${new Date().toISOString()}] \x1b[32m[INFO]\x1b[0m`, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}] \x1b[33m[WARN]\x1b[0m`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] \x1b[31m[ERROR]\x1b[0m`, ...args),
  debug: (...args) => {
    if (process.env.DEBUG) {
      console.log(`[${new Date().toISOString()}] \x1b[36m[DEBUG]\x1b[0m`, ...args);
    }
  },
  event: (type, text) => {
    const color = type === 'MINT' ? '\x1b[32m' : '\x1b[31m';
    console.log(`[${new Date().toISOString()}] ${color}[${type}]\x1b[0m ${text}`);
  }
};

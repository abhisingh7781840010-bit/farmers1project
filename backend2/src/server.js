import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import app from './app.js';
import { initDb } from './db/connection.js';

// Always load .env from backend2/ directory, regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 5000;

// Ensure database schema is initialized
try {
  initDb();
} catch (e) {
  console.error('Database initialization warning:', e.message);
}

const server = app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🌾 e-KisanSetu Farmer Procurement & Queue Management Backend`);
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`📖 Interactive Swagger API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`📡 Real-Time SSE Stream: http://localhost:${PORT}/api/v1/events`);
  console.log(`=============================================================\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down backend server...');
  server.close(() => {
    console.log('Server closed. Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default server;

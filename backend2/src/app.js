import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import centersRouter from './routes/centers.routes.js';
import farmerRouter from './routes/farmer.routes.js';
import procurementRouter from './routes/procurement.routes.js';
import notificationsRouter from './routes/notifications.routes.js';
import authRouter from './routes/auth.routes.js';
import eventsRouter from './routes/events.routes.js';
import mlRouter from './routes/ml.routes.js';
import adminRouter from './routes/admin.routes.js';
import mandiRouter from './routes/mandi.routes.js';
import schedulesRouter from './routes/schedules.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Standard middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend statically from frontend1 and frontend3 directories
const frontendDir = path.resolve(__dirname, '../../frontend1');
const frontend3Dir = path.resolve(__dirname, '../../frontend3');
app.use(express.static(frontendDir));
app.use('/frontend3', express.static(frontend3Dir));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.originalUrl.startsWith('/events')) {
      console.log(`ðŸ“¡ [${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'e-KisanSetu Queue Management & Procurement Backend',
    timestamp: new Date().toISOString(),
    database: 'SQLite (node:sqlite WAL mode)'
  });
});

// OpenAPI & Swagger Documentation
try {
  const swaggerDocument = YAML.load(path.resolve(__dirname, '../docs/openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/api-docs.json', (req, res) => res.json(swaggerDocument));
} catch (e) {
  console.warn('âš ï¸ Swagger UI could not be loaded:', e.message);
}

// 1. Versioned API Routes (/api/v1/...)
app.use('/api/v1/centers', centersRouter);
app.use('/api/v1/farmer', farmerRouter);
app.use('/api/v1/procurement', procurementRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/ml', mlRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/schedules', schedulesRouter);

// 2. Direct Root Route Aliases (Directly matching required specifications)
app.use('/centers', centersRouter);
app.use('/farmer', farmerRouter);
app.use('/procurement', procurementRouter);
app.use('/notifications', notificationsRouter);
app.use('/auth', authRouter);
app.use('/events', eventsRouter);
app.use('/ml', mlRouter);
app.use('/admin', adminRouter);
app.use('/schedules', schedulesRouter);
app.use('/api/v1/mandi', mandiRouter);

// Centralized error and 404 handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

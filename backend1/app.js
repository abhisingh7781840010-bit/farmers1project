const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/config');

// Routes
const centerRoutes = require('./routes/centerRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const procurementRoutes = require('./routes/procurementRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const authRoutes = require('./routes/authRoutes');

// Middlewares
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const ApiResponse = require('./utils/apiResponse');

const path = require('path');

const app = express();

// Global CORS Middleware - Supports credentials with dynamic origin reflection
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests from all origins (localhost:3000, localhost:5173, etc.) or no origin (like mobile/curl)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend statically
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

if (config.env === 'development') {
  app.use(morgan('dev'));
}

// Health Check
const healthHandler = (req, res) => {
  return ApiResponse.success(res, 'Smart Agricultural Procurement System API is operational', {
    environment: config.env,
    timestamp: new Date().toISOString(),
    mlServiceConfig: config.mlService
  });
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// Mount API Routes (Both root paths and /api/v1/ paths for compatibility)
app.use('/centers', centerRoutes);
app.use('/api/v1/centers', centerRoutes);

app.use('/farmer', farmerRoutes);
app.use('/api/v1/farmer', farmerRoutes);

app.use('/procurement', procurementRoutes);
app.use('/api/v1/procurement', procurementRoutes);

app.use('/schedules', scheduleRoutes);
app.use('/api/v1/schedules', scheduleRoutes);

app.use('/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

// Catch 404 and forward to Central Error Handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;

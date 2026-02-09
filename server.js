require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const routes = require('./routes/routes.js');
const { initializeWebSocket } = require('./websocket/socketHandler.js');
const { redisClient, redisSubscriber } = require('./config/redis.js');
const { testConnection, syncDatabase, sequelize } = require('./config/database.js');
const cacheService = require('./services/cacheService');
const commonPhrases = require('./config/commonPhrases');
const prisma = require('./config/prismaClient');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware - Increase payload limit for image uploads
const corsOriginEnv = process.env.CORS_ORIGIN;
const corsOrigins = !corsOriginEnv || corsOriginEnv === '*'
    ? '*'
    : corsOriginEnv.split(',').map(origin => origin.trim());

app.use(cors({
    origin: corsOrigins,
    credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/', routes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: status === 500 ? 'Server error' : err.message
    });
});

// Initialize WebSocket handlers
initializeWebSocket(io);

// Redis connection
redisClient.on('connect', () => {
    console.log('✓ Redis client connected');
});

redisClient.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Redis not available, running in degraded mode');
        cacheService.enabled = false;
    } else {
        console.error('Redis client error:', err);
    }
});

redisSubscriber.on('connect', () => {
    console.log('✓ Redis subscriber connected');
});

redisSubscriber.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
        console.error('Redis subscriber error:', err);
    }
});

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, closing connections...`);
    try {
        await redisClient.quit();
        await redisSubscriber.quit();
        await prisma.$disconnect();
        await sequelize.close();
    } catch (error) {
        console.error('Shutdown error:', error);
    }

    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function startServer() {
    try {
        // Connect to PostgreSQL
        const dbConnected = await testConnection();
        
        if (dbConnected) {
            await syncDatabase();
        }

        server.listen(PORT, async () => {
            console.log(`
╔════════════════════════════════════════════╗
║   Universal Translator Server              ║
╠════════════════════════════════════════════╣
║   Port: ${PORT}                              ║
║   URL: http://localhost:${PORT}              ║
║   WebSocket: ✓ Active                      ║
║   Redis: ${cacheService.enabled ? '✓ Connected' : '✗ Disconnected'}                    ║
║   PostgreSQL: ${dbConnected ? '✓ Connected' : '✗ Disconnected'}               ║
╚════════════════════════════════════════════╝
            `);

            // Preload common phrases into cache
            if (cacheService.enabled) {
                try {
                    await cacheService.preloadCommon(commonPhrases);
                } catch (error) {
                    console.error('Failed to preload common phrases:', error);
                }
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

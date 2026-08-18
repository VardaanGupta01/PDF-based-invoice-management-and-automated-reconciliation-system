require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const authRoute = require('./routes/authRoute');
const settingsRoute = require('./routes/settingsRoute');
const invoiceRoute = require('./routes/invoiceRoute');
const bankStatementRoute = require('./routes/bankStatementRoute');
const statsRoute = require('./routes/statsRoute');
const initSchema = require('./config/initSchema');
const { getEnvConfig } = require('./config/env');
const db = require('./config/db');

const ledgerRoute = require('./routes/ledgerRoute');
const reconciliationRoute = require('./routes/reconciliationRoute');
const teamRoute = require('./routes/teamRoute');


const app = express();

// Render and other reverse proxies set X-Forwarded-* headers.
// Trust first proxy hop so rate limit + client IP logic behave correctly.
app.set('trust proxy', 1);

const uploadsRoot = path.join(process.cwd(), 'uploads');
fs.mkdirSync(path.join(uploadsRoot, 'invoices'), { recursive: true });
fs.mkdirSync(path.join(uploadsRoot, 'bank_statements'), { recursive: true });

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        const { corsOrigins } = getEnvConfig();

        if (!origin) {
            callback(null, true);
            return;
        }

        if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadsRoot));

// Basic health check route — also pings the DB to keep Aiven alive
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: 'UP', message: 'API is running', db: 'connected' });
    } catch (err) {
        console.error('Health check DB ping failed:', err.message);
        res.status(503).json({ status: 'DEGRADED', message: 'API is running but DB is unreachable', db: 'disconnected' });
    }
});
// Routes
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/settings', settingsRoute);
app.use('/api/v1/invoice', invoiceRoute);
app.use('/api/v1/ledger', ledgerRoute);
app.use('/api/v1/bank-statement', bankStatementRoute);
app.use('/api/v1/stats', statsRoute);
app.use('/api/v1/reconciliation', reconciliationRoute);
app.use('/api/v1/team', teamRoute);

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: `Upload error: ${err.message}` });
    }

    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        getEnvConfig();
        await initSchema();
        console.log('Database initialized successfully.');
    } catch (error) {
        console.error('Server configuration/startup error:', error.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

startServer();

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

let cachedConfig;

const parseCsvList = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getEnvConfig = () => {
    if (cachedConfig) {
        return cachedConfig;
    }

    const requiredVariables = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'JWT_SECRET'];
    const missingVariables = requiredVariables.filter((name) => !process.env[name]);

    if (missingVariables.length > 0) {
        const error = new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
        error.code = 'MISSING_ENV_VARS';
        throw error;
    }

    cachedConfig = {
        port: Number(process.env.PORT) || 3000,
        jwtSecret: String(process.env.JWT_SECRET || '').trim(),
        mysql: {
            host: String(process.env.MYSQL_HOST || '').trim(),
            port: Number(process.env.MYSQL_PORT),
            user: String(process.env.MYSQL_USER || '').trim(),
            password: String(process.env.MYSQL_PASSWORD || '').trim(),
            database: String(process.env.MYSQL_DATABASE || '').trim(),
            ssl: {
                rejectUnauthorized: false
            }
        },
        corsOrigins: parseCsvList(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || process.env.FRONTEND_URL),
        frontendOrigin: process.env.FRONTEND_ORIGIN || '',
        frontendBaseUrl: process.env.VITE_API_BASE_URL || process.env.FRONTEND_API_BASE_URL || '',
        uploadsRoot: process.env.UPLOADS_DIR || process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
        cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET
        }
    };

    cachedConfig.uploadDirs = {
        invoices: path.join(cachedConfig.uploadsRoot, 'invoices'),
        bankStatements: path.join(cachedConfig.uploadsRoot, 'bank_statements')
    };

    return cachedConfig;
};

const getConfigValue = (key) => getEnvConfig()[key];

module.exports = {
    getEnvConfig,
    get jwtSecret() {
        return getConfigValue('jwtSecret');
    },
    get mysql() {
        return getConfigValue('mysql');
    },
    get corsOrigins() {
        return getConfigValue('corsOrigins');
    },
    get frontendOrigin() {
        return getConfigValue('frontendOrigin');
    },
    get frontendBaseUrl() {
        return getConfigValue('frontendBaseUrl');
    },
    get uploadsRoot() {
        return getConfigValue('uploadsRoot');
    },
    get uploadDirs() {
        return getConfigValue('uploadDirs');
    },
    get port() {
        return getConfigValue('port');
    },
    get cloudinary() {
        return getConfigValue('cloudinary');
    }
};
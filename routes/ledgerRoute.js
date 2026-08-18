const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ledgerController = require('../controller/ledgerController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/rbacMiddleware');
const { uploadDirs } = require('../config/env');

// ─── Multer setup for ledger file uploads ────────────────────────────────────
const storage = multer.memoryStorage();

const sanitizeFilename = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);

const fileFilter = (req, file, cb) => {
    file.originalname = sanitizeFilename(file.originalname || '');
    const allowed = ['.pdf', '.csv', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, CSV, XLS, and XLSX files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB per file
});

const parseLedgerUpload = (req, res, next) => {
    const fieldsUpload = upload.fields([
        { name: 'files', maxCount: 10 },
        { name: 'invoice', maxCount: 10 },
        { name: 'file', maxCount: 10 }
    ]);

    fieldsUpload(req, res, (err) => {
        if (err) return next(err);

        const groupedFiles = req.files || {};
        req.files = [
            ...(groupedFiles.files || []),
            ...(groupedFiles.invoice || []),
            ...(groupedFiles.file || [])
        ];

        next();
    });
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// Get all ledgers for the user's active business
router.get('/', authMiddleware, ledgerController.getLedgers);

// Get a single ledger by ID
router.get('/:id', authMiddleware, ledgerController.getLedgerById);

// Create a new ledger (metadata only, no files)
router.post('/', authMiddleware, checkRole(['admin', 'accountant']), ledgerController.createLedger);

// Upload files to an existing ledger (up to 10 files at once)
router.post('/:id/files', authMiddleware, checkRole(['admin', 'accountant']), parseLedgerUpload, ledgerController.uploadLedgerFiles);

// Get all files for a ledger
router.get('/:id/files', authMiddleware, ledgerController.getLedgerFiles);

// Get all records for a ledger
router.get('/:id/records', authMiddleware, ledgerController.getLedgerRecords);

// Update a single ledger record field
router.put('/record/:recordId', authMiddleware, checkRole(['admin', 'accountant']), ledgerController.updateLedgerRecord);

// Delete a single ledger record
router.delete('/record/:recordId', authMiddleware, checkRole(['admin', 'accountant']), ledgerController.deleteLedgerRecord);

// Delete a ledger
router.delete('/:id', authMiddleware, checkRole(['admin', 'accountant']), ledgerController.deleteLedger);

module.exports = router;

const path = require('path');
const LedgerModel = require('../model/ledgerModel');
const BusinessModel = require('../model/businessModel');
const AccountModel = require('../model/accountModel');
const { parsePdf } = require('../parsing/parser');
const { uploadToCloudinary } = require('../config/cloudinary');
const { logAudit } = require('../utils/auditLogger');
const { getActiveBusinessId } = require('../utils/businessHelper');

// Helper to extract userId consistently (JWT payload uses `userId`)
const getUserId = (req) => req.user.userId || req.user.id;

// ─── GET /api/v1/ledger ──────────────────────────────────────────────────────
// Returns all ledgers for the logged-in user's first (or active) business.
const getLedgers = async (req, res) => {
    try {
        const activeBusinessId = await getActiveBusinessId(req);

        if (!activeBusinessId) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No active business found for this user'
            });
        }

        const ledgers = await LedgerModel.findByBusinessId(activeBusinessId);

        const formattedLedgers = ledgers.map(ledger => ({
            id: ledger.id,
            bankAccountId: ledger.bank_account_id,
            targetMonth: ledger.target_month,
            targetYear: ledger.target_year,
            bankAccount: [
                ledger.bank_name,
                ledger.account_nickname ? `(${ledger.account_nickname})` : '',
                ledger.account_last_four ? `•••• ${ledger.account_last_four}` : ''
            ].filter(Boolean).join(' '),
            month: getMonthName(ledger.target_month),
            year: ledger.target_year.toString(),
            entries: Number(ledger.entries) || 0,
            createdAt: formatDate(ledger.created_at)
        }));

        res.status(200).json({ success: true, data: formattedLedgers });

    } catch (error) {
        console.error('Error fetching ledgers:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching ledgers' });
    }
};

// ─── GET /api/v1/ledger/:id ──────────────────────────────────────────────────
const getLedgerById = async (req, res) => {
    try {
        const ledger = await LedgerModel.findById(req.params.id);

        if (!ledger) {
            return res.status(404).json({ success: false, message: 'Ledger not found' });
        }

        res.status(200).json({ success: true, data: ledger });
    } catch (error) {
        console.error('Error fetching ledger:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── POST /api/v1/ledger ─────────────────────────────────────────────────────
const createLedger = async (req, res) => {
    try {
        const { bankAccountId, targetMonth, targetYear } = req.body;

        if (!bankAccountId || !targetMonth || !targetYear) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: bankAccountId, targetMonth, targetYear'
            });
        }

        const activeBusinessId = await getActiveBusinessId(req);
        if (!activeBusinessId) {
            return res.status(400).json({
                success: false,
                message: 'No active business found. Please select or create a business in Settings.'
            });
        }

        // Verify bank account belongs to active business
        const bankAccount = await AccountModel.findByIdAndBusinessId(bankAccountId, activeBusinessId);
        if (!bankAccount) {
            return res.status(400).json({
                success: false,
                message: 'Selected bank account does not belong to your currently active business.'
            });
        }

        const ledgerId = await LedgerModel.create(bankAccountId, targetMonth, targetYear);

        res.status(201).json({
            success: true,
            message: 'Ledger created successfully',
            ledgerId
        });
    } catch (error) {
        console.error('Error creating ledger:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'A ledger already exists for this bank account in the specified period'
            });
        }

        res.status(500).json({ success: false, message: 'Server error while creating ledger' });
    }
};

// ─── POST /api/v1/ledger/:id/files ───────────────────────────────────────────
// Accepts multiple files (multer `array`), stores each in ledger_files.
// PDFs are automatically parsed and their data inserted as ledger_records.
const uploadLedgerFiles = async (req, res) => {
    try {
        const ledgerId = req.params.id;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        // Verify the ledger exists
        const ledger = await LedgerModel.findById(ledgerId);
        if (!ledger) {
            return res.status(404).json({ success: false, message: 'Ledger not found' });
        }

        const savedFiles = [];

        for (const file of req.files) {
            // Determine file type from extension
            const ext = path.extname(file.originalname).toLowerCase();
            const fileType = (ext === '.pdf') ? 'invoice_pdf' : 'excel_ledger';

            let fileUrl = '';
            let cloudinaryId = null;

            // Attempt Cloudinary upload first, fallback to local storage if unconfigured or fails
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL) {
                    const cloudinaryResult = await uploadToCloudinary(file.buffer, {
                        folder: fileType === 'invoice_pdf' ? 'invoices' : 'ledgers',
                        resource_type: ext === '.pdf' ? 'raw' : 'auto'
                    });
                    fileUrl = cloudinaryResult.secure_url;
                    cloudinaryId = cloudinaryResult.public_id;
                } else {
                    throw new Error('Cloudinary not configured');
                }
            } catch (cloudErr) {
                console.warn('[Ledger Upload] Cloudinary upload failed or unconfigured, using local file storage fallback:', cloudErr.message);
                const fs = require('fs');
                const { uploadDirs } = require('../config/env');
                const targetDir = fileType === 'invoice_pdf' ? uploadDirs.invoices : uploadDirs.bankStatements;
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                const fileName = `${Date.now()}_${file.originalname}`;
                const localPath = path.join(targetDir, fileName);
                fs.writeFileSync(localPath, file.buffer);
                fileUrl = `/uploads/${fileType === 'invoice_pdf' ? 'invoices' : 'bank_statements'}/${fileName}`;
            }

            const fileId = await LedgerModel.addFile(ledgerId, fileUrl, fileType);

            const fileResult = {
                id: fileId,
                originalName: file.originalname,
                fileUrl,
                cloudinaryId,
                fileType,
                size: file.size,
                records: []
            };

            // If it's a PDF, parse it directly from RAM buffer and insert records
            if (ext === '.pdf') {
                try {
                    const invoiceRecords = await parsePdf(file.buffer);
                    const insertedIds = await LedgerModel.addRecords(ledgerId, fileId, invoiceRecords);
                    fileResult.records = invoiceRecords.map((record, i) => ({
                        recordId: insertedIds[i],
                        ...record
                    }));
                    console.log(`[Ledger] Parsed ${invoiceRecords.length} record(s) from ${file.originalname}`);
                } catch (parseError) {
                    console.error(`[Ledger] Failed to parse ${file.originalname}:`, parseError);
                    fileResult.parseError = 'PDF parsing failed, file was saved but records could not be extracted';
                }
            }

            savedFiles.push(fileResult);
        }

        const totalRecords = savedFiles.reduce((sum, f) => sum + f.records.length, 0);

        await logAudit(req, {
            businessId: ledger ? (ledger.business_id || ledger.businessId || null) : null,
            action: 'UPLOAD_LEDGER',
            entityType: 'ledger_file',
            entityId: ledgerId,
            details: { filesCount: savedFiles.length, recordsExtracted: totalRecords }
        });

        res.status(201).json({
            success: true,
            message: `${savedFiles.length} file(s) uploaded, ${totalRecords} record(s) extracted`,
            files: savedFiles
        });

    } catch (error) {
        console.error('Error uploading ledger files:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error during file upload'
        });
    }
};

// ─── GET /api/v1/ledger/:id/files ────────────────────────────────────────────
const getLedgerFiles = async (req, res) => {
    try {
        const files = await LedgerModel.getFiles(req.params.id);
        res.status(200).json({ success: true, data: files });
    } catch (error) {
        console.error('Error fetching ledger files:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── GET /api/v1/ledger/:id/records ──────────────────────────────────────────
const getLedgerRecords = async (req, res) => {
    try {
        const records = await LedgerModel.getRecords(req.params.id);
        res.status(200).json({ success: true, data: records });
    } catch (error) {
        console.error('Error fetching ledger records:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── DELETE /api/v1/ledger/:id ───────────────────────────────────────────────
const deleteLedger = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const businesses = await BusinessModel.findByUserId(userId);
        if (!businesses || businesses.length === 0) {
            return res.status(404).json({ message: 'No business found for this user' });
        }

        const affectedRows = await LedgerModel.delete(id, businesses[0].id);

        if (affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ledger not found or you are not authorized to delete it'
            });
        }

        await logAudit(req, {
            businessId: businesses[0].id,
            action: 'DELETE_LEDGER',
            entityType: 'ledger',
            entityId: id
        });

        res.status(200).json({ success: true, message: 'Ledger deleted successfully' });
    } catch (error) {
        console.error('Error deleting ledger:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── PUT /api/v1/ledger/record/:recordId ─────────────────────────────────────
// Allows the frontend to patch a single field on a ledger record
const updateLedgerRecord = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { field, value } = req.body;

        const ALLOWED_FIELDS = ['transaction_id', 'transaction_date', 'amount', 'transaction_type', 'description'];
        if (!ALLOWED_FIELDS.includes(field)) {
            return res.status(400).json({ success: false, message: `Field '${field}' cannot be updated` });
        }

        const db = require('../config/db');
        const [result] = await db.execute(
            `UPDATE ledger_records SET ${field} = ? WHERE id = ?`,
            [value, recordId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        res.status(200).json({ success: true, message: 'Record updated' });
    } catch (error) {
        console.error('Error updating ledger record:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── DELETE /api/v1/ledger/record/:recordId ──────────────────────────────────
const deleteLedgerRecord = async (req, res) => {
    try {
        const { recordId } = req.params;
        const affectedRows = await LedgerModel.deleteRecord(recordId);

        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Ledger record not found' });
        }

        await logAudit(req, {
            action: 'DELETE_INVOICE_RECORD',
            entityType: 'ledger_record',
            entityId: recordId
        });

        res.status(200).json({ success: true, message: 'Ledger record deleted successfully' });
    } catch (error) {
        console.error('Error deleting ledger record:', error);
        res.status(500).json({ success: false, message: 'Server error while deleting record' });
    }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonthName(monthNum) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNum - 1] || '';
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: '2-digit'
    });
}

module.exports = {
    getLedgers,
    getLedgerById,
    createLedger,
    uploadLedgerFiles,
    getLedgerFiles,
    getLedgerRecords,
    updateLedgerRecord,
    deleteLedgerRecord,
    deleteLedger
};

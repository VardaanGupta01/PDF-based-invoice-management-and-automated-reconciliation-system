const db = require('../config/db');

class LedgerModel {
    // Get all ledgers for a business with bank account details and file counts as "entries"
    static async findByBusinessId(businessId) {
        const [rows] = await db.execute(
            `SELECT
                l.id,
                l.bank_account_id,
                l.target_month,
                l.target_year,
                l.created_at,
                ba.bank_name,
                ba.account_nickname,
                ba.account_last_four,
                COUNT(lr.id) AS entries
            FROM ledgers l
            JOIN bank_accounts ba ON l.bank_account_id = ba.id
            LEFT JOIN ledger_records lr ON l.id = lr.ledger_id
            WHERE ba.business_id = ?
            GROUP BY l.id, l.bank_account_id, l.target_month, l.target_year, l.created_at,
                     ba.bank_name, ba.account_nickname, ba.account_last_four
            ORDER BY l.created_at DESC`,
            [businessId]
        );
        return rows;
    }

    // Create a new ledger
    static async create(bankAccountId, targetMonth, targetYear) {
        const [result] = await db.execute(
            'INSERT INTO ledgers (bank_account_id, target_month, target_year) VALUES (?, ?, ?)',
            [bankAccountId, targetMonth, targetYear]
        );
        return result.insertId;
    }

    // Get a single ledger by ID with related data
    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT
                l.id,
                l.bank_account_id,
                ba.business_id,
                l.target_month,
                l.target_year,
                l.created_at,
                ba.bank_name,
                ba.account_nickname,
                ba.account_last_four,
                COUNT(lr.id) AS entries
            FROM ledgers l
            JOIN bank_accounts ba ON l.bank_account_id = ba.id
            LEFT JOIN ledger_records lr ON l.id = lr.ledger_id
            WHERE l.id = ?
            GROUP BY l.id, l.bank_account_id, ba.business_id, l.target_month, l.target_year, l.created_at,
                     ba.bank_name, ba.account_nickname, ba.account_last_four`,
            [id]
        );
        return rows[0] || null;
    }

    // Delete a ledger (with business ownership check)
    static async delete(id, businessId) {
        const [result] = await db.execute(
            `DELETE l FROM ledgers l
             JOIN bank_accounts ba ON l.bank_account_id = ba.id
             WHERE l.id = ? AND ba.business_id = ?`,
            [id, businessId]
        );
        return result.affectedRows;
    }

    // Store uploaded file record in ledger_files
    static async addFile(ledgerId, filePath, fileType) {
        const [result] = await db.execute(
            'INSERT INTO ledger_files (ledger_id, file_path, file_type) VALUES (?, ?, ?)',
            [ledgerId, filePath, fileType]
        );
        return result.insertId;
    }

    // Get all files for a ledger
    static async getFiles(ledgerId) {
        const [rows] = await db.execute(
            'SELECT * FROM ledger_files WHERE ledger_id = ? ORDER BY created_at DESC',
            [ledgerId]
        );
        return rows;
    }

    // Insert a single ledger record (from parsed invoice data)
    static async addRecord(ledgerId, ledgerFileId, record) {
        const [result] = await db.execute(
            `INSERT INTO ledger_records 
             (ledger_id, ledger_file_id, transaction_id, transaction_date, amount, transaction_type, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                ledgerId,
                ledgerFileId,
                record.transaction_id,
                record.transaction_date,
                record.amount || 0.00,
                record.transaction_type,
                record.description
            ]
        );
        return result.insertId;
    }

    // Insert multiple ledger records in bulk (from multi-page PDF)
    static async addRecords(ledgerId, ledgerFileId, records) {
        const insertedIds = [];
        for (const record of records) {
            // Skip unparsed/orphan records missing both transaction_id and valid amount/description
            if (!record.transaction_id && (!record.amount || Number(record.amount) === 0) && !record.description) continue;
            
            // Default transaction_date to today if missing so valid records are not silently dropped
            if (!record.transaction_date) {
                record.transaction_date = new Date().toISOString().split('T')[0];
            }

            const id = await this.addRecord(ledgerId, ledgerFileId, record);
            insertedIds.push(id);
        }
        return insertedIds;
    }

    // Get all records for a given ledger
    static async getRecords(ledgerId) {
        const [rows] = await db.execute(
            `SELECT 
                lr.id,
                lr.transaction_id,
                lr.is_reconciled,
                lr.transaction_date,
                lr.amount,
                lr.transaction_type,
                lr.description,
                lf.file_path,
                lf.file_type
             FROM ledger_records lr
             LEFT JOIN ledger_files lf ON lr.ledger_file_id = lf.id
             WHERE lr.ledger_id = ?
             ORDER BY lr.transaction_date DESC, lr.id ASC`,
            [ledgerId]
        );
        return rows;
    }

    // Delete a single ledger record by ID
    static async deleteRecord(recordId) {
        const [result] = await db.execute(
            'DELETE FROM ledger_records WHERE id = ?',
            [recordId]
        );
        return result.affectedRows;
    }
}

module.exports = LedgerModel;

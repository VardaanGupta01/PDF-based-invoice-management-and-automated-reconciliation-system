const db = require('../config/db');

class AccountModel {
    static async create(businessId, bankName, accountNickname, accountLastFour) {
        const [result] = await db.execute(
            'INSERT INTO bank_accounts (business_id, bank_name, account_nickname, account_last_four) VALUES (?, ?, ?, ?)',
            [businessId, bankName, accountNickname, accountLastFour]
        );
        return result.insertId;
    }

    static async findByUserId(userId) {
        const [rows] = await db.execute(
            `SELECT ba.* FROM bank_accounts ba 
             JOIN businesses b ON ba.business_id = b.id 
             WHERE b.user_id = ?`,
            [userId]
        );
        return rows;
    }

    // NEW — bank accounts for owned AND shared (accountant/viewer/admin) businesses
    static async findAccessibleByUserId(userId) {
        const [rows] = await db.execute(
            `SELECT ba.* FROM bank_accounts ba
             JOIN businesses b ON ba.business_id = b.id
             LEFT JOIN user_business_roles ubr ON ubr.business_id = b.id AND ubr.user_id = ?
             WHERE b.user_id = ? OR ubr.user_id IS NOT NULL`,
            [userId, userId]
        );
        return rows;
    }

    static async findByBusinessId(businessId) {
        const [rows] = await db.execute(
            'SELECT * FROM bank_accounts WHERE business_id = ?',
            [businessId]
        );
        return rows;
    }

    static async findByIdAndBusinessId(accountId, businessId) {
        const [rows] = await db.execute(
            'SELECT * FROM bank_accounts WHERE id = ? AND business_id = ?',
            [accountId, businessId]
        );
        return rows[0] || null;
    }

    // FIXED — was owner-only, so an invited "accountant" could never actually
    // delete a bank account even though checkRole(['admin','accountant']) let the request through.
    // It "succeeded" with 0 affected rows and lied to the user.
    static async delete(id, userId) {
        const [result] = await db.execute(
            `DELETE ba FROM bank_accounts ba
             JOIN businesses b ON ba.business_id = b.id
             LEFT JOIN user_business_roles ubr ON ubr.business_id = b.id AND ubr.user_id = ?
             WHERE ba.id = ? AND (b.user_id = ? OR ubr.role = 'accountant')`,
            [userId, id, userId]
        );
        return result.affectedRows;
    }
}

module.exports = AccountModel;
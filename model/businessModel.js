const db = require('../config/db');

class BusinessModel {
    static async create(userId, businessName) {
        const [result] = await db.execute(
            'INSERT INTO businesses (user_id, business_name) VALUES (?, ?)',
            [userId, businessName]
        );
        return result.insertId;
    }

    static async findByUserId(userId) {
        const [rows] = await db.execute('SELECT * FROM businesses WHERE user_id = ?', [userId]);
        return rows;
    }

    // NEW — owned businesses + businesses shared via an accepted invitation
    static async findAccessibleByUserId(userId) {
        const [rows] = await db.execute(
            `SELECT b.*,
                    (b.user_id = ?) AS is_owner,
                    COALESCE(ubr.role, IF(b.user_id = ?, 'accountant', NULL)) AS role
             FROM businesses b
             LEFT JOIN user_business_roles ubr ON ubr.business_id = b.id AND ubr.user_id = ?
             WHERE b.user_id = ? OR ubr.user_id IS NOT NULL
             ORDER BY b.created_at DESC`,
            [userId, userId, userId, userId]
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM businesses WHERE id = ?', [id]);
        return rows[0] || null;
    }

    static async delete(id, userId) {
        const [result] = await db.execute('DELETE FROM businesses WHERE id = ? AND user_id = ?', [id, userId]);
        return result.affectedRows;
    }
}

module.exports = BusinessModel;
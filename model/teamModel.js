const db = require('../config/db');

class TeamModel {
    /**
     * Resolves the user's role for a specific business.
     * System admins always evaluate to 'admin'.
     * Business creators default to 'accountant'.
     */
    static async getUserRole(userId, businessId) {
        // 1. Check if user is system admin
        const [userRows] = await db.execute('SELECT is_system_admin FROM users WHERE id = ?', [userId]);
        if (userRows[0] && userRows[0].is_system_admin) {
            return 'admin';
        }

        if (!businessId) return null;

        // 2. Check explicitly assigned role in user_business_roles
        const [roleRows] = await db.execute(
            'SELECT role FROM user_business_roles WHERE user_id = ? AND business_id = ?',
            [userId, businessId]
        );
        if (roleRows.length > 0) {
            return roleRows[0].role;
        }

        // 3. Fallback check: If user created the business, they are the 'accountant' (owner)
        const [bizRows] = await db.execute(
            'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
            [businessId, userId]
        );
        if (bizRows.length > 0) {
            return 'accountant';
        }

        return null; // No access
    }

    /**
     * Assigns or updates a user's role for a business.
     */
    static async assignUserRole(userId, businessId, role) {
        const [result] = await db.execute(
            `INSERT INTO user_business_roles (user_id, business_id, role) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE role = VALUES(role)`,
            [userId, businessId, role]
        );
        return result;
    }

    /**
     * Creates an invitation for a user to join a business.
     */
    static async createInvitation(businessId, inviterId, email, role, token, expiresAt) {
        const [result] = await db.execute(
            `INSERT INTO invitations (business_id, inviter_user_id, email, role, token, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [businessId, inviterId, email, role, token, expiresAt]
        );
        return result.insertId;
    }

    /**
     * Retrieves pending invitations for a business.
     */
    static async getPendingInvitations(businessId) {
        const [rows] = await db.execute(
            `SELECT i.id, i.business_id, i.email, i.role, i.token, i.status, i.expires_at, i.created_at, 
                    u.username as inviter_name, b.business_name 
             FROM invitations i 
             JOIN users u ON i.inviter_user_id = u.id 
             JOIN businesses b ON i.business_id = b.id 
             WHERE i.business_id = ? AND i.status = 'pending' AND i.expires_at > NOW() 
             ORDER BY i.created_at DESC`,
            [businessId]
        );
        return rows;
    }

    /**
     * Finds an active pending invitation for an email within a business.
     */
    static async findActiveInvitationByEmail(businessId, email) {
        const [rows] = await db.execute(
            `SELECT i.*, u.username as inviter_name 
             FROM invitations i
             JOIN users u ON i.inviter_user_id = u.id
             WHERE i.business_id = ? AND LOWER(i.email) = LOWER(?) AND i.status = 'pending' AND i.expires_at > NOW()`,
            [businessId, email]
        );
        return rows[0] || null;
    }

    /**
     * Finds an invitation by its primary key ID.
     */
    static async findInvitationById(inviteId) {
        const [rows] = await db.execute(
            `SELECT i.*, b.business_name, u.username as inviter_name, u.email as inviter_email
             FROM invitations i
             JOIN businesses b ON i.business_id = b.id
             JOIN users u ON i.inviter_user_id = u.id
             WHERE i.id = ?`,
            [inviteId]
        );
        return rows[0] || null;
    }

    /**
     * Retrieves complete details about an invitation by its token.
     */
    static async getInvitationDetailsByToken(token) {
        const [rows] = await db.execute(
            `SELECT i.*, b.business_name, u.username as inviter_name, u.email as inviter_email
             FROM invitations i
             JOIN businesses b ON i.business_id = b.id
             JOIN users u ON i.inviter_user_id = u.id
             WHERE i.token = ?`,
            [token]
        );
        return rows[0] || null;
    }

    /**
     * Checks if a user identified by email is already an owner or member of a business.
     */
    static async isUserMemberOfBusiness(email, businessId) {
        const [rows] = await db.execute(
            `SELECT u.id, (b.user_id = u.id) as is_owner, ubr.role
             FROM users u
             LEFT JOIN businesses b ON b.id = ? AND b.user_id = u.id
             LEFT JOIN user_business_roles ubr ON ubr.business_id = ? AND ubr.user_id = u.id
             WHERE LOWER(u.email) = LOWER(?) AND (b.user_id = u.id OR ubr.user_id IS NOT NULL)`,
            [businessId, businessId, email]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Finds a pending invitation by its token.
     */
    static async findByInvitationToken(token) {
        const [rows] = await db.execute(
            `SELECT * FROM invitations WHERE token = ? AND status = 'pending' AND expires_at > NOW()`,
            [token]
        );
        return rows[0] || null;
    }

    /**
     * Revokes a pending invitation.
     */
    static async revokeInvitation(inviteId, businessId) {
        const [result] = await db.execute(
            `UPDATE invitations SET status = 'revoked' WHERE id = ? AND business_id = ?`,
            [inviteId, businessId]
        );
        return result.affectedRows;
    }

    /**
     * Resends an invitation with a refreshed token and expiration date.
     */
    static async resendInvitation(inviteId, businessId, newToken, newExpiresAt) {
        const [result] = await db.execute(
            `UPDATE invitations 
             SET token = ?, expires_at = ?, status = 'pending' 
             WHERE id = ? AND business_id = ?`,
            [newToken, newExpiresAt, inviteId, businessId]
        );
        return result.affectedRows;
    }

    /**
     * Accepts an invitation and links the user to the business.
     */
    static async acceptInvitation(invitationId, userId, businessId, role) {
        await db.execute('UPDATE invitations SET status = \'accepted\' WHERE id = ?', [invitationId]);
        await this.assignUserRole(userId, businessId, role);
    }

    /**
     * Gets all members assigned to a business.
     */
    static async getBusinessMembers(businessId) {
        const [rows] = await db.execute(
            `SELECT 
                u.id as user_id, 
                u.username, 
                u.email, 
                COALESCE(ubr.role, IF(b.user_id = u.id, 'accountant', 'viewer')) as role,
                (b.user_id = u.id) as is_owner
             FROM users u
             JOIN businesses b ON b.id = ?
             LEFT JOIN user_business_roles ubr ON ubr.user_id = u.id AND ubr.business_id = b.id
             WHERE b.user_id = u.id OR ubr.user_id IS NOT NULL`,
            [businessId]
        );
        return rows;
    }

    /**
     * Removes a member's access from a business.
     */
    static async removeMember(businessId, userId) {
        const [result] = await db.execute(
            'DELETE FROM user_business_roles WHERE business_id = ? AND user_id = ?',
            [businessId, userId]
        );
        return result.affectedRows;
    }

    /**
     * Retrieves audit log records.
     */
    static async getAuditLogs(businessId = null, limit = 50, offset = 0) {
        const limitNum = Number(limit) || 50;
        const offsetNum = Number(offset) || 0;

        let query = `
            SELECT a.id, a.business_id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at, u.username, u.email 
            FROM audit_logs a 
            JOIN users u ON a.user_id = u.id 
        `;
        const params = [];

        if (businessId) {
            query += ` WHERE a.business_id = ? `;
            params.push(businessId);
        }

        query += ` ORDER BY a.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    /**
     * Retrieves all pending invitations addressed to a user's email.
     */
    static async getUserInvitations(email) {
        const [rows] = await db.execute(
            `SELECT i.id, i.business_id, i.email, i.role, i.token, i.status, i.expires_at, i.created_at,
                    b.business_name, u.username as inviter_name, u.email as inviter_email
             FROM invitations i
             JOIN businesses b ON i.business_id = b.id
             JOIN users u ON i.inviter_user_id = u.id
             WHERE LOWER(i.email) = LOWER(?) AND i.status = 'pending' AND i.expires_at > NOW()
             ORDER BY i.created_at DESC`,
            [email]
        );
        return rows;
    }

    /**
     * Declines an invitation sent to a user's email.
     */
    static async declineInvitation(invitationId, email) {
        const [result] = await db.execute(
            `UPDATE invitations SET status = 'revoked' WHERE id = ? AND LOWER(email) = LOWER(?)`,
            [invitationId, email]
        );
        return result.affectedRows;
    }

    /**
     * Removes user access when a user chooses to voluntarily leave a business.
     * Business creators cannot leave (they must delete or transfer ownership).
     */
    static async leaveBusiness(businessId, userId) {
        const [bizRows] = await db.execute(
            'SELECT id FROM businesses WHERE id = ? AND user_id = ?',
            [businessId, userId]
        );
        if (bizRows.length > 0) {
            throw new Error('Business owners cannot leave their own business. Delete the business instead.');
        }

        const [result] = await db.execute(
            'DELETE FROM user_business_roles WHERE business_id = ? AND user_id = ?',
            [businessId, userId]
        );
        return result.affectedRows;
    }
}

module.exports = TeamModel;

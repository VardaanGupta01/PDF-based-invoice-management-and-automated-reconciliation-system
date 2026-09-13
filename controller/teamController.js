const crypto = require('crypto');
const TeamModel = require('../model/teamModel');
const UserModel = require('../model/userModel');
const BusinessModel = require('../model/businessModel');
const { logAudit } = require('../utils/auditLogger');
const { sendInvitationEmail } = require('../utils/emailService');
const { getEnvConfig } = require('../config/env');

const getUserId = (req) => req.user.userId || req.user.id;

/**
 * Extracts raw 64-character token even if user pasted a full URL or query string.
 */
const extractToken = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    let t = raw.trim();
    if (t.includes('token=')) {
        try {
            const urlObj = new URL(t.startsWith('http') ? t : `http://dummy.com/${t}`);
            const param = urlObj.searchParams.get('token');
            if (param) return param.trim();
        } catch (_) {
            t = t.split('token=')[1].split('&')[0].trim();
        }
    }
    return t;
};


// ─── POST /api/v1/team/invite ─────────────────────────────────────────────────
const inviteMember = async (req, res) => {
    try {
        const { businessId, email, role = 'viewer' } = req.body;
        const inviterId = getUserId(req);

        if (!businessId || !email) {
            return res.status(400).json({ message: 'Business ID and target email are required' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please provide a valid email address' });
        }

        const allowedRoles = ['accountant', 'viewer'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: "Role must be 'accountant' or 'viewer'" });
        }

        // 1. Verify business exists
        const business = await BusinessModel.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // 2. Fetch inviter information
        const inviter = await UserModel.findById(inviterId);
        if (inviter && inviter.email.toLowerCase() === normalizedEmail) {
            return res.status(400).json({ message: 'You cannot invite yourself to your own business.' });
        }

        // 3. Check if target user is already an active member or owner of this business
        const existingMember = await TeamModel.isUserMemberOfBusiness(normalizedEmail, businessId);
        if (existingMember) {
            return res.status(400).json({
                message: `User (${normalizedEmail}) is already an active ${existingMember.is_owner ? 'owner' : existingMember.role} of this business.`
            });
        }

        // 4. Check if there is already an active pending invitation
        const activeInvite = await TeamModel.findActiveInvitationByEmail(businessId, normalizedEmail);
        if (activeInvite) {
            const frontendOrigin = getEnvConfig().frontendOrigin || 'http://localhost:5173';
            const existingLink = `${frontendOrigin}/accept-invite?token=${activeInvite.token}`;
            return res.status(409).json({
                message: `An active invitation already exists for ${normalizedEmail}. You can copy the existing link or resend it.`,
                invitation: {
                    id: activeInvite.id,
                    email: activeInvite.email,
                    role: activeInvite.role,
                    token: activeInvite.token,
                    expires_at: activeInvite.expires_at,
                    inviteLink: existingLink
                }
            });
        }

        // Generate 48-hour token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const inviteId = await TeamModel.createInvitation(businessId, inviterId, normalizedEmail, role, token, expiresAt);

        const frontendOrigin = getEnvConfig().frontendOrigin || 'http://localhost:5173';
        const inviteLink = `${frontendOrigin}/accept-invite?token=${token}`;

        // Attempt sending email (graceful fallback if SMTP not configured)
        await sendInvitationEmail({
            toEmail: normalizedEmail,
            businessName: business.business_name,
            inviterName: inviter ? inviter.username : 'A team member',
            role,
            inviteLink,
            expiresAt
        });

        await logAudit(req, {
            businessId,
            action: 'INVITE_TEAM_MEMBER',
            entityType: 'invitation',
            entityId: inviteId,
            details: { email: normalizedEmail, role }
        });

        res.status(201).json({
            success: true,
            message: `Invitation generated successfully for ${normalizedEmail}`,
            invitation: {
                id: inviteId,
                business_id: businessId,
                business_name: business.business_name,
                email: normalizedEmail,
                role,
                token,
                status: 'pending',
                expires_at: expiresAt,
                created_at: new Date(),
                inviter_name: inviter ? inviter.username : 'You',
                inviteLink
            }
        });
    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ message: 'Server error creating invitation' });
    }
};

// ─── GET /api/v1/team/invitations ─────────────────────────────────────────────
const getPendingInvitations = async (req, res) => {
    try {
        const businessId = req.query.businessId;
        if (!businessId) {
            return res.status(400).json({ message: 'businessId query parameter is required' });
        }

        const invitations = await TeamModel.getPendingInvitations(businessId);
        const frontendOrigin = getEnvConfig().frontendOrigin || 'http://localhost:5173';

        const formatted = invitations.map((inv) => ({
            ...inv,
            inviteLink: `${frontendOrigin}/accept-invite?token=${inv.token}`
        }));

        res.status(200).json({ success: true, invitations: formatted });
    } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── GET /api/v1/team/invite-details/:token ───────────────────────────────────
// Public endpoint for pre-acceptance inspection
const getInviteDetails = async (req, res) => {
    try {
        const { token } = req.params;
        const cleanToken = extractToken(token);
        if (!cleanToken) {
            return res.status(400).json({ valid: false, message: 'Invitation token is required' });
        }

        const invitation = await TeamModel.getInvitationDetailsByToken(cleanToken);
        if (!invitation) {
            return res.status(404).json({ valid: false, reason: 'not_found', message: 'Invitation not found or invalid' });
        }

        if (invitation.status === 'accepted') {
            return res.status(200).json({
                valid: false,
                reason: 'already_accepted',
                message: 'This invitation has already been accepted.',
                businessName: invitation.business_name,
                email: invitation.email
            });
        }

        if (invitation.status === 'revoked') {
            return res.status(200).json({
                valid: false,
                reason: 'revoked',
                message: 'This invitation has been revoked by the business manager.',
                businessName: invitation.business_name
            });
        }

        const isExpired = new Date(invitation.expires_at) <= new Date() || invitation.status === 'expired';
        if (isExpired) {
            return res.status(200).json({
                valid: false,
                reason: 'expired',
                message: 'This invitation has expired. Please ask for a new invite.',
                businessName: invitation.business_name,
                email: invitation.email
            });
        }

        res.status(200).json({
            valid: true,
            id: invitation.id,
            businessId: invitation.business_id,
            businessName: invitation.business_name,
            email: invitation.email,
            role: invitation.role,
            inviterName: invitation.inviter_name,
            expiresAt: invitation.expires_at
        });
    } catch (error) {
        console.error('Error fetching invite details:', error);
        res.status(500).json({ valid: false, message: 'Server error checking invitation' });
    }
};

// ─── DELETE /api/v1/team/invitations/:inviteId ────────────────────────────────
const revokeInvitation = async (req, res) => {
    try {
        const { inviteId } = req.params;
        const businessId = req.query.businessId || req.body.businessId;

        const invitation = await TeamModel.findInvitationById(inviteId);
        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (businessId && Number(invitation.business_id) !== Number(businessId)) {
            return res.status(403).json({ message: 'Invitation does not belong to this business' });
        }

        await TeamModel.revokeInvitation(inviteId, invitation.business_id);

        await logAudit(req, {
            businessId: invitation.business_id,
            action: 'REVOKE_INVITATION',
            entityType: 'invitation',
            entityId: inviteId,
            details: { email: invitation.email }
        });

        res.status(200).json({ success: true, message: `Invitation for ${invitation.email} has been revoked` });
    } catch (error) {
        console.error('Error revoking invitation:', error);
        res.status(500).json({ message: 'Server error revoking invitation' });
    }
};

// ─── POST /api/v1/team/invitations/:inviteId/resend ───────────────────────────
const resendInvitation = async (req, res) => {
    try {
        const { inviteId } = req.params;
        const businessId = req.query.businessId || req.body.businessId;

        const invitation = await TeamModel.findInvitationById(inviteId);
        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (businessId && Number(invitation.business_id) !== Number(businessId)) {
            return res.status(403).json({ message: 'Invitation does not belong to this business' });
        }

        // Generate new token & 48-hour expiration
        const newToken = crypto.randomBytes(32).toString('hex');
        const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        await TeamModel.resendInvitation(inviteId, invitation.business_id, newToken, newExpiresAt);

        const frontendOrigin = getEnvConfig().frontendOrigin || 'http://localhost:5173';
        const inviteLink = `${frontendOrigin}/accept-invite?token=${newToken}`;

        const inviter = await UserModel.findById(getUserId(req));

        // Dispatch email
        await sendInvitationEmail({
            toEmail: invitation.email,
            businessName: invitation.business_name,
            inviterName: inviter ? inviter.username : invitation.inviter_name,
            role: invitation.role,
            inviteLink,
            expiresAt: newExpiresAt
        });

        await logAudit(req, {
            businessId: invitation.business_id,
            action: 'RESEND_INVITATION',
            entityType: 'invitation',
            entityId: inviteId,
            details: { email: invitation.email, role: invitation.role }
        });

        res.status(200).json({
            success: true,
            message: `Invitation resent to ${invitation.email}`,
            invitation: {
                id: invitation.id,
                business_id: invitation.business_id,
                business_name: invitation.business_name,
                email: invitation.email,
                role: invitation.role,
                token: newToken,
                status: 'pending',
                expires_at: newExpiresAt,
                created_at: invitation.created_at,
                inviter_name: inviter ? inviter.username : invitation.inviter_name,
                inviteLink
            }
        });
    } catch (error) {
        console.error('Error resending invitation:', error);
        res.status(500).json({ message: 'Server error resending invitation' });
    }
};

// ─── POST /api/v1/team/accept-invite ──────────────────────────────────────────
const acceptInvite = async (req, res) => {
    try {
        const { token, inviteId, invitationId } = req.body;
        const userId = getUserId(req);
        const cleanToken = extractToken(token);
        const targetInviteId = inviteId || invitationId;

        if (!cleanToken && !targetInviteId) {
            return res.status(400).json({ message: 'Invitation token is required' });
        }

        let invitation = null;
        if (cleanToken) {
            invitation = await TeamModel.getInvitationDetailsByToken(cleanToken);
        }
        if (!invitation && targetInviteId) {
            invitation = await TeamModel.findInvitationById(targetInviteId);
        }

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found. Please verify your token or link.' });
        }

        if (invitation.status === 'accepted') {
            return res.status(400).json({
                message: `This invitation to join "${invitation.business_name || 'the business'}" has already been accepted.`
            });
        }

        if (invitation.status === 'revoked') {
            return res.status(400).json({
                message: `This invitation to join "${invitation.business_name || 'the business'}" has been revoked by the business owner.`
            });
        }

        const isExpired = new Date(invitation.expires_at) <= new Date() || invitation.status === 'expired';
        if (isExpired) {
            return res.status(400).json({
                message: `This invitation to join "${invitation.business_name || 'the business'}" expired on ${new Date(invitation.expires_at).toLocaleDateString()}. Please request a new invitation.`
            });
        }

        // Token is bound to the invited email address
        const acceptingUser = await UserModel.findById(userId);
        if (invitation.email && acceptingUser?.email &&
            invitation.email.toLowerCase() !== acceptingUser.email.toLowerCase()) {
            return res.status(403).json({
                message: `This invitation was sent to ${invitation.email}. Please log in as ${invitation.email} to accept it.`
            });
        }

        await TeamModel.acceptInvitation(invitation.id, userId, invitation.business_id, invitation.role);

        // Switch accepting user's last active business to the newly joined business
        await UserModel.updateLastActiveBusiness(userId, invitation.business_id);

        const business = await BusinessModel.findById(invitation.business_id);

        await logAudit(req, {
            businessId: invitation.business_id,
            action: 'ACCEPT_INVITATION',
            entityType: 'user_business_roles',
            entityId: userId,
            details: { role: invitation.role }
        });

        res.status(200).json({
            success: true,
            message: `Successfully joined "${business ? business.business_name : 'business'}" as ${invitation.role}`,
            businessId: invitation.business_id,
            businessName: business ? business.business_name : null,
            role: invitation.role
        });
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ message: 'Server error accepting invitation' });
    }
};

// ─── GET /api/v1/team/members ─────────────────────────────────────────────────
const getMembers = async (req, res) => {
    try {
        const businessId = req.query.businessId;
        if (!businessId) {
            return res.status(400).json({ message: 'businessId query parameter is required' });
        }

        const members = await TeamModel.getBusinessMembers(businessId);
        res.status(200).json({ success: true, members });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── DELETE /api/v1/team/members/:userId ──────────────────────────────────────
const removeMember = async (req, res) => {
    try {
        const { userId } = req.params;
        const businessId = req.query.businessId || req.body.businessId;

        if (!businessId) {
            return res.status(400).json({ message: 'businessId is required' });
        }

        const affected = await TeamModel.removeMember(businessId, userId);

        await logAudit(req, {
            businessId,
            action: 'REMOVE_TEAM_MEMBER',
            entityType: 'user_business_roles',
            entityId: userId
        });

        res.status(200).json({ success: true, message: 'Team member access removed' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── GET /api/v1/team/audit-logs ──────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
    try {
        const businessId = req.query.businessId;
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;

        const logs = await TeamModel.getAuditLogs(businessId, limit, offset);
        res.status(200).json({ success: true, logs });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── GET /api/v1/team/my-invitations ──────────────────────────────────────────
// Returns all invitations sent to the currently logged in user's email
const getMyInvitations = async (req, res) => {
    try {
        const userId = getUserId(req);
        const user = await UserModel.findById(userId);
        if (!user || !user.email) {
            return res.status(200).json({ success: true, invitations: [] });
        }

        const invitations = await TeamModel.getUserInvitations(user.email);
        const frontendOrigin = getEnvConfig().frontendOrigin || 'http://localhost:5173';

        const formatted = invitations.map((inv) => ({
            ...inv,
            inviteLink: `${frontendOrigin}/accept-invite?token=${inv.token}`
        }));

        res.status(200).json({ success: true, invitations: formatted });
    } catch (error) {
        console.error('Error fetching my invitations:', error);
        res.status(500).json({ message: 'Server error fetching invitations' });
    }
};

// ─── POST /api/v1/team/decline-invite ─────────────────────────────────────────
const declineInvite = async (req, res) => {
    try {
        const { token, inviteId, invitationId } = req.body;
        const targetInviteId = inviteId || invitationId;
        const userId = getUserId(req);
        const user = await UserModel.findById(userId);

        let invitation;
        if (token) {
            invitation = await TeamModel.findByInvitationToken(token);
        } else if (targetInviteId) {
            invitation = await TeamModel.findInvitationById(targetInviteId);
        }

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (user && invitation.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            return res.status(403).json({ message: 'You can only decline invitations sent to your account.' });
        }

        await TeamModel.declineInvitation(invitation.id, invitation.email);

        await logAudit(req, {
            businessId: invitation.business_id,
            action: 'DECLINE_INVITATION',
            entityType: 'invitation',
            entityId: invitation.id,
            details: { email: invitation.email, role: invitation.role }
        });

        res.status(200).json({ success: true, message: 'Invitation declined' });
    } catch (error) {
        console.error('Error declining invitation:', error);
        res.status(500).json({ message: 'Server error declining invitation' });
    }
};

// ─── POST /api/v1/team/leave ──────────────────────────────────────────────────
// Allows an invited member (viewer/accountant) to voluntarily leave a business
const leaveBusiness = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { businessId } = req.body;

        if (!businessId) {
            return res.status(400).json({ message: 'businessId is required' });
        }

        await TeamModel.leaveBusiness(businessId, userId);

        await logAudit(req, {
            businessId,
            action: 'LEAVE_BUSINESS',
            entityType: 'user_business_roles',
            entityId: userId
        });

        res.status(200).json({ success: true, message: 'You have left the business' });
    } catch (error) {
        console.error('Error leaving business:', error);
        res.status(400).json({ message: error.message || 'Server error leaving business' });
    }
};

module.exports = {
    inviteMember,
    getPendingInvitations,
    getInviteDetails,
    revokeInvitation,
    resendInvitation,
    acceptInvite,
    getMyInvitations,
    declineInvite,
    leaveBusiness,
    getMembers,
    removeMember,
    getAuditLogs
};



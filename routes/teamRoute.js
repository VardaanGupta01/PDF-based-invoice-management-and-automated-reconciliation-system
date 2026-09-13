const express = require('express');
const {
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
} = require('../controller/teamController');
const verifyToken = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

// ─── Public Route (No auth required to inspect an invitation link) ────────────
router.get('/invite-details/:token', getInviteDetails);

// ─── Protected Routes (Requires valid user authentication) ─────────────────────
router.use(verifyToken);

// User's own received invitations (In-app invitation inbox)
router.get('/my-invitations', getMyInvitations);

// Decline invitation
router.post('/decline-invite', declineInvite);

// Voluntarily leave a business
router.post('/leave', leaveBusiness);

// Invite viewer/accountant team member (Only 'accountant' owner or system 'admin')
router.post('/invite', checkRole(['admin', 'accountant']), inviteMember);

// Get pending invitations for a business
router.get('/invitations', checkRole(['admin', 'accountant']), getPendingInvitations);

// Revoke/cancel a pending invitation
router.delete('/invitations/:inviteId', checkRole(['admin', 'accountant']), revokeInvitation);

// Resend an invitation (extends expiry by 48h, dispatches email)
router.post('/invitations/:inviteId/resend', checkRole(['admin', 'accountant']), resendInvitation);

// Accept invitation (Any logged in user with valid token)
router.post('/accept-invite', acceptInvite);

// Get business team members
router.get('/members', checkRole(['admin', 'accountant', 'viewer']), getMembers);

// Remove a team member
router.delete('/members/:userId', checkRole(['admin', 'accountant']), removeMember);

// Get audit activity logs
router.get('/audit-logs', checkRole(['admin', 'accountant']), getAuditLogs);

module.exports = router;


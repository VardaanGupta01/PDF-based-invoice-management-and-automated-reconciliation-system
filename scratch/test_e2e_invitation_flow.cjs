const BASE_URL = 'http://localhost:3000/api/v1';

async function testFullFlow() {
  console.log('--- STARTING E2E INVITATION & RBAC TEST ---');
  
  // 1. Register or Login User A (Inviter)
  const userAEmail = `admin_${Date.now()}@example.com`;
  const userBEmail = `guest_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log(`Creating Inviter: ${userAEmail}`);
  let res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'AdminUser', email: userAEmail, password, confirmPassword: password })
  });
  let data = await res.json();
  if (!res.ok) throw new Error(`User A register failed: ${JSON.stringify(data)}`);
  const tokenA = data.token;
  const userAId = data.user.id;

  console.log(`Creating Guest: ${userBEmail}`);
  res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'GuestUser', email: userBEmail, password, confirmPassword: password })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`User B register failed: ${JSON.stringify(data)}`);
  const tokenB = data.token;
  const userBId = data.user.id;

  // 2. User A creates a business
  res = await fetch(`${BASE_URL}/settings/business`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ business_name: 'Apex Innovations' })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Business create failed: ${JSON.stringify(data)}`);
  const businessId = data.id;
  console.log(`Created business Apex Innovations (ID: ${businessId})`);

  // 3. User A invites User B as accountant
  res = await fetch(`${BASE_URL}/team/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ businessId, email: userBEmail, role: 'accountant' })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Invite member failed: ${JSON.stringify(data)}`);
  console.log('✓ User A invited User B successfully:', data.message);

  // 4. Check User B's incoming invitations (In-app inbox requirement)
  res = await fetch(`${BASE_URL}/team/my-invitations`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Fetch my-invitations failed: ${JSON.stringify(data)}`);
  console.log(`✓ User B has ${data.invitations.length} pending invitations in their inbox:`);
  console.log(`   Business: ${data.invitations[0].business_name}, Role: ${data.invitations[0].role}`);
  if (data.invitations.length === 0 || data.invitations[0].business_id !== businessId) {
    throw new Error('User B invitation inbox does not match invited business!');
  }
  const pendingInvite = data.invitations[0];

  // 5. User B accepts the invitation via in-app 1-click accept
  res = await fetch(`${BASE_URL}/team/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ token: pendingInvite.token })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Accept invite failed: ${JSON.stringify(data)}`);
  console.log('✓ User B accepted invite:', data.message, `Role: ${data.role}`);

  // 6. Verify User B is now an active member
  res = await fetch(`${BASE_URL}/team/members?businessId=${businessId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  data = await res.json();
  const isMember = data.members.some(m => m.email === userBEmail && m.role === 'accountant');
  if (!isMember) throw new Error('User B is not in active members list after accepting invite!');
  console.log('✓ User B confirmed in active members list of Apex Innovations');

  // 7. Verify Audit Logs recorded INVITE_TEAM_MEMBER and ACCEPT_INVITATION
  res = await fetch(`${BASE_URL}/team/audit-logs?businessId=${businessId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  data = await res.json();
  const logActions = (data.logs || []).map(l => l.action);
  console.log('✓ Current Audit Logs:', logActions);
  if (!logActions.includes('INVITE_TEAM_MEMBER') || !logActions.includes('ACCEPT_INVITATION')) {
    throw new Error('Audit logs missing INVITE_TEAM_MEMBER or ACCEPT_INVITATION');
  }

  // 8. User B tests "Leave Business" functionality
  res = await fetch(`${BASE_URL}/team/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ businessId })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Leave business failed: ${JSON.stringify(data)}`);
  console.log('✓ User B left business:', data.message);

  // 9. Verify User B is no longer a member
  res = await fetch(`${BASE_URL}/team/members?businessId=${businessId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  data = await res.json();
  const stillMember = data.members.some(m => m.email === userBEmail);
  if (stillMember) throw new Error('User B is still in members list after leaving!');
  console.log('✓ User B confirmed removed from active members');

  // 10. Verify Audit Log recorded LEAVE_BUSINESS
  res = await fetch(`${BASE_URL}/team/audit-logs?businessId=${businessId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  data = await res.json();
  const finalLogs = (data.logs || []).map(l => l.action);
  console.log('✓ Final Audit Logs after leave:', finalLogs);
  if (!finalLogs.includes('LEAVE_BUSINESS')) {
    throw new Error('Audit logs missing LEAVE_BUSINESS action');
  }

  // 11. Test decline flow: invite User B again, then User B declines
  res = await fetch(`${BASE_URL}/team/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ businessId, email: userBEmail, role: 'viewer' })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Re-invite failed: ${JSON.stringify(data)}`);
  console.log('✓ User A re-invited User B as viewer');

  res = await fetch(`${BASE_URL}/team/my-invitations`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  data = await res.json();
  const inviteToDecline = data.invitations[0];
  console.log(`✓ User B received re-invite ID ${inviteToDecline.id}, declining...`);

  res = await fetch(`${BASE_URL}/team/decline-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ invitationId: inviteToDecline.id })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Decline invite failed: ${JSON.stringify(data)}`);
  console.log('✓ User B declined invite:', data.message);

  // Verify inbox is now empty for User B
  res = await fetch(`${BASE_URL}/team/my-invitations`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  data = await res.json();
  if (data.invitations.length !== 0) {
    throw new Error('User B inbox should have 0 pending invites after decline');
  }
  console.log('✓ User B inbox is clean after declining');

  // Verify DECLINE_INVITATION in audit logs
  res = await fetch(`${BASE_URL}/team/audit-logs?businessId=${businessId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  data = await res.json();
  const declineLogs = (data.logs || []).map(l => l.action);
  console.log('✓ Audit logs after decline:', declineLogs);
  if (!declineLogs.includes('DECLINE_INVITATION')) {
    throw new Error('Audit logs missing DECLINE_INVITATION action');
  }

  console.log('\n========================================');
  console.log('🎉 ALL INVITATION, RBAC, LEAVE & AUDIT LOG TESTS PASSED PERFECTLY!');
  console.log('========================================\n');
}

testFullFlow().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

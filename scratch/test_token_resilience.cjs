const BASE_URL = 'http://localhost:3000/api/v1';

async function testTokenResilience() {
  console.log('--- TESTING TOKEN RESILIENCE & PRECISE ERROR MESSAGES ---');
  
  // 1. Create User A and User B
  const userAEmail = `owner_${Date.now()}@example.com`;
  const userBEmail = `member_${Date.now()}@example.com`;
  const password = 'Password123!';

  let res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Owner', email: userAEmail, password, confirmPassword: password })
  });
  let data = await res.json();
  const tokenA = data.token;

  res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Member', email: userBEmail, password, confirmPassword: password })
  });
  data = await res.json();
  const tokenB = data.token;

  // Create Business
  res = await fetch(`${BASE_URL}/settings/business`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ business_name: 'Resilient Inc' })
  });
  data = await res.json();
  const businessId = data.id;

  // 2. Invite User B
  res = await fetch(`${BASE_URL}/team/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ businessId, email: userBEmail, role: 'viewer' })
  });
  data = await res.json();
  const inviteLink = data.invitation.inviteLink;
  const rawToken = data.invitation.token;
  console.log('✓ Invitation created. Link:', inviteLink);

  // Case A: User pastes FULL URL into token field
  console.log('Testing full URL acceptance...');
  res = await fetch(`${BASE_URL}/team/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ token: inviteLink })
  });
  data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Failed to accept via full URL: ${JSON.stringify(data)}`);
  }
  console.log('✓ Successfully accepted via full URL! Message:', data.message);

  // Case B: User attempts to accept the SAME token again (should return clear "already accepted" message)
  console.log('Testing already accepted rejection...');
  res = await fetch(`${BASE_URL}/team/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ token: rawToken })
  });
  data = await res.json();
  console.log('✓ Response for already accepted:', data.message);
  if (!data.message || !data.message.includes('already been accepted')) {
    throw new Error(`Expected "already been accepted" message, got: ${JSON.stringify(data)}`);
  }

  // Case C: New invite to User C, then revoked, then attempt accept (should return clear "revoked" message)
  const userCEmail = `revoked_${Date.now()}@example.com`;
  res = await fetch(`${BASE_URL}/team/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ businessId, email: userCEmail, role: 'accountant' })
  });
  data = await res.json();
  const invite2 = data.invitation;
  
  // Revoke it
  await fetch(`${BASE_URL}/team/invitations/${invite2.id}?businessId=${businessId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('✓ Revoked invitation 2');

  // Attempt accept on revoked
  res = await fetch(`${BASE_URL}/team/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ token: `  ${invite2.token}  ` }) // with spaces
  });
  data = await res.json();
  console.log('✓ Response for revoked:', data.message);
  if (!data.message || !data.message.includes('revoked')) {
    throw new Error(`Expected "revoked" message, got: ${JSON.stringify(data)}`);
  }

  console.log('\n=============================================');
  console.log('🎉 ALL TOKEN RESILIENCE & ERROR CASES PASSED!');
  console.log('=============================================\n');
}

testTokenResilience().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

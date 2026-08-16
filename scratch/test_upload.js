const fs = require('fs');
const path = require('path');

(async () => {
    console.log('=== Upload Verification Test ===');
    const email = 'up_test_' + Date.now() + '@example.com';
    
    await fetch('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, username: 'up_user', password: 'StrongPassword123!' })
    });

    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password: 'StrongPassword123!' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const bizRes = await fetch('http://localhost:3000/api/v1/settings/business', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
        body: JSON.stringify({ business_name: 'Upload Test Biz' })
    });
    const bizData = await bizRes.json();
    const bizId = bizData.id;

    const bankRes = await fetch('http://localhost:3000/api/v1/settings/bank-account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
        body: JSON.stringify({ business_id: bizId, bank_name: 'HDFC Up', account_nickname: 'Up Acc', account_last_four: '7777' })
    });
    const bankData = await bankRes.json();
    const bankId = bankData.id;

    const ledgerRes = await fetch('http://localhost:3000/api/v1/ledger', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'x-business-id': String(bizId)},
        body: JSON.stringify({ bankAccountId: bankId, targetMonth: 5, targetYear: 2026 })
    });
    const ledgerData = await ledgerRes.json();
    const ledgerId = ledgerData.ledgerId;
    console.log('1. Created ledger ID:', ledgerId);

    const formData = new FormData();
    const fileBlob = new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'], { type: 'application/pdf' });
    formData.append('files', fileBlob, 'sample_test_invoice.pdf');

    const uploadRes = await fetch('http://localhost:3000/api/v1/ledger/' + ledgerId + '/files', {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + token},
        body: formData
    });
    const uploadData = await uploadRes.json();
    console.log('2. Upload Response Status:', uploadRes.status);
    console.log('3. Upload Response Body:', uploadData);
})().catch(console.error);

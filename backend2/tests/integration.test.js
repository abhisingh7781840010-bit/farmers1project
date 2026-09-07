import app from '../src/app.js';
import { seed } from '../src/db/seed.js';

async function runIntegrationVerification() {
  console.log('🧪 Starting Integration Verification for Newly Added Endpoints...');
  await seed();

  const server = app.listen(5098, () => {});
  const BASE = 'http://localhost:5098/api/v1';

  try {
    // 1. Verify Admin Statistics
    console.log('▶ Verification 1: GET /api/v1/admin/statistics');
    const statsRes = await fetch(`${BASE}/admin/statistics`);
    const stats = await statsRes.json();
    if (!stats.success || stats.data.today_total_farmers === undefined) {
      throw new Error('Statistics endpoint failed: ' + JSON.stringify(stats));
    }
    console.log('  ✅ Statistics returned:', stats.data);

    // 2. Verify Schedules List
    console.log('▶ Verification 2: GET /api/v1/schedules');
    const schedRes = await fetch(`${BASE}/schedules`);
    const schedData = await schedRes.json();
    if (!schedData.success || !Array.isArray(schedData.data)) {
      throw new Error('Schedules list failed: ' + JSON.stringify(schedData));
    }
    console.log(`  ✅ Retrieved ${schedData.data.length} schedules.`);

    // 3. Verify Schedule Create
    console.log('▶ Verification 3: POST /api/v1/schedules');
    const newSchedRes = await fetch(`${BASE}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        center_id: 'up_c1',
        crop: 'Mustard',
        schedule_date: '2026-09-10',
        start_time: '09:00',
        end_time: '17:00',
        total_slots: 40
      })
    });
    const newSched = await newSchedRes.json();
    if (!newSched.success) {
      throw new Error('Create schedule failed: ' + JSON.stringify(newSched));
    }
    console.log('  ✅ Schedule created:', newSched.data.center_name, newSched.data.crop);

    // 4. Verify Farmer Registration & Login
    console.log('▶ Verification 4: POST /api/v1/auth/farmer-register & farmer-login');
    const regRes = await fetch(`${BASE}/auth/farmer-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rameshwar Lal',
        phone: '9876500001',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad'
      })
    });
    const regData = await regRes.json();
    if (!regData.success || !regData.data.farmer) {
      throw new Error('Farmer registration failed: ' + JSON.stringify(regData));
    }
    console.log('  ✅ Farmer registered:', regData.data.farmer.name, regData.data.farmer.registration_number);

    // 5. Verify Token Generation for Farmer
    console.log('▶ Verification 5: POST /api/v1/farmer/token');
    const tokenRes = await fetch(`${BASE}/farmer/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerId: 'up_c1',
        farmerId: regData.data.farmer.id,
        cropId: 'mustard',
        cropName: 'Mustard / Rapeseed',
        estimatedQuantityQtl: 25,
        scheduledDate: '2026-09-10'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.success) {
      throw new Error('Token creation failed: ' + JSON.stringify(tokenData));
    }
    const tokenObj = tokenData.data.token || tokenData.data;
    const tokenNumber = tokenObj.tokenNumber || tokenObj.token_number;
    console.log('  ✅ Token created:', tokenNumber, 'Queue Pos:', tokenObj.queuePosition || tokenObj.queue_position);

    // 6. Verify Status Progression: WAITING -> CALLED -> PROCESSING -> ACCEPTED -> COMPLETED
    console.log('▶ Verification 6: State transitions WAITING -> CALLED -> PROCESSING -> ACCEPTED -> COMPLETED');
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': 'kisan_mandi_admin_key_2026'
    };

    // a. CALLED
    let sRes = await fetch(`${BASE}/procurement/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tokenId: tokenNumber, newStatus: 'CALLED' })
    });
    let sJson = await sRes.json();
    if (!sJson.success || sJson.data.token.status !== 'CALLED') {
      throw new Error('Failed to transition to CALLED: ' + JSON.stringify(sJson));
    }
    console.log('  ✅ Status changed to CALLED');

    // b. PROCESSING
    sRes = await fetch(`${BASE}/procurement/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tokenId: tokenNumber, newStatus: 'PROCESSING' })
    });
    sJson = await sRes.json();
    if (!sJson.success || sJson.data.token.status !== 'PROCESSING') {
      throw new Error('Failed to transition to PROCESSING: ' + JSON.stringify(sJson));
    }
    console.log('  ✅ Status changed to PROCESSING');

    // c. ACCEPTED
    sRes = await fetch(`${BASE}/procurement/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tokenId: tokenNumber, newStatus: 'ACCEPTED' })
    });
    sJson = await sRes.json();
    if (!sJson.success || sJson.data.token.status !== 'ACCEPTED') {
      throw new Error('Failed to transition to ACCEPTED: ' + JSON.stringify(sJson));
    }
    console.log('  ✅ Status changed to ACCEPTED');

    // d. COMPLETED
    sRes = await fetch(`${BASE}/procurement/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tokenId: tokenNumber, newStatus: 'COMPLETED' })
    });
    sJson = await sRes.json();
    if (!sJson.success || sJson.data.token.status !== 'COMPLETED') {
      throw new Error('Failed to transition to COMPLETED: ' + JSON.stringify(sJson));
    }
    console.log('  ✅ Status changed to COMPLETED');

    // 7. Verify Admin Center CRUD
    console.log('▶ Verification 7: Centers CRUD (POST, PUT, DELETE)');
    const createCenterRes = await fetch(`${BASE}/centers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Center E - Test Mandi',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        status: 'open'
      })
    });
    const newCenter = await createCenterRes.json();
    if (!newCenter.success) throw new Error('Create center failed: ' + JSON.stringify(newCenter));
    console.log('  ✅ Center created:', newCenter.data.name);

    const updateCenterRes = await fetch(`${BASE}/centers/${newCenter.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'busy' })
    });
    const updatedCenter = await updateCenterRes.json();
    if (!updatedCenter.success || updatedCenter.data.status !== 'busy') {
      throw new Error('Update center status failed: ' + JSON.stringify(updatedCenter));
    }
    console.log('  ✅ Center status updated to:', updatedCenter.data.status);

    const deleteCenterRes = await fetch(`${BASE}/centers/${newCenter.data.id}`, { method: 'DELETE' });
    const deletedCenter = await deleteCenterRes.json();
    if (!deletedCenter.success) throw new Error('Delete center failed: ' + JSON.stringify(deletedCenter));
    console.log('  ✅ Center deleted successfully');

    console.log('\n🎉 ALL NEW INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runIntegrationVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

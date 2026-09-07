import assert from 'node:assert/strict';
import app from '../src/app.js';
import mlApp from '../ml_mock_service/server.js';
import { initDb, run } from '../src/db/connection.js';
import { seed } from '../src/db/seed.js';

let server;
const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
const DEV_KEY = 'kisan_mandi_admin_key_2026';

let adminJwt = '';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 Starting Comprehensive Automated Backend API Tests...');
  console.log('🧪 =========================================================\n');

  // 1. Setup DB & Clean for test run
  initDb();
  run('DELETE FROM notifications;');
  run('DELETE FROM waiting_time_predictions;');
  run('DELETE FROM procurement_stages;');
  run('DELETE FROM tokens;');
  run('DELETE FROM schedules;');
  run('DELETE FROM farmers;');
  run('DELETE FROM centers;');
  run('DELETE FROM admin_users;');
  await seed();

  // Start temporary server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
  console.log(`📡 Test server running on port ${TEST_PORT}\n`);

  try {
    // -----------------------------------------------------------
    // TEST 1: Health Check
    // -----------------------------------------------------------
    console.log('▶ Test 1: GET /health');
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'healthy');
    console.log('  ✅ Health check passed.');

    // -----------------------------------------------------------
    // TEST 2: Admin Login & JWT Generation
    // -----------------------------------------------------------
    console.log('\n▶ Test 2: POST /api/v1/auth/login');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'MandiAdmin#2026' })
    });
    assert.equal(loginRes.status, 200);
    const loginJson = await loginRes.json();
    assert.equal(loginJson.success, true);
    assert.ok(loginJson.data.token, 'JWT token should be returned');
    adminJwt = loginJson.data.token;
    console.log('  ✅ Admin login successful. JWT acquired.');

    // -----------------------------------------------------------
    // TEST 3: Centers List & Filters
    // -----------------------------------------------------------
    console.log('\n▶ Test 3: GET /api/v1/centers');
    const centersRes = await fetch(`${BASE_URL}/centers?state=Uttar Pradesh`);
    assert.equal(centersRes.status, 200);
    const centersJson = await centersRes.json();
    assert.equal(centersJson.success, true);
    assert.ok(centersJson.data.length >= 3, 'Should return at least 3 UP centers');
    const centerA = centersJson.data.find(c => c.id === 'up_c1');
    assert.ok(centerA, 'Muradnagar center should exist');
    console.log(`  ✅ Centers endpoint returned ${centersJson.data.length} centers.`);

    // -----------------------------------------------------------
    // TEST 4: Center Availability
    // -----------------------------------------------------------
    console.log('\n▶ Test 4: GET /api/v1/centers/up_c1/availability');
    const availRes = await fetch(`${BASE_URL}/centers/up_c1/availability`);
    assert.equal(availRes.status, 200);
    const availJson = await availRes.json();
    assert.equal(availJson.success, true);
    assert.equal(availJson.data.centerId, 'up_c1');
    assert.equal(availJson.data.isAvailable, true);
    assert.ok(availJson.data.availableProcurementSlots > 0);
    assert.ok(availJson.data.estimatedWaitTimeForNewToken.predictedWaitMinutes > 0);
    console.log(`  ✅ Center availability verified. Available slots: ${availJson.data.availableProcurementSlots}.`);

    // -----------------------------------------------------------
    // TEST 5: Center Queue
    // -----------------------------------------------------------
    console.log('\n▶ Test 5: GET /api/v1/centers/up_c1/queue');
    const queueRes = await fetch(`${BASE_URL}/centers/up_c1/queue`);
    assert.equal(queueRes.status, 200);
    const queueJson = await queueRes.json();
    assert.equal(queueJson.success, true);
    assert.ok(queueJson.data.summary.totalWaiting >= 1);
    console.log(`  ✅ Center queue retrieved. Total waiting: ${queueJson.data.summary.totalWaiting}.`);

    // -----------------------------------------------------------
    // TEST 6: Token Generation (POST /farmer/token)
    // -----------------------------------------------------------
    console.log('\n▶ Test 6: POST /api/v1/farmer/token');
    const tokenRes = await fetch(`${BASE_URL}/farmer/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerId: 'FARMER-884121', // Baldev Singh
        centerId: 'up_c1',
        cropId: 'paddy_common',
        cropName: 'Paddy (Common)',
        category: 'cereals',
        estimatedQuantityQtl: 50.0,
        vehicleType: 'Tractor-Trolley',
        vehicleNumber: 'PB-10-XY-9900'
      })
    });
    assert.equal(tokenRes.status, 201);
    const tokenJson = await tokenRes.json();
    assert.equal(tokenJson.success, true);
    const createdToken = tokenJson.data.token;
    assert.ok(createdToken.tokenNumber.startsWith('UP-GZB-'));
    assert.equal(createdToken.status, 'WAITING');
    assert.ok(createdToken.queuePosition >= 1);
    assert.ok(tokenJson.data.waitingTime.predictedWaitMinutes > 0);
    console.log(`  ✅ Token generated: ${createdToken.tokenNumber} at Queue Pos #${createdToken.queuePosition}. Predicted Wait: ${tokenJson.data.waitingTime.predictedWaitMinutes}m.`);

    // -----------------------------------------------------------
    // TEST 7: Duplicate Token Prevention
    // -----------------------------------------------------------
    console.log('\n▶ Test 7: Duplicate Token Prevention Check');
    const dupRes = await fetch(`${BASE_URL}/farmer/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerId: 'FARMER-884121', // Same farmer, same crop, same day
        centerId: 'up_c1',
        cropId: 'paddy_common',
        cropName: 'Paddy (Common)',
        estimatedQuantityQtl: 30.0
      })
    });
    assert.equal(dupRes.status, 400);
    const dupJson = await dupRes.json();
    assert.equal(dupJson.success, false);
    assert.ok(dupJson.error.includes('Duplicate token rejected'));
    console.log('  ✅ Duplicate token correctly rejected by backend.');

    // -----------------------------------------------------------
    // TEST 8: Farmer Status Lookup (GET /farmer/status)
    // -----------------------------------------------------------
    console.log('\n▶ Test 8: GET /api/v1/farmer/status');
    const statusRes = await fetch(`${BASE_URL}/farmer/status?tokenNumber=${createdToken.tokenNumber}`);
    assert.equal(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.success, true);
    assert.equal(statusJson.data.tokenNumber, createdToken.tokenNumber);
    assert.equal(statusJson.data.status, 'WAITING');
    assert.equal(statusJson.data.stages.length, 5);
    console.log('  ✅ Farmer status & 5 procurement stages verified.');

    // -----------------------------------------------------------
    // TEST 9: Waiting Time API (GET /farmer/waiting-time)
    // -----------------------------------------------------------
    console.log('\n▶ Test 9: GET /api/v1/farmer/waiting-time');
    const waitRes = await fetch(`${BASE_URL}/farmer/waiting-time?tokenNumber=${createdToken.tokenNumber}`);
    assert.equal(waitRes.status, 200);
    const waitJson = await waitRes.json();
    assert.equal(waitJson.success, true);
    assert.ok(waitJson.data.waitingTime.predictedWaitMinutes > 0);
    console.log(`  ✅ Live waiting time returned: ~${waitJson.data.waitingTime.predictedWaitMinutes} mins.`);

    // -----------------------------------------------------------
    // TEST 10: Auth Protection on Procurement Status (Unauthorized check)
    // -----------------------------------------------------------
    console.log('\n▶ Test 10: Auth Protection on PUT /api/v1/procurement/status');
    const unauthRes = await fetch(`${BASE_URL}/procurement/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId: createdToken.tokenNumber, newStatus: 'CALLED' })
    });
    assert.equal(unauthRes.status, 401);
    console.log('  ✅ Unauthorized request correctly blocked with 401.');

    // -----------------------------------------------------------
    // TEST 11: Procurement Status Transitions & Queue Re-ordering
    // -----------------------------------------------------------
    console.log('\n▶ Test 11: State Transition: WAITING -> CALLED');
    const callRes = await fetch(`${BASE_URL}/procurement/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        tokenId: createdToken.tokenNumber,
        newStatus: 'CALLED',
        reason: 'Bay 2 Ready'
      })
    });
    assert.equal(callRes.status, 200);
    const callJson = await callRes.json();
    assert.equal(callJson.data.newStatus, 'CALLED');
    assert.equal(callJson.data.token.queue_position, 0);
    console.log('  ✅ Transition WAITING -> CALLED succeeded. Queue position reset to 0.');

    console.log('▶ Test 11b: State Transition: CALLED -> IN_PROCUREMENT');
    const procRes = await fetch(`${BASE_URL}/procurement/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DEV_KEY
      },
      body: JSON.stringify({
        tokenId: createdToken.tokenNumber,
        newStatus: 'IN_PROCUREMENT'
      })
    });
    assert.equal(procRes.status, 200);
    const procJson = await procRes.json();
    assert.equal(procJson.data.newStatus, 'IN_PROCUREMENT');
    console.log('  ✅ Transition CALLED -> IN_PROCUREMENT succeeded.');

    console.log('▶ Test 11c: State Transition: IN_PROCUREMENT -> COMPLETED');
    const compRes = await fetch(`${BASE_URL}/procurement/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        tokenId: createdToken.tokenNumber,
        newStatus: 'COMPLETED'
      })
    });
    assert.equal(compRes.status, 200);
    const compJson = await compRes.json();
    assert.equal(compJson.data.newStatus, 'COMPLETED');
    console.log('  ✅ Transition IN_PROCUREMENT -> COMPLETED succeeded.');

    console.log('▶ Test 11d: Invalid State Transition: COMPLETED -> WAITING (should fail)');
    const invalidRes = await fetch(`${BASE_URL}/procurement/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        tokenId: createdToken.tokenNumber,
        newStatus: 'WAITING'
      })
    });
    assert.equal(invalidRes.status, 400);
    console.log('  ✅ Invalid state transition rejected properly with 400.');

    // -----------------------------------------------------------
    // TEST 12: Schedule Management (PUT /centers/:id/schedule)
    // -----------------------------------------------------------
    console.log('\n▶ Test 12: PUT /api/v1/centers/up_c1/schedule');
    const schedRes = await fetch(`${BASE_URL}/centers/up_c1/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        openTime: '07:00',
        closeTime: '19:00',
        totalSlots: 100,
        notes: 'Extended hours for bumper arrival season'
      })
    });
    assert.equal(schedRes.status, 200);
    const schedJson = await schedRes.json();
    assert.equal(schedJson.success, true);
    assert.equal(schedJson.data.total_slots, 100);
    console.log('  ✅ Center schedule updated successfully.');

    // -----------------------------------------------------------
    // TEST 13: Notifications Dispatch & Retrieval
    // -----------------------------------------------------------
    console.log('\n▶ Test 13: POST /api/v1/notifications & GET /api/v1/notifications');
    const notifPostRes = await fetch(`${BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerId: 'FARMER-884121',
        centerId: 'up_c1',
        eventType: 'TURN_APPROACHING',
        title: 'Gate Alert',
        message: 'Your tractor is next in line at Bay 2'
      })
    });
    assert.equal(notifPostRes.status, 201);

    const notifGetRes = await fetch(`${BASE_URL}/notifications?farmerId=FARMER-884121`);
    assert.equal(notifGetRes.status, 200);
    const notifGetJson = await notifGetRes.json();
    assert.ok(notifGetJson.data.length >= 1);
    console.log(`  ✅ Notification dispatched and verified in farmer inbox (${notifGetJson.data.length} messages).`);

    // -----------------------------------------------------------
    // TEST 14: ML Prediction Direct API
    // -----------------------------------------------------------
    console.log('\n▶ Test 14: POST /api/v1/ml/predict');
    const mlRes = await fetch(`${BASE_URL}/ml/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerId: 'up_c1',
        queuePosition: 5,
        activeBays: 4,
        cropId: 'mustard',
        vehicleType: 'Tractor-Trolley',
        estimatedQuantityQtl: 40
      })
    });
    assert.equal(mlRes.status, 200);
    const mlJson = await mlRes.json();
    assert.ok(mlJson.data.predicted_wait_minutes > 0);
    assert.ok(mlJson.data.source);
    console.log(`  ✅ ML Predict API tested. Wait time: ${mlJson.data.predicted_wait_minutes}m (Source: ${mlJson.data.source}).`);

    // -----------------------------------------------------------
    // TEST 15: Direct Root Aliases Check (e.g. /centers, /farmer/token)
    // -----------------------------------------------------------
    console.log('\n▶ Test 15: Direct Root Aliases (GET /centers, GET /farmer/status)');
    const aliasRes = await fetch(`http://localhost:${TEST_PORT}/centers`);
    assert.equal(aliasRes.status, 200);
    console.log('  ✅ Root route aliases operational.');

    // -----------------------------------------------------------
    // TEST 16: External ML Model Microservice HTTP Integration
    // -----------------------------------------------------------
    console.log('\n▶ Test 16: External ML Model Microservice HTTP Integration (Port 5005)');
    const mlServer = await new Promise((resolve) => {
      const s = mlApp.listen(5005, () => resolve(s));
    });

    try {
      const extMlRes = await fetch(`${BASE_URL}/ml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerId: 'up_c1',
          queuePosition: 4,
          activeBays: 4,
          cropId: 'wheat',
          vehicleType: 'Tractor-Trolley',
          estimatedQuantityQtl: 30
        })
      });
      assert.equal(extMlRes.status, 200);
      const extMlJson = await extMlRes.json();
      assert.equal(extMlJson.data.source, 'EXTERNAL_ML_API');
      assert.ok(extMlJson.data.predicted_wait_minutes > 0);
      console.log(`  ✅ External ML API verified: Source=${extMlJson.data.source}, Predicted Wait=${extMlJson.data.predicted_wait_minutes}m, Confidence=${extMlJson.data.confidence_score}`);
    } finally {
      mlServer.close();
    }

    console.log('\n🎉 =========================================================');
    console.log('🎉 ALL 16 AUTOMATED TESTS PASSED SUCCESSFULLY!');
    console.log('🎉 =========================================================\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();

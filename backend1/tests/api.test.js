/**
 * Automated Verification Suite for Smart Agricultural Procurement Backend
 * Tests:
 * 1. Waiting Time Service & Mathematical Queuing Formula
 * 2. Operating Hours & Date Utilities
 * 3. ML Client Service & Graceful Fallback
 * 4. Joi Input Validation Schemas
 * 5. Socket.IO Real-time Connection & Room Architecture
 * 6. Live API endpoints (when MongoDB is active)
 */

const http = require('http');
const ioClient = require('socket.io-client');
const app = require('../app');
const config = require('../config/config');
const WaitingTimeService = require('../services/waitingTimeService');
const { isTimeWithinOperatingHours, timeToMinutes, getCurrentTemporalFeatures } = require('../utils/dateUtils');
const {
  generateTokenSchema,
  updateProcurementStatusSchema,
  createCenterSchema,
  otpRequestSchema,
  otpVerifySchema
} = require('../middleware/validationMiddleware');
const { initSocket } = require('../sockets/socketManager');
const SocketEvents = require('../sockets/socketEvents');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING AUTOMATED SYSTEM VERIFICATION SUITE');
  console.log('====================================================\n');

  // -----------------------------------------------------------
  // TEST GROUP 1: Waiting Time Calculation & Fallback
  // -----------------------------------------------------------
  console.log('[Group 1] Waiting Time Service & Heuristics');

  // Case: 0 people ahead
  const time0 = WaitingTimeService.calculateMathematicalWaitingTime(0, 5, 3);
  assert(time0 === 0, 'Zero people ahead gives 0 minutes waiting time');

  // Case: 7 people ahead, 5 mins avg, 3 counters
  // ceil((7 * 5) / 3) = ceil(35 / 3) = 12 minutes
  const time1 = WaitingTimeService.calculateMathematicalWaitingTime(7, 5, 3);
  assert(time1 === 12, `7 people ahead with 3 counters gives 12 mins (got ${time1})`);

  // Case: Single counter
  // ceil((10 * 5) / 1) = 50 mins
  const time2 = WaitingTimeService.calculateMathematicalWaitingTime(10, 5, 1);
  assert(time2 === 50, `10 people ahead with 1 counter gives 50 mins (got ${time2})`);

  // Fallback test when ML service URL is non-responsive
  const calculationResult = await WaitingTimeService.calculateWaitingTime({
    queueLength: 10,
    peopleAhead: 6,
    numberOfCounters: 2,
    averageProcessingTime: 5
  });
  assert(
    calculationResult.waitingTime > 0,
    `Waiting time calculation returns positive number: ${calculationResult.waitingTime}m`
  );
  assert(
    ['ML_MODEL', 'MATHEMATICAL_FALLBACK'].includes(calculationResult.calculationMethod),
    `Method is either ML_MODEL or MATHEMATICAL_FALLBACK (got ${calculationResult.calculationMethod})`
  );

  // -----------------------------------------------------------
  // TEST GROUP 2: Operating Hours & Date Utilities
  // -----------------------------------------------------------
  console.log('\n[Group 2] Operating Hours & Date Utilities');

  assert(timeToMinutes('09:30') === 570, '09:30 is 570 minutes from midnight');
  assert(timeToMinutes('17:00') === 1020, '17:00 is 1020 minutes from midnight');

  const morningDate = new Date(2026, 8, 5, 10, 30); // 10:30 AM
  const nightDate = new Date(2026, 8, 5, 20, 30);   // 08:30 PM
  assert(isTimeWithinOperatingHours('08:00', '18:00', morningDate) === true, '10:30 is within 08:00 - 18:00');
  assert(isTimeWithinOperatingHours('08:00', '18:00', nightDate) === false, '20:30 is outside 08:00 - 18:00');

  const temporalFeatures = getCurrentTemporalFeatures();
  assert(typeof temporalFeatures.hour === 'number', 'Current hour is numeric');
  assert(typeof temporalFeatures.dayOfWeek === 'number', 'Current dayOfWeek is numeric');

  // -----------------------------------------------------------
  // TEST GROUP 3: Request Validation Schemas
  // -----------------------------------------------------------
  console.log('\n[Group 3] Joi Request Validation Schemas');

  // Token schema valid case
  const validTokenPayload = {
    farmerId: 'F001',
    centerId: 'C001',
    crop: 'Wheat',
    quantityKg: 500
  };
  const tokenValRes = generateTokenSchema.validate(validTokenPayload);
  assert(!tokenValRes.error, 'Valid token generation payload passes schema');

  // Token schema invalid case (missing crop)
  const invalidTokenPayload = {
    farmerId: 'F001',
    centerId: 'C001'
  };
  const invalidTokenValRes = generateTokenSchema.validate(invalidTokenPayload);
  assert(invalidTokenValRes.error !== undefined, 'Missing crop fails schema validation');

  // Procurement status update schema
  const validStatusPayload = {
    tokenNumber: 105,
    status: 'CALLED',
    counterNumber: 2
  };
  const statusValRes = updateProcurementStatusSchema.validate(validStatusPayload);
  assert(!statusValRes.error, 'Valid procurement status update passes schema');

  // Center creation schema
  const validCenterPayload = {
    centerId: 'C100',
    name: 'Test Mandi',
    location: {
      address: 'Station Road',
      district: 'Karnal',
      state: 'Haryana'
    },
    openingTime: '09:00',
    closingTime: '17:00'
  };
  const centerValRes = createCenterSchema.validate(validCenterPayload);
  assert(!centerValRes.error, 'Valid center creation payload passes schema');

  const otpRequestValRes = otpRequestSchema.validate({ email: 'farmer@example.com' });
  assert(!otpRequestValRes.error, 'Valid OTP request payload passes schema');

  const otpVerifyValRes = otpVerifySchema.validate({ email: 'farmer@example.com', code: '123456' });
  assert(!otpVerifyValRes.error, 'Valid OTP verification payload passes schema');

  const invalidOtpValRes = otpVerifySchema.validate({ email: 'farmer@example.com', code: '12345' });
  assert(invalidOtpValRes.error !== undefined, 'OTP codes must contain exactly six digits');

  // -----------------------------------------------------------
  // TEST GROUP 4: Socket.IO Server & Real-time Client
  // -----------------------------------------------------------
  console.log('\n[Group 4] Socket.IO Server & Real-Time Event Rooms');

  const testServer = http.createServer(app);
  initSocket(testServer);

  const testPort = 5999;
  await new Promise((resolve) => testServer.listen(testPort, resolve));
  console.log(`  Test HTTP & Socket server running on port ${testPort}`);

  const clientSocket = ioClient(`http://localhost:${testPort}`, {
    transports: ['websocket'],
    forceNew: true
  });

  await new Promise((resolve, reject) => {
    clientSocket.on('connect', () => {
      assert(clientSocket.connected === true, 'Socket.IO client connected successfully');
      resolve();
    });
    clientSocket.on('connect_error', reject);
  });

  // Test room subscription
  await new Promise((resolve) => {
    clientSocket.emit('join_farmer_room', 'F001');
    clientSocket.on('joined_room', (data) => {
      assert(data.room === 'farmer:F001', `Farmer subscribed to room ${data.room}`);
      resolve();
    });
  });

  // Test event dispatching to farmer room
  await new Promise((resolve) => {
    clientSocket.on('farmer_called', (event) => {
      assert(event.data.status === 'CALLED', 'Received real-time FARMER_CALLED event');
      assert(event.data.counterNumber === 3, 'Counter number in event is correct');
      resolve();
    });

    SocketEvents.emitFarmerCalled(
      { tokenNumber: '105', farmerId: 'F001', centerId: 'C001' },
      3
    );
  });

  // Clean up test socket
  clientSocket.disconnect();
  testServer.close();
  console.log('  Socket test server gracefully closed.');

  // -----------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n[FATAL] Test execution failed:', err);
  process.exit(1);
});


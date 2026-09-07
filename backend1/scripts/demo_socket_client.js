/**
 * Real-time Socket.IO Demo Client
 * 
 * Usage:
 *   node scripts/demo_socket_client.js farmer F001
 *   node scripts/demo_socket_client.js center C001
 */

const io = require('socket.io-client');

const targetType = (process.argv[2] || 'farmer').toLowerCase();
const targetId = (process.argv[3] || (targetType === 'farmer' ? 'F001' : 'C001')).toUpperCase();
const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';

console.log('========================================================');
console.log(`  Connecting to Socket.IO Server at ${serverUrl}`);
console.log(`  Mode: ${targetType.toUpperCase()} | Subscribed ID: ${targetId}`);
console.log('========================================================\n');

const socket = io(serverUrl, {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  console.log(`[CONNECTED] Socket ID: ${socket.id}`);

  if (targetType === 'farmer') {
    socket.emit('join_farmer_room', targetId);
    console.log(`[ROOM] Joined farmer room: farmer:${targetId}`);
  } else {
    socket.emit('join_center_room', targetId);
    console.log(`[ROOM] Joined center room: center:${targetId}`);
  }
});

socket.on('joined_room', (data) => {
  console.log(`[CONFIRMATION] ${data.message}`);
});

// Event Listeners
socket.on('token_generated', (payload) => {
  console.log('\n[EVENT: TOKEN_GENERATED]', JSON.stringify(payload, null, 2));
});

socket.on('turn_approaching', (payload) => {
  console.log('\n[ALERT: TURN_APPROACHING] !!! YOUR TURN IS NEXT !!!', JSON.stringify(payload, null, 2));
});

socket.on('farmer_called', (payload) => {
  console.log('\n[NOTIFICATION: FARMER_CALLED] >>> PROCEED TO COUNTER <<<', JSON.stringify(payload, null, 2));
});

socket.on('procurement_started', (payload) => {
  console.log('\n[EVENT: PROCUREMENT_STARTED]', JSON.stringify(payload, null, 2));
});

socket.on('procurement_completed', (payload) => {
  console.log('\n[EVENT: PROCUREMENT_COMPLETED] Transaction finished.', JSON.stringify(payload, null, 2));
});

socket.on('queue_updated', (payload) => {
  console.log('\n[BROADCAST: QUEUE_UPDATED]', JSON.stringify(payload, null, 2));
});

socket.on('disconnect', (reason) => {
  console.log(`[DISCONNECTED] Reason: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error(`[CONNECTION ERROR]: ${error.message}`);
});

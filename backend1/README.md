# Smart Agricultural Procurement Management System
## Backend Member 2: Queue Management, Farmer Tokens, Procurement Status, Center Availability, Notifications & ML Integration

A production-grade, modular Node.js + Express + MongoDB backend module designed for smart agricultural procurement centers (Mandis / APMC hubs). Built for high-throughput procurement seasons to eliminate farmer queuing bottlenecks, prevent duplicate tokens, predict waiting times using machine learning, and deliver real-time notifications via Socket.IO.

---

## 1. Project Directory Structure

```
smart-agri-procurement-backend/
├── .env.example                       # Environment template
├── .env                               # Local configuration file
├── package.json                       # Node.js dependencies and lifecycle scripts
├── server.js                          # HTTP server and Socket.IO initialization
├── app.js                             # Express application configuration and route mounting
├── README.md                          # Comprehensive documentation
│
├── config/
│   ├── config.js                      # Centralized environment variable loader
│   └── db.js                          # MongoDB Mongoose connection with event listeners
│
├── models/
│   ├── Farmer.js                      # Farmer identity & crop profile schema
│   ├── ProcurementCenter.js           # Mandi center location, capacity, counters
│   ├── Token.js                       # Queue tokens, positions, and live states
│   ├── Schedule.js                    # Day-of-week operating hours and caps
│   ├── Procurement.js                 # Completed grain inspection and purchase records
│   └── User.js                        # Mandi staff and admin credentials (JWT)
│
├── controllers/
│   ├── authController.js              # Login, register, profile fetching
│   ├── centerController.js            # Center listings, availability, live queues
│   ├── tokenController.js             # Token issuance, farmer status, cancellations
│   ├── procurementController.js       # Status progression (WAITING -> CALLED -> COMPLETED)
│   └── scheduleController.js          # Operating schedule queries and updates
│
├── routes/
│   ├── authRoutes.js                  # /auth and /api/v1/auth
│   ├── centerRoutes.js                # /centers and /api/v1/centers
│   ├── farmerRoutes.js                # /farmer and /api/v1/farmer
│   ├── procurementRoutes.js           # /procurement and /api/v1/procurement
│   └── scheduleRoutes.js              # /schedules and /api/v1/schedules
│
├── services/
│   ├── queueService.js                # Token generation, duplicate guards, queue shifts
│   ├── waitingTimeService.js          # Modular waiting time (ML with heuristic fallback)
│   ├── mlClientService.js             # Axios client connecting to Python ML REST API
│   └── availabilityService.js         # Center state logic (AVAILABLE, BUSY, FULL, CLOSED)
│
├── middleware/
│   ├── authMiddleware.js              # JWT Bearer token authentication & role checks
│   ├── validationMiddleware.js        # Joi schema validation for all inputs
│   └── errorMiddleware.js             # Centralized 404 and HTTP error handlers
│
├── sockets/
│   ├── socketManager.js               # Socket.IO connection and room subscriptions
│   └── socketEvents.js                # Real-time event broadcasting triggers
│
├── utils/
│   ├── apiResponse.js                 # Standardized JSON response envelope
│   ├── logger.js                      # Formatted console logger with timestamps
│   └── dateUtils.js                   # 24h time parsing, operating hours, day features
│
├── scripts/
│   ├── seed.js                        # Seeds centers, schedules, farmers, and staff
│   └── demo_socket_client.js          # Interactive live socket test client
│
├── tests/
│   └── api.test.js                    # Automated integration and unit test suite
│
├── postman/
│   └── Smart_Agri_Procurement_APIs.postman_collection.json # Ready-to-import Postman collection
│
└── ml/
    ├── ml_service.py                  # Python FastAPI/HTTP ML waiting time microservice
    ├── requirements.txt               # Python dependencies (fastapi, uvicorn)
    └── test_ml.py                     # Direct verification script for Python ML logic
```

---

## 2. Prerequisites & Installation

### System Requirements
- **Node.js**: v18.x or higher (Tested on Node v26)
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) or MongoDB Atlas URI
- **Python**: 3.9+ (Optional: for running the ML service; backend automatically falls back to mathematical formula if offline)

### Step 1: Install Node.js Dependencies
```bash
cd smart-agri-procurement-backend
npm install
```

### Step 2: Configure Environment Variables
Create `.env` by copying `.env.example`:
```bash
cp .env.example .env
```
Default `.env` settings:
```ini
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
MONGODB_URI=mongodb://localhost:27017/smart_agri_procurement
JWT_SECRET=super_secret_jwt_key_smart_agri_procurement_hackathon_2024
JWT_EXPIRE=7d
ML_SERVICE_URL=http://localhost:8000/predict-waiting-time
ML_SERVICE_TIMEOUT_MS=2000
DEFAULT_AVERAGE_PROCESSING_TIME=5
```

### Step 3: Seed Database (Optional but Recommended)
Populates sample procurement centers (`C001`, `C002`, `C003`), weekly schedules, registered farmers (`F001` - `F004`), and test staff users:
```bash
npm run seed
```

---

## 3. How to Run Locally

### Option A: Running Backend with Heuristic Waiting-Time (Zero-Python setup)
```bash
npm start
# or during development with auto-reload:
npm run dev
```
The server will start at: `http://localhost:5000`

### Option B: Running with Python ML Waiting-Time Prediction Service

1. **Terminal 1 (Start Python ML Microservice)**:
```bash
cd ml
python ml_service.py
```
*Note: The script automatically detects FastAPI/Uvicorn if installed, or runs on Python's built-in HTTP server with zero external dependencies on port 8000.*

2. **Terminal 2 (Start Node.js Backend)**:
```bash
npm run dev
```

---

## 4. Real-Time Socket.IO Architecture

### Room Structure
- `farmer:<farmerId>`: Joined by farmer mobile/web clients (e.g. `farmer:F001`). Receives targeted personal alerts (`turn_approaching`, `farmer_called`, `procurement_completed`).
- `center:<centerId>`: Joined by Mandi display boards and operator consoles (e.g. `center:C001`). Receives public broadcasts (`token_generated`, `farmer_called`, `queue_updated`).

### Socket.IO Events

| Event Name | Recipient Room | Trigger Condition |
| :--- | :--- | :--- |
| `token_generated` | `farmer:<ID>`, `center:<ID>` | When a farmer creates a new token |
| `turn_approaching` | `farmer:<ID>` | When farmer's position reaches $\le 2$ |
| `farmer_called` | `farmer:<ID>`, `center:<ID>` | Mandi staff calls token to counter |
| `procurement_started` | `farmer:<ID>`, `center:<ID>` | Inspection & weighing begins |
| `procurement_completed` | `farmer:<ID>`, `center:<ID>` | Purchase record recorded & bill generated |
| `queue_updated` | `center:<ID>` | Any token status change / shift |

### Test Socket.IO in Real Time:
Open another terminal:
```bash
# Listen as farmer F001
node scripts/demo_socket_client.js farmer F001

# Or listen as Mandi display board for C001
node scripts/demo_socket_client.js center C001
```

---

## 5. ML Model Integration & Fallback Logic

### Flow
1. Farmer calls `POST /farmer/token` or `GET /farmer/status/:farmerId`.
2. `WaitingTimeService` collects:
   - `queueLength` (total active in center)
   - `peopleAhead` (farmers ahead in WAITING status)
   - `numberOfCounters` (active center counters)
   - `averageProcessingTime` (center baseline minutes)
   - `hour` (current hour 0-23)
   - `dayOfWeek` (0-6)
3. Node.js issues a `POST` request to `http://localhost:8000/predict-waiting-time` with a 2-second timeout.
4. **If ML service responds**: Returns predicted waiting time factoring in peak hours and queue inertia.
5. **If ML service is unreachable/timed out**: Seamlessly falls back to:
   $$\text{estimatedWaitingTime} = \left\lceil \frac{\text{peopleAhead} \times \text{averageProcessingTime}}{\text{numberOfCounters}} \right\rceil$$

---

## 6. API Reference & Sample Requests/Responses

Standard Response Envelope:
```json
{
  "success": true,
  "message": "Human readable message",
  "data": { ... }
}
```

### 1. Procurement Center Management

#### `GET /centers`
Fetch all active centers with current queue size and availability.
- **Sample Response**:
```json
{
  "success": true,
  "message": "Procurement centers fetched successfully",
  "data": [
    {
      "centerId": "C001",
      "name": "Karnal APMC Grain Mandi",
      "location": {
        "address": "GT Road, Sector 3",
        "district": "Karnal",
        "state": "Haryana"
      },
      "openingTime": "08:00",
      "closingTime": "18:00",
      "dailyCapacity": 150,
      "numberOfCounters": 4,
      "averageProcessingTime": 5,
      "currentQueueSize": 12,
      "availabilityStatus": "AVAILABLE"
    }
  ]
}
```

#### `GET /centers/:id/availability`
Returns one of: `AVAILABLE`, `BUSY`, `FULL`, `CLOSED`.
- **Sample Response**:
```json
{
  "success": true,
  "message": "Center status is AVAILABLE",
  "data": {
    "centerId": "C001",
    "name": "Karnal APMC Grain Mandi",
    "availabilityStatus": "AVAILABLE",
    "activeQueueSize": 12,
    "dailyCapacity": 150,
    "reason": "Center is operating normally with capacity available"
  }
}
```

#### `GET /centers/:id/queue`
Returns active queue tokens partitioned by state (`waiting`, `called`, `inProgress`).
- **Sample Response**:
```json
{
  "success": true,
  "message": "Current queue for center C001",
  "data": {
    "centerId": "C001",
    "totalActive": 3,
    "waitingCount": 1,
    "calledCount": 1,
    "inProgressCount": 1,
    "inProgress": [
      { "tokenNumber": "101", "farmerId": "F001", "crop": "Wheat", "counter": 1 }
    ],
    "called": [
      { "tokenNumber": "102", "farmerId": "F002", "crop": "Wheat", "counter": 2 }
    ],
    "waiting": [
      { "tokenNumber": "103", "farmerId": "F003", "crop": "Wheat", "position": 1, "estimatedWaitingTime": 5 }
    ]
  }
}
```

---

### 2. Farmer Tokens & Queue Status

#### `POST /farmer/token`
Generates token and adds farmer to queue. Rejects duplicate active tokens for the same farmer.
- **Request Body**:
```json
{
  "farmerId": "F001",
  "centerId": "C001",
  "crop": "Wheat",
  "quantityKg": 500
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Token generated successfully",
  "data": {
    "token": 105,
    "tokenNumber": "105",
    "farmerId": "F001",
    "centerId": "C001",
    "crop": "Wheat",
    "position": 7,
    "estimatedWaitingTime": 35,
    "status": "WAITING"
  }
}
```
- **Duplicate Prevention Error (409 Conflict)**:
```json
{
  "success": false,
  "message": "Farmer F001 already has an active token (#105) with status 'WAITING' at center C001"
}
```

#### `GET /farmer/status/:farmerId`
- **Sample Response (200 OK)**:
```json
{
  "success": true,
  "message": "Farmer queue status fetched successfully",
  "data": {
    "token": 105,
    "currentQueuePosition": 7,
    "estimatedWaitingTime": 35,
    "currentStatus": "WAITING",
    "assignedCenter": {
      "centerId": "C001",
      "name": "Karnal APMC Grain Mandi",
      "location": { "district": "Karnal", "state": "Haryana" },
      "numberOfCounters": 4
    },
    "crop": "Wheat"
  }
}
```

---

### 3. Procurement Status Workflow

#### `PUT /procurement/status`
Staff/Admin updates status. Triggers real-time queue position recalculation and Socket.IO alerts.

**Transitions Supported**:
`WAITING` $\to$ `CALLED` $\to$ `IN_PROGRESS` $\to$ `COMPLETED` (or `CANCELLED`).

**1. Call Farmer to Counter**:
```json
{
  "tokenNumber": "105",
  "status": "CALLED",
  "counterNumber": 2,
  "remarks": "Please proceed to Counter 2"
}
```

**2. Mark In Progress**:
```json
{
  "tokenNumber": "105",
  "status": "IN_PROGRESS",
  "counterNumber": 2
}
```

**3. Complete Procurement**:
```json
{
  "tokenNumber": "105",
  "status": "COMPLETED",
  "counterNumber": 2,
  "quantityProcuredKg": 500,
  "qualityGrade": "Grade A",
  "pricePerQuintal": 2275,
  "remarks": "Procured at MSP"
}
```

---

## 7. Testing with Postman

1. Open Postman.
2. Click **Import** $\to$ choose `postman/Smart_Agri_Procurement_APIs.postman_collection.json`.
3. The collection includes pre-configured tests and variables (`{{baseUrl}}`, `{{authToken}}`).
4. Execute **1. Authentication $\to$ Login**: the JWT token will automatically be saved into `{{authToken}}` for subsequent authenticated requests.

---

## 8. Running Automated Verification Tests

## OTP Login

OTP login is available through these endpoints. Send exactly one of `email` or `phone`:

- `POST /api/v1/auth/otp/request` with `{ "email": "user@example.com" }`
- `POST /api/v1/auth/otp/request` with `{ "phone": "+919876543210" }`
- `POST /api/v1/auth/otp/verify` with `{ "email": "user@example.com", "code": "123456" }`
- `POST /api/v1/auth/otp/verify` with `{ "phone": "+919876543210", "code": "123456" }`

Codes are valid for 10 minutes, single-use, and lock after five failed attempts. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` in `.env` to send SMS. Without Twilio settings, development logs and returns the code as `data.devOtp`; production rejects SMS requests until Twilio is configured. A phone number can be supplied during registration and must use international format such as `+919876543210`.

To execute the self-contained verification suite:
```bash
npm test
```
Verifies:
- Mathematical queuing formulas
- Operating hours calculations
- ML service integration & heuristic fallback
- Joi request payload validators
- Socket.IO connection & event emissions

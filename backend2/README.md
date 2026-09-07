# e-KisanSetu Farmer Procurement & Live Mandi Queue Backend

Production-ready backend API service for the **National Smart Farmer Procurement & Live Mandi Queue Management System**.

## Tech Stack
- **Runtime:** Node.js (v26.8+) with ES Modules
- **Framework:** Express.js 4.x
- **Database:** Native SQLite (`node:sqlite`) in WAL mode with ACID transactions
- **Security:** JSON Web Tokens (JWT), BCrypt password hashing, Zod validation
- **Real-Time:** Server-Sent Events (SSE) event stream
- **ML Integration:** Dual-engine (External ML Microservice HTTP POST + Built-in M/M/c Queuing Regressor)
- **API Documentation:** Interactive Swagger UI (OpenAPI 3.0)

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database
Initializes the Pan-India APMC centers (Muradnagar, Modinagar, Khanna, Karnal, Sehore, Lasalgaon), schedules, registered farmers, active tokens, and admin accounts:
```bash
npm run seed
```

### 3. Start Backend Server
```bash
npm start
```
Server starts on `http://localhost:5000`.
- **Interactive Swagger Docs:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **OpenAPI 3.0 Spec:** [http://localhost:5000/api-docs.json](http://localhost:5000/api-docs.json)
- **Real-Time SSE Stream:** [http://localhost:5000/api/v1/events](http://localhost:5000/api/v1/events)

### 4. Run Automated Test Suite
Executes all 16 integration and unit test scenarios:
```bash
npm test
```

### 5. Start ML Microservice Mock (Optional)
Starts the reference Machine Learning inference server on port 5005:
```bash
npm run ml-mock
```

---

## Required API Endpoints Summary

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/centers` | List all procurement centers with filters | Public |
| `GET` | `/centers/:id/schedule` | Center operating schedule and slots | Public |
| `GET` | `/centers/:id/queue` | Live queue (in procurement, called, waiting) | Public |
| `GET` | `/centers/:id/availability` | Center availability, queue length, available slots | Public |
| `POST` | `/farmer/token` | Issue unique token, enter queue, ML wait time | Public |
| `GET` | `/farmer/status` | Live token status, queue position, 5 stages | Public |
| `GET` | `/farmer/waiting-time` | Real-time ML predicted waiting time | Public |
| `PUT` | `/procurement/status` | State transitions (`WAITING`→`CALLED`→`IN_PROCUREMENT`→`COMPLETED`) | **Admin / JWT** |
| `PUT` | `/centers/:id/schedule` | Update procurement schedule & slot capacity | **Admin / JWT** |
| `PUT` | `/centers/:id/queue` | Administrative queue reordering | **Admin / JWT** |
| `POST` | `/notifications` | Dispatch farmer notifications | Public |
| `GET` | `/notifications` | Retrieve farmer notification inbox | Public |
| `GET` | `/events` | Real-time Server-Sent Events stream | Public |
| `POST` | `/auth/login` | Officer / Admin login for JWT token | Public |
| `POST` | `/ml/predict` | Direct inference request to ML predictor | Public |

---

## Default Admin Credentials
- **Superadmin:** `admin` / `MandiAdmin#2026`
- **Center Officer:** `officer_gzb` / `Officer#2026`
- **Master Development Key:** `x-api-key: kisan_mandi_admin_key_2026`

---

## Architectural Highlights

### 1. Atomic Queue Re-ordering
Whenever a token status changes (`CALLED`, `IN_PROCUREMENT`, `COMPLETED`, `CANCELLED`), an ACID transaction re-indexes remaining waiting farmers sequentially (1, 2, 3...) and automatically triggers an alert if a farmer enters the top 3 positions (`TURN_APPROACHING`).

### 2. Dual-Engine ML Prediction
1. **HTTP Client**: Calls external ML microservice at `http://localhost:5005/predict`.
2. **Queuing Theory Fallback**: When external ML service is offline, automatically evaluates an M/M/c queuing algorithm with vehicle unloading latency and crop moisture assay weights to guarantee high availability.

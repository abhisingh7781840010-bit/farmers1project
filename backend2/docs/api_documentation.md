# e-KisanSetu Backend API Documentation

**System:** Real-Time Farmer Procurement Management System  
**Module:** Queue Management, Token Generation & API Gateway  
**Base URL:** `http://localhost:5000/api/v1` (also accessible directly at `http://localhost:5000`)  
**Interactive Swagger UI:** `http://localhost:5000/api-docs`  
**OpenAPI JSON:** `http://localhost:5000/api-docs.json`  

---

## 1. Authentication & Security

### Admin / Center Officer Authentication
Endpoints that modify system state (`PUT /procurement/status`, `PUT /centers/:id/schedule`, `PUT /centers/:id/queue`) require authentication via either:
1. **Bearer JWT Token**:
   `Authorization: Bearer <jwt_token>`
2. **Development API Key**:
   `x-api-key: kisan_mandi_admin_key_2026`

### Seeded Credentials
| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `MandiAdmin#2026` | Full Pan-India Mandi access |
| **Center Officer** | `officer_gzb` | `Officer#2026` | Muradnagar Depot Yard Officer |

#### Login Endpoint
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "MandiAdmin#2026"
}
```

---

## 2. Real-Time Server-Sent Events (SSE)

Frontend applications can establish a persistent, live stream to receive instant queue movements and token calls without polling:

```http
GET /api/v1/events?centerId=up_c1
Accept: text/event-stream
```

### JavaScript Client Example
```javascript
const eventSource = new EventSource('http://localhost:5000/api/v1/events?centerId=up_c1');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time event:', data.event, data);

  if (data.event === 'queue_updated') {
    refreshQueueView();
  } else if (data.event === 'farmer_called') {
    showAudioAnnounce(data.data.token);
  }
};
```

---

## 3. Centers & Schedules APIs

### 3.1 List Procurement Centers
```http
GET /api/v1/centers?state=Uttar Pradesh&status=open
```
**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "up_c1",
      "code": "#UP-GZB-MND-01",
      "name": "Center A",
      "sub_name": "Muradnagar Main Government Grain Depot",
      "state": "Uttar Pradesh",
      "district": "Ghaziabad",
      "lat": 28.7750,
      "lng": 77.5020,
      "status": "open",
      "capacity_per_day": 80,
      "active_bays": 4,
      "contact_phone": "+91-120-2812345",
      "supported_crops": ["Wheat", "Paddy (Common)", "Mustard / Rapeseed", "Gram (Chana)"]
    }
  ]
}
```

### 3.2 Check Center Availability
```http
GET /api/v1/centers/up_c1/availability
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "centerId": "up_c1",
    "centerCode": "#UP-GZB-MND-01",
    "centerName": "Center A",
    "isAvailable": true,
    "currentQueueLength": 2,
    "activeProcurementCount": 1,
    "calledCount": 1,
    "availableProcurementSlots": 77,
    "totalProcurementSlots": 80,
    "bookedProcurementSlots": 3,
    "currentOperatingSchedule": {
      "date": "2026-09-05",
      "openTime": "08:00",
      "closeTime": "18:00",
      "isHoliday": false
    },
    "estimatedWaitTimeForNewToken": {
      "predictedWaitMinutes": 18,
      "estimatedCallTime": "2026-09-05T16:45:00.000Z",
      "formattedCallTime": "10:15 PM"
    }
  }
}
```

### 3.3 Get Live Center Queue
```http
GET /api/v1/centers/up_c1/queue
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "center": {
      "id": "up_c1",
      "name": "Center A",
      "activeBays": 4
    },
    "summary": {
      "totalWaiting": 2,
      "inProcurementCount": 1,
      "calledCount": 1,
      "avgWaitMinutes": 14
    },
    "queue": {
      "inProcurement": [
        {
          "token_number": "UP-GZB-2026-0001",
          "farmer_name": "Ramesh Chandra Kumar",
          "crop_name": "Wheat",
          "currentStage": { "stage_name": "Electronic Weighbridge Gross", "status": "IN_PROGRESS" }
        }
      ],
      "called": [
        {
          "token_number": "UP-GZB-2026-0002",
          "farmer_name": "Jagdish Chandra Tyagi"
        }
      ],
      "waiting": [
        {
          "token_number": "UP-GZB-2026-0003",
          "queue_position": 1,
          "farmer_name": "Harish Verma",
          "predictedWaitMinutes": 12,
          "formattedCallTime": "10:05 PM"
        }
      ]
    }
  }
}
```

### 3.4 Update Schedule (Admin Protected)
```http
PUT /api/v1/centers/up_c1/schedule
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "scheduleDate": "2026-09-06",
  "openTime": "07:30",
  "closeTime": "19:00",
  "totalSlots": 100,
  "isHoliday": false,
  "notes": "Extended shift for bumper wheat arrivals"
}
```

---

## 4. Farmer & Token Management APIs

### 4.1 Generate Procurement Token
```http
POST /api/v1/farmer/token
Content-Type: application/json

{
  "farmerId": "FARMER-884120",
  "centerId": "up_c1",
  "cropId": "wheat",
  "cropName": "Wheat",
  "category": "cereals",
  "estimatedQuantityQtl": 35.5,
  "vehicleType": "Tractor-Trolley",
  "vehicleNumber": "UP-14-BT-1088",
  "scheduledDate": "2026-09-05"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Procurement token generated successfully",
  "data": {
    "token": {
      "id": 4,
      "tokenNumber": "UP-GZB-20260905-0004",
      "status": "WAITING",
      "queuePosition": 2,
      "scheduledDate": "2026-09-05",
      "scheduledSlotTime": "08:30 AM",
      "crop": { "id": "wheat", "name": "Wheat", "quantityQtl": 35.5 },
      "vehicle": { "type": "Tractor-Trolley", "number": "UP-14-BT-1088" }
    },
    "waitingTime": {
      "predictedWaitMinutes": 16,
      "estimatedCallTime": "2026-09-05T16:35:00.000Z",
      "formattedCallTime": "10:05 PM",
      "confidenceScore": 0.94,
      "predictionSource": "BUILTIN_ML_MODEL"
    },
    "qrCodeString": "KISANSETU|TOKEN:UP-GZB-20260905-0004|CENTER:#UP-GZB-MND-01|FARMER:FARMER-884120"
  }
}
```

### 4.2 Get Farmer Token Live Status
```http
GET /api/v1/farmer/status?tokenNumber=UP-GZB-20260905-0004
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tokenId": 4,
    "tokenNumber": "UP-GZB-20260905-0004",
    "status": "WAITING",
    "queuePosition": 2,
    "vehiclesAhead": 1,
    "scheduledSlotTime": "08:30 AM",
    "farmer": {
      "name": "Ramesh Chandra Kumar",
      "phone": "+91-9876543210"
    },
    "waitingTime": {
      "predictedWaitMinutes": 16,
      "formattedCallTime": "10:05 PM"
    },
    "stages": [
      { "stage_number": 1, "stage_name": "Token Generation & Verification", "status": "COMPLETED" },
      { "stage_number": 2, "stage_name": "Gate Entry & Security Check", "status": "PENDING" },
      { "stage_number": 3, "stage_name": "Moisture & Quality Assay", "status": "PENDING" },
      { "stage_number": 4, "stage_name": "Electronic Weighbridge Gross Measurement", "status": "PENDING" },
      { "stage_number": 5, "stage_name": "DBT Direct Bank Transfer Payout", "status": "PENDING" }
    ]
  }
}
```

---

## 5. Procurement Status Transitions (Admin Protected)

### 5.1 Update Procurement Status
Valid state transitions:
- `WAITING` → `CALLED`
- `CALLED` → `IN_PROCUREMENT`
- `IN_PROCUREMENT` → `COMPLETED`
- `WAITING` → `CANCELLED`
- `CALLED` → `CANCELLED`

```http
PUT /api/v1/procurement/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "tokenId": "UP-GZB-20260905-0004",
  "newStatus": "CALLED",
  "reason": "Security Gate 1 is clear",
  "inspectorName": "Inspector Rajveer"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Procurement status updated to 'CALLED'",
  "data": {
    "token": {
      "id": 4,
      "token_number": "UP-GZB-20260905-0004",
      "status": "CALLED",
      "queue_position": 0
    },
    "previousStatus": "WAITING",
    "newStatus": "CALLED",
    "remainingWaitingCount": 1
  }
}
```
*(Notice: When Token 4 is called, the backend automatically decrements and updates all subsequent farmers' queue positions and fires real-time SSE events and SMS alerts!)*

---

## 6. Notifications APIs

### 6.1 Dispatch Custom Notification
```http
POST /api/v1/notifications
Content-Type: application/json

{
  "farmerId": "FARMER-884120",
  "centerId": "up_c1",
  "eventType": "TURN_APPROACHING",
  "title": "Turn Approaching",
  "message": "Please move your tractor towards Gate 1."
}
```

### 6.2 Get Farmer Notification History
```http
GET /api/v1/notifications?farmerId=FARMER-884120
```

---

## 7. Machine Learning Waiting-Time Integration

The backend coordinates with the ML model through a dual architecture:
1. **External ML Microservice HTTP POST** to `http://localhost:5005/predict`:
   - Feature payload sent:
     ```json
     {
       "center_id": "up_c1",
       "queue_position": 3,
       "active_bays": 4,
       "crop_id": "wheat",
       "crop_name": "Wheat",
       "vehicle_type": "Tractor-Trolley",
       "estimated_quantity_qtl": 35.0,
       "hour_of_day": 11,
       "avg_recent_procurement_minutes": 14.5
     }
     ```
2. **Built-in Queuing Regression Fallback**:
   - If the ML microservice is offline, the backend evaluates an M/M/c queuing model with vehicle and crop latency weights to provide uninterrupted 99.9% uptime.

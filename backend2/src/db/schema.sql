-- ==========================================================
-- e-KisanSetu: Farmer Procurement & Live Mandi Queue System
-- Database Schema (SQLite / node:sqlite)
-- ==========================================================

PRAGMA foreign_keys = ON;

-- 1. Procurement Centers (APMC Mandis / Purchase Yards)
CREATE TABLE IF NOT EXISTS centers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sub_name TEXT,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'busy', 'closed', 'maintenance')),
    capacity_per_day INTEGER NOT NULL DEFAULT 50,
    active_bays INTEGER NOT NULL DEFAULT 4,
    contact_phone TEXT,
    supported_crops TEXT, -- JSON Array of crop names/IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Operating Schedules for Centers
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id TEXT NOT NULL,
    schedule_date TEXT NOT NULL, -- Format: YYYY-MM-DD
    open_time TEXT NOT NULL DEFAULT '08:00',
    close_time TEXT NOT NULL DEFAULT '18:00',
    total_slots INTEGER NOT NULL DEFAULT 50,
    booked_slots INTEGER NOT NULL DEFAULT 0,
    slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_holiday INTEGER NOT NULL DEFAULT 0 CHECK (is_holiday IN (0, 1)),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
    UNIQUE(center_id, schedule_date)
);

-- 3. Farmers Master Registry
CREATE TABLE IF NOT EXISTS farmers (
    id TEXT PRIMARY KEY,
    registration_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    aadhaar_masked TEXT,
    bank_account_masked TEXT,
    land_holding_hectares REAL DEFAULT 2.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Farmer Tokens & Real-Time Queue Table
CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_number TEXT NOT NULL UNIQUE,
    farmer_id TEXT NOT NULL,
    center_id TEXT NOT NULL,
    crop_id TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    category TEXT DEFAULT 'cereals',
    estimated_quantity_qtl REAL NOT NULL,
    vehicle_type TEXT DEFAULT 'Tractor-Trolley' CHECK (vehicle_type IN ('Tractor-Trolley', 'Mini-Truck', 'Pickup', 'Bullock-Cart', 'Truck')),
    vehicle_number TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('REGISTERED', 'WAITING', 'CALLED', 'IN_PROCUREMENT', 'PROCESSING', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
    queue_position INTEGER NOT NULL DEFAULT 0, -- 1-indexed for waiting farmers, 0 when active/done
    initial_position INTEGER NOT NULL DEFAULT 0,
    scheduled_date TEXT NOT NULL, -- YYYY-MM-DD
    scheduled_slot_time TEXT, -- e.g. 09:30 AM
    called_at DATETIME,
    procurement_start_at DATETIME,
    completed_at DATETIME,
    cancelled_at DATETIME,
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_center_status_pos ON tokens(center_id, status, queue_position);
CREATE INDEX IF NOT EXISTS idx_tokens_farmer ON tokens(farmer_id);
CREATE INDEX IF NOT EXISTS idx_tokens_number ON tokens(token_number);

-- 5. 5-Stage Procurement Progress Tracking
CREATE TABLE IF NOT EXISTS procurement_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    stage_number INTEGER NOT NULL, -- 1: Token, 2: Gate Security, 3: Moisture Check, 4: Weighbridge, 5: DBT Payout
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'COMPLETED')),
    notes TEXT,
    inspector_name TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_procurement_stages_token ON procurement_stages(token_id);

-- 6. ML Waiting-Time Prediction Audit & Historical Logs
CREATE TABLE IF NOT EXISTS waiting_time_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER,
    center_id TEXT NOT NULL,
    queue_position INTEGER NOT NULL,
    predicted_wait_minutes INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'BUILTIN_ML_MODEL' CHECK (source IN ('EXTERNAL_ML_API', 'BUILTIN_ML_MODEL', 'HEURISTIC_FALLBACK')),
    confidence_score REAL DEFAULT 0.92,
    features_json TEXT, -- Serialized input feature vector
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL,
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE
);

-- 7. Notifications Log & Real-Time Inbox
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id TEXT NOT NULL,
    token_id INTEGER,
    center_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'TOKEN_GENERATED',
        'QUEUE_MOVED',
        'TURN_APPROACHING',
        'FARMER_CALLED',
        'PROCUREMENT_STARTED',
        'PROCUREMENT_COMPLETED',
        'PROCUREMENT_CANCELLED',
        'SCHEDULE_CHANGED'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'SMS+IN_APP',
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL,
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_farmer ON notifications(farmer_id, created_at DESC);

-- 8. Admin & Center Procurement Officers (Role-Based Access)
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CENTER_OFFICER' CHECK (role IN ('SUPERADMIN', 'CENTER_OFFICER', 'INSPECTOR')),
    center_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE SET NULL
);

-- 9. OTP Sessions (Real SMS OTP Verification)
CREATE TABLE IF NOT EXISTS otp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    otp_hash TEXT NOT NULL,           -- bcrypt hash of OTP for security
    purpose TEXT NOT NULL DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN', 'REGISTER', 'RESET')),
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
    attempts INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_expires ON otp_sessions(phone, expires_at);

-- 10. Farmer Extended Profile (for real data collection)
-- These columns are added safely with IF NOT EXISTS logic handled in initDb
CREATE TABLE IF NOT EXISTS farmer_profiles (
    farmer_id TEXT PRIMARY KEY,
    dob TEXT,                          -- Date of birth YYYY-MM-DD
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    aadhaar_last4 TEXT,                -- Only last 4 digits stored
    pmkisan_id TEXT,                   -- PM-KISAN beneficiary ID
    village TEXT,
    block_name TEXT,
    land_acres REAL,
    land_type TEXT CHECK (land_type IN ('Irrigated', 'Rain-fed', 'Mixed')),
    crops_grown TEXT,                  -- JSON array of crop names
    ifsc_code TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    account_number_masked TEXT,        -- e.g. XXXX XXXX 1234
    photo_url TEXT,                    -- Path or base64 of farmer photo
    is_verified INTEGER DEFAULT 0,     -- 1 = verified by center officer
    verification_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

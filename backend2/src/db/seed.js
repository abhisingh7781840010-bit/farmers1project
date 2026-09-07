import bcrypt from 'bcryptjs';
import { initDb, queryOne, run, transaction } from './connection.js';

export async function seed() {
  console.log('🌱 Initializing database schema...');
  initDb();

  console.log('🌱 Seeding initial procurement data...');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const adminHash = bcrypt.hashSync('MandiAdmin#2026', 10);
  const officerHash = bcrypt.hashSync('Officer#2026', 10);

  transaction(() => {
    // 1. Centers
    const centers = [
      {
        id: 'up_c1',
        code: '#UP-GZB-MND-01',
        name: 'Center A',
        sub_name: 'Muradnagar Main Government Grain Depot',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        address: 'Near Old Bus Stand, GT Road, Muradnagar, UP - 201206',
        lat: 28.7750,
        lng: 77.5020,
        status: 'open',
        capacity_per_day: 80,
        active_bays: 4,
        contact_phone: '+91-120-2812345',
        crops: JSON.stringify(['Wheat', 'Paddy (Common)', 'Mustard / Rapeseed', 'Gram (Chana)'])
      },
      {
        id: 'up_c2',
        code: '#UP-GZB-MND-02',
        name: 'Center B',
        sub_name: 'Modinagar Regional Procurement Hub',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        address: 'Delhi-Meerut Expressway Link, Modinagar, UP - 201204',
        lat: 28.8350,
        lng: 77.5810,
        status: 'busy',
        capacity_per_day: 60,
        active_bays: 3,
        contact_phone: '+91-120-2856789',
        crops: JSON.stringify(['Wheat', 'Sugarcane (FRP/SAP)', 'Paddy (Grade A)', 'Moong'])
      },
      {
        id: 'up_c3',
        code: '#UP-GZB-MND-03',
        name: 'Center C',
        sub_name: 'Loni Border Purchase Depot',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        address: 'Sector 3 Mandi Yard, Loni Border, Ghaziabad, UP',
        lat: 28.7490,
        lng: 77.2910,
        status: 'closed',
        capacity_per_day: 40,
        active_bays: 2,
        contact_phone: '+91-120-2899111',
        crops: JSON.stringify(['Mustard / Rapeseed', 'Bajra (Pearl Millet)'])
      },
      {
        id: 'up_c4',
        code: '#UP-GZB-MND-04',
        name: 'Center D',
        sub_name: 'Govindpuram PACS Cooperative Yard',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        address: 'Kavi Nagar Extn, Govindpuram, Ghaziabad, UP - 201013',
        lat: 28.6820,
        lng: 77.4980,
        status: 'open',
        capacity_per_day: 70,
        active_bays: 4,
        contact_phone: '+91-120-2834567',
        crops: JSON.stringify(['Wheat', 'Paddy (Common)', 'Gram (Chana)'])
      },
      {
        id: 'pb_c1',
        code: '#PB-LDH-KHN-01',
        name: 'Khanna Mega APMC Yard',
        sub_name: "Asia's Largest Grain Terminal",
        state: 'Punjab',
        district: 'Khanna',
        address: 'Grand Trunk Road, Khanna, Punjab - 141401',
        lat: 30.7065,
        lng: 76.2163,
        status: 'open',
        capacity_per_day: 200,
        active_bays: 8,
        contact_phone: '+91-1628-223344',
        crops: JSON.stringify(['Wheat', 'Paddy (Grade A)', 'Maize', 'Barley'])
      },
      {
        id: 'hr_c1',
        code: '#HR-KRN-TAR-01',
        name: 'Karnal Taraori Rice & Grain Terminal',
        sub_name: 'Haryana State APMC Purchase Yard',
        state: 'Haryana',
        district: 'Karnal',
        address: 'National Highway 44, Taraori, Karnal - 132116',
        lat: 29.8000,
        lng: 76.9200,
        status: 'open',
        capacity_per_day: 120,
        active_bays: 6,
        contact_phone: '+91-1744-245678',
        crops: JSON.stringify(['Paddy (Common)', 'Paddy (Grade A)', 'Wheat', 'Mustard / Rapeseed'])
      },
      {
        id: 'mp_c1',
        code: '#MP-SEH-KUM-01',
        name: 'Sehore Krishi Upaj Mandi',
        sub_name: 'Sharbati Wheat & Soybean Apex Terminal',
        state: 'Madhya Pradesh',
        district: 'Sehore',
        address: 'Indore-Bhopal Highway, Sehore, MP - 466001',
        lat: 23.2031,
        lng: 77.0844,
        status: 'open',
        capacity_per_day: 110,
        active_bays: 5,
        contact_phone: '+91-7562-224466',
        crops: JSON.stringify(['Wheat', 'Soybean (Yellow)', 'Gram (Chana)', 'Moong'])
      },
      {
        id: 'mh_c1',
        code: '#MH-NSK-LAS-01',
        name: 'Lasalgaon APMC Market Yard',
        sub_name: 'Maharashtra State Procurement Terminal',
        state: 'Maharashtra',
        district: 'Nashik',
        address: 'Niphad Road, Lasalgaon, Nashik, MH - 422306',
        lat: 20.1466,
        lng: 74.2284,
        status: 'open',
        capacity_per_day: 100,
        active_bays: 5,
        contact_phone: '+91-2550-266100',
        crops: JSON.stringify(['Soybean (Yellow)', 'Maize', 'Gram (Chana)', 'Groundnut (in shell)'])
      }
    ];

    for (const c of centers) {
      run(
        `INSERT INTO centers (id, code, name, sub_name, state, district, address, lat, lng, status, capacity_per_day, active_bays, contact_phone, supported_crops)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status, capacity_per_day=excluded.capacity_per_day, active_bays=excluded.active_bays, supported_crops=excluded.supported_crops`,
        [c.id, c.code, c.name, c.sub_name, c.state, c.district, c.address, c.lat, c.lng, c.status, c.capacity_per_day, c.active_bays, c.contact_phone, c.crops]
      );

      // Seed schedules for today and tomorrow
      for (const sDate of [today, tomorrow]) {
        run(
          `INSERT INTO schedules (center_id, schedule_date, open_time, close_time, total_slots, booked_slots, is_holiday, notes)
           VALUES (?, ?, '08:00', '18:00', ?, 0, 0, 'Standard Mandi Procurement Shift')
           ON CONFLICT(center_id, schedule_date) DO NOTHING`,
          [c.id, sDate, c.capacity_per_day]
        );
      }
    }

    // 2. Admin Users
    run(
      `INSERT INTO admin_users (id, username, password_hash, full_name, role, center_id)
       VALUES ('ADM-001', 'admin', ?, 'Chief Mandi Procurement Administrator', 'SUPERADMIN', NULL)
       ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`,
      [adminHash]
    );

    run(
      `INSERT INTO admin_users (id, username, password_hash, full_name, role, center_id)
       VALUES ('ADM-002', 'officer_gzb', ?, 'Rajesh Sharma (Center In-Charge)', 'CENTER_OFFICER', 'up_c1')
       ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`,
      [officerHash]
    );

    // 3. Farmers
    const farmers = [
      {
        id: 'FARMER-884120',
        reg: 'IND-KISAN-884120',
        name: 'Ramesh Chandra Kumar',
        phone: '+91-9876543210',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        aadhaar: 'XXXX-XXXX-4921',
        bank: 'SBI (A/C: ****5582)',
        land: 3.5
      },
      {
        id: 'FARMER-884121',
        reg: 'IND-KISAN-884121',
        name: 'Baldev Singh Dhillon',
        phone: '+91-9876543211',
        state: 'Punjab',
        district: 'Khanna',
        aadhaar: 'XXXX-XXXX-8910',
        bank: 'PNB (A/C: ****1129)',
        land: 7.2
      },
      {
        id: 'FARMER-884122',
        reg: 'IND-KISAN-884122',
        name: 'Suresh Bhai Patel',
        phone: '+91-9876543212',
        state: 'Gujarat',
        district: 'Unjha',
        aadhaar: 'XXXX-XXXX-3341',
        bank: 'BOB (A/C: ****8840)',
        land: 4.8
      },
      {
        id: 'FARMER-884123',
        reg: 'IND-KISAN-884123',
        name: 'Jagdish Chandra Tyagi',
        phone: '+91-9876543213',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        aadhaar: 'XXXX-XXXX-6612',
        bank: 'SBI (A/C: ****3019)',
        land: 2.2
      },
      {
        id: 'FARMER-884124',
        reg: 'IND-KISAN-884124',
        name: 'Harish Verma',
        phone: '+91-9876543214',
        state: 'Uttar Pradesh',
        district: 'Ghaziabad',
        aadhaar: 'XXXX-XXXX-7729',
        bank: 'HDFC (A/C: ****9102)',
        land: 5.0
      }
    ];

    for (const f of farmers) {
      run(
        `INSERT INTO farmers (id, registration_number, name, phone, state, district, aadhaar_masked, bank_account_masked, land_holding_hectares)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone`,
        [f.id, f.reg, f.name, f.phone, f.state, f.district, f.aadhaar, f.bank, f.land]
      );
    }

    // 4. Initial Tokens for Muradnagar (up_c1) to create an active queue
    const existingTokens = queryOne(`SELECT COUNT(*) as count FROM tokens WHERE center_id = 'up_c1' AND scheduled_date = ?`, [today]);

    if (!existingTokens || existingTokens.count === 0) {
      // Token A: In Procurement (at weighbridge)
      run(
        `INSERT INTO tokens (token_number, farmer_id, center_id, crop_id, crop_name, category, estimated_quantity_qtl, vehicle_type, vehicle_number, status, queue_position, initial_position, scheduled_date, scheduled_slot_time, called_at, procurement_start_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROCUREMENT', 0, 1, ?, '09:00 AM', datetime('now', '-30 minutes'), datetime('now', '-15 minutes'))`,
        ['UP-GZB-2026-0001', 'FARMER-884120', 'up_c1', 'wheat', 'Wheat', 'cereals', 45.0, 'Tractor-Trolley', 'UP-14-AA-1001', today]
      );

      // Token B: Called (at gate security)
      run(
        `INSERT INTO tokens (token_number, farmer_id, center_id, crop_id, crop_name, category, estimated_quantity_qtl, vehicle_type, vehicle_number, status, queue_position, initial_position, scheduled_date, scheduled_slot_time, called_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CALLED', 0, 2, ?, '09:30 AM', datetime('now', '-5 minutes'))`,
        ['UP-GZB-2026-0002', 'FARMER-884123', 'up_c1', 'wheat', 'Wheat', 'cereals', 30.0, 'Mini-Truck', 'UP-14-BT-2045', today]
      );

      // Token C: Waiting #1
      run(
        `INSERT INTO tokens (token_number, farmer_id, center_id, crop_id, crop_name, category, estimated_quantity_qtl, vehicle_type, vehicle_number, status, queue_position, initial_position, scheduled_date, scheduled_slot_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', 1, 3, ?, '10:00 AM')`,
        ['UP-GZB-2026-0003', 'FARMER-884124', 'up_c1', 'mustard', 'Mustard / Rapeseed', 'oilseeds', 25.0, 'Pickup', 'UP-14-CP-8921', today]
      );

      // Update booked_slots in schedule
      run(`UPDATE schedules SET booked_slots = 3 WHERE center_id = 'up_c1' AND schedule_date = ?`, [today]);

      // Seed procurement stages for Token 1 (In Procurement)
      const t1 = queryOne(`SELECT id FROM tokens WHERE token_number = 'UP-GZB-2026-0001'`);
      if (t1) {
        run(`INSERT INTO procurement_stages (token_id, stage_number, stage_name, status, notes, inspector_name) VALUES (?, 1, 'Token Generation', 'COMPLETED', 'Token issued at terminal', 'Self-Kiosk')`, [t1.id]);
        run(`INSERT INTO procurement_stages (token_id, stage_number, stage_name, status, notes, inspector_name) VALUES (?, 2, 'Gate Entry Security', 'PASSED', 'Vehicle QR verified', 'Inspector Rajveer')`, [t1.id]);
        run(`INSERT INTO procurement_stages (token_id, stage_number, stage_name, status, notes, inspector_name) VALUES (?, 3, 'Moisture & Quality Assay', 'PASSED', 'Moisture: 11.2% (FAQ compliant)', 'Lab Officer Meena')`, [t1.id]);
        run(`INSERT INTO procurement_stages (token_id, stage_number, stage_name, status, notes, inspector_name) VALUES (?, 4, 'Electronic Weighbridge Gross', 'IN_PROGRESS', 'Gross weighbridge calibration active', 'Operator Dinesh')`, [t1.id]);
        run(`INSERT INTO procurement_stages (token_id, stage_number, stage_name, status, notes, inspector_name) VALUES (?, 5, 'DBT Direct Bank Transfer Payout', 'PENDING', 'Awaiting net weight sign-off', 'PFMS Gateway')`, [t1.id]);
      }

      // Seed notifications
      const t3 = queryOne(`SELECT id FROM tokens WHERE token_number = 'UP-GZB-2026-0003'`);
      run(
        `INSERT INTO notifications (farmer_id, token_id, center_id, event_type, title, message, channel)
         VALUES ('FARMER-884124', ?, 'up_c1', 'TOKEN_GENERATED', 'Token Confirmed: UP-GZB-2026-0003', 'Your token is generated for Muradnagar Depot. Current position in queue: 1. Estimated wait: ~15 mins.', 'SMS+IN_APP')`,
        [t3 ? t3.id : null]
      );
    }
  });

  console.log('✅ Seeding completed successfully!');
}

// Run standalone if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

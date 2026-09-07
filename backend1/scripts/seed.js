const mongoose = require('mongoose');
const config = require('../config/config');
const ProcurementCenter = require('../models/ProcurementCenter');
const Schedule = require('../models/Schedule');
const Farmer = require('../models/Farmer');
const User = require('../models/User');
const Token = require('../models/Token');
const Procurement = require('../models/Procurement');
const logger = require('../utils/logger');

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const seedData = async () => {
  try {
    logger.info(`Connecting to MongoDB at ${config.mongoUri}...`);
    await mongoose.connect(config.mongoUri);
    logger.info('Connected to MongoDB.');

    // Clear existing collections for clean seed
    await ProcurementCenter.deleteMany({});
    await Schedule.deleteMany({});
    await Farmer.deleteMany({});
    await User.deleteMany({});
    await Token.deleteMany({});
    await Procurement.deleteMany({});
    logger.info('Cleaned existing database collections.');

    // 1. Seed Procurement Centers
    const centers = [
      {
        centerId: 'C001',
        name: 'Karnal APMC Grain Mandi',
        location: {
          address: 'GT Road, Sector 3',
          district: 'Karnal',
          state: 'Haryana',
          pincode: '132001',
          coordinates: { latitude: 29.6857, longitude: 76.9905 }
        },
        openingTime: '08:00',
        closingTime: '18:00',
        dailyCapacity: 150,
        numberOfCounters: 4,
        averageProcessingTime: 5,
        supportedCrops: ['Wheat', 'Paddy', 'Mustard']
      },
      {
        centerId: 'C002',
        name: 'Ludhiana Central Procurement Hub',
        location: {
          address: 'Gill Road, Near Grain Market',
          district: 'Ludhiana',
          state: 'Punjab',
          pincode: '141003',
          coordinates: { latitude: 30.9010, longitude: 75.8573 }
        },
        openingTime: '09:00',
        closingTime: '17:00',
        dailyCapacity: 100,
        numberOfCounters: 3,
        averageProcessingTime: 6,
        supportedCrops: ['Wheat', 'Basmati Rice', 'Maize']
      },
      {
        centerId: 'C003',
        name: 'Indore Krishi Upaj Mandi',
        location: {
          address: 'Chhavani, Mandi Complex',
          district: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452001',
          coordinates: { latitude: 22.7196, longitude: 75.8577 }
        },
        openingTime: '09:00',
        closingTime: '18:00',
        dailyCapacity: 80,
        numberOfCounters: 2,
        averageProcessingTime: 5,
        supportedCrops: ['Soybean', 'Wheat', 'Gram']
      }
    ];

    await ProcurementCenter.insertMany(centers);
    logger.info(`Seeded ${centers.length} Procurement Centers.`);

    // 2. Seed Weekly Schedules for each center
    const schedules = [];
    for (const center of centers) {
      for (let day = 0; day < 7; day++) {
        const isSunday = day === 0;
        schedules.push({
          centerId: center.centerId,
          dayOfWeek: day,
          dayName: dayNames[day],
          openingTime: center.openingTime,
          closingTime: center.closingTime,
          isOperational: !isSunday, // Sunday is closed
          maxDailyTokens: center.dailyCapacity,
          remarks: isSunday ? 'Weekly Maintenance' : 'Regular Procurement Operations'
        });
      }
    }
    await Schedule.insertMany(schedules);
    logger.info(`Seeded ${schedules.length} Schedule records.`);

    // 3. Seed Registered Farmers
    const farmers = [
      {
        farmerId: 'F001',
        name: 'Ramesh Kumar',
        phone: '9876543210',
        aadhaarNumber: 'XXXX-XXXX-1234',
        address: {
          village: 'Taraori',
          district: 'Karnal',
          state: 'Haryana',
          pincode: '132116'
        },
        cropsCultivated: ['Wheat', 'Mustard']
      },
      {
        farmerId: 'F002',
        name: 'Suresh Patel',
        phone: '9876543211',
        aadhaarNumber: 'XXXX-XXXX-5678',
        address: {
          village: 'Nissing',
          district: 'Karnal',
          state: 'Haryana',
          pincode: '132024'
        },
        cropsCultivated: ['Wheat', 'Paddy']
      },
      {
        farmerId: 'F003',
        name: 'Balvinder Singh',
        phone: '9876543212',
        aadhaarNumber: 'XXXX-XXXX-9012',
        address: {
          village: 'Samrala',
          district: 'Ludhiana',
          state: 'Punjab',
          pincode: '141114'
        },
        cropsCultivated: ['Wheat', 'Basmati Rice']
      },
      {
        farmerId: 'F004',
        name: 'Jagdish Sharma',
        phone: '9876543213',
        aadhaarNumber: 'XXXX-XXXX-3456',
        address: {
          village: 'Depalpur',
          district: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '453115'
        },
        cropsCultivated: ['Soybean', 'Wheat']
      },
      {
        farmerId: 'F005',
        name: 'Rajinder Kaur',
        phone: '9876543214',
        aadhaarNumber: 'XXXX-XXXX-7890',
        address: {
          village: 'Taraori',
          district: 'Karnal',
          state: 'Haryana',
          pincode: '132116'
        },
        cropsCultivated: ['Wheat', 'Paddy']
      }
    ];

    await Farmer.insertMany(farmers);
    logger.info(`Seeded ${farmers.length} Farmers.`);

    // 4. Seed Users (Admin & Mandi Counter Operators)
    const users = [
      {
        name: 'State Procurement Administrator',
        email: 'admin@agri.gov.in',
        password: 'Admin@12345',
        role: 'admin'
      },
      {
        name: 'Karnal Counter 1 Operator',
        email: 'operator1@karnal.mandi.gov.in',
        password: 'Staff@12345',
        role: 'staff',
        assignedCenterId: 'C001',
        counterNumber: 1
      },
      {
        name: 'Karnal Counter 2 Operator',
        email: 'operator2@karnal.mandi.gov.in',
        password: 'Staff@12345',
        role: 'staff',
        assignedCenterId: 'C001',
        counterNumber: 2
      }
    ];

    for (const u of users) {
      await User.create(u);
    }
    logger.info(`Seeded ${users.length} Users (Admin & Operators).`);

    logger.info('=============================================');
    logger.info('  DATABASE SEEDING COMPLETED SUCCESSFULLY!   ');
    logger.info('=============================================');
    logger.info('Sample Login Credentials:');
    logger.info('  Admin : admin@agri.gov.in / Admin@12345');
    logger.info('  Staff : operator1@karnal.mandi.gov.in / Staff@12345');
    logger.info('Sample Center IDs: C001, C002, C003');
    logger.info('Sample Farmer IDs: F001, F002, F003, F004');
    logger.info('=============================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
};

seedData();

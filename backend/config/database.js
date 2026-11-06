const mysql = require('mysql2');
require('dotenv').config();

const RETRYABLE_DB_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
]);

/**
 * Wrap promise pool query/execute with automatic retry for stale/dropped connections.
 * MySQL servers (esp. remote/cloud) close idle sockets; the pool may hand out a dead one.
 */
const wrapPoolWithRetry = (pool, maxRetries = 3) => {
  const retry = (methodName) => async (...args) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await pool[methodName](...args);
      } catch (error) {
        lastError = error;
        const retryable = RETRYABLE_DB_CODES.has(error.code);
        if (!retryable || attempt === maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 80 * attempt));
      }
    }
    throw lastError;
  };

  return {
    query: retry('query'),
    execute: retry('execute'),
    getConnection: (...args) => pool.getConnection(...args),
    end: (...args) => pool.end(...args),
    on: (...args) => pool.on(...args),
    pool,
  };
};

const sharedPoolOptions = {
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // TCP keepalive after 10s idle
  multipleStatements: false,
  timezone: '+05:30',
};

// Master DB connection pool with enhanced configuration for performance
const masterPoolRaw = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
  ...sharedPoolOptions,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false,
  } : false,
});

// Enforce IST on every connection establishment
masterPoolRaw.on('connection', (connection) => {
  connection.query('SET time_zone = "+05:30"');
});

// Staging DB connection pool (for pending/unapproved submissions)
const stagingPoolRaw = mysql.createPool({
  host: process.env.STAGING_DB_HOST || process.env.DB_HOST || 'localhost',
  user: process.env.STAGING_DB_USER || process.env.DB_USER || 'root',
  password: process.env.STAGING_DB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.STAGING_DB_NAME || 'student_staging',
  port: process.env.STAGING_DB_PORT || process.env.DB_PORT || 3306,
  connectionLimit: 10,
  ...sharedPoolOptions,
});

// Enforce IST on every connection establishment
stagingPoolRaw.on('connection', (connection) => {
  connection.query('SET time_zone = "+05:30"');
});

const isAcademicConfigured = Boolean(process.env.ACADEMIC_DB_HOST && process.env.ACADEMIC_DB_NAME);

let academicPoolRaw = null;
let academicPool = null;

if (isAcademicConfigured) {
  // Academic Portal DB connection pool - STRICTLY from ACADEMIC_DB_* in .env (NO fallback)
  academicPoolRaw = mysql.createPool({
    host: process.env.ACADEMIC_DB_HOST,
    user: process.env.ACADEMIC_DB_USER,
    password: process.env.ACADEMIC_DB_PASSWORD || '',
    database: process.env.ACADEMIC_DB_NAME,
    port: parseInt(process.env.ACADEMIC_DB_PORT, 10) || 3306,
    connectionLimit: 15,
    ...sharedPoolOptions,
    ssl: process.env.ACADEMIC_DB_SSL === 'true' ? {
      rejectUnauthorized: false,
    } : false,
  });

  academicPoolRaw.on('connection', (connection) => {
    connection.query('SET time_zone = "+05:30"');
  });

  academicPool = wrapPoolWithRetry(academicPoolRaw.promise());
} else {
  // Safe stub when not configured in .env - strictly no fallback to DB_HOST
  academicPool = {
    query: async () => {
      throw new Error('Academic Portal DB is not configured in .env (ACADEMIC_DB_* missing)');
    },
    execute: async () => {
      throw new Error('Academic Portal DB is not configured in .env (ACADEMIC_DB_* missing)');
    },
    getConnection: async () => {
      throw new Error('Academic Portal DB is not configured in .env (ACADEMIC_DB_* missing)');
    }
  };
}

const isExamConfigured = Boolean(process.env.EXAM_DB_HOST && process.env.EXAM_DB_NAME);

let examPoolRaw = null;
let examPool = null;

if (isExamConfigured) {
  // EMS (Examination Portal) DB connection pool - STRICTLY READ-ONLY from EXAM_DB_* in .env
  examPoolRaw = mysql.createPool({
    host: process.env.EXAM_DB_HOST,
    user: process.env.EXAM_DB_USER,
    password: process.env.EXAM_DB_PASSWORD || '',
    database: process.env.EXAM_DB_NAME,
    port: parseInt(process.env.EXAM_DB_PORT, 10) || 3306,
    connectionLimit: 15,
    ...sharedPoolOptions,
    ssl: process.env.EXAM_DB_SSL === 'true' ? {
      rejectUnauthorized: false,
    } : false,
  });

  examPoolRaw.on('connection', (connection) => {
    connection.query('SET time_zone = "+05:30"');
  });

  examPool = wrapPoolWithRetry(examPoolRaw.promise());
} else {
  // Safe stub when not configured in .env
  examPool = {
    query: async () => {
      throw new Error('EMS DB is not configured in .env (EXAM_DB_* missing)');
    },
    execute: async () => {
      throw new Error('EMS DB is not configured in .env (EXAM_DB_* missing)');
    },
    getConnection: async () => {
      throw new Error('EMS DB is not configured in .env (EXAM_DB_* missing)');
    }
  };
}

// Admissions DB connection pool (sync SDMS changes to Admissions database)
const admissionsPoolRaw = mysql.createPool({
  host: process.env.ADMISSIONS_DB_HOST || process.env.DB_HOST || 'localhost',
  user: process.env.ADMISSIONS_DB_USER || process.env.DB_USER || 'root',
  password: process.env.ADMISSIONS_DB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.ADMISSIONS_DB_NAME || 'admissions_db',
  port: process.env.ADMISSIONS_DB_PORT || process.env.DB_PORT || 3306,
  connectionLimit: 15,
  ...sharedPoolOptions,
  ssl: (process.env.ADMISSIONS_DB_SSL === 'true' || process.env.DB_SSL === 'true') ? {
    rejectUnauthorized: false,
  } : false,
});

admissionsPoolRaw.on('connection', (connection) => {
  connection.query('SET time_zone = "+05:30"');
});

// Maintenance DB connection pool (Campus Maintenance, Categories & Complaints)
const isMaintenanceConfigured = Boolean(
  (process.env.MAINTENANCE_DB_HOST || process.env.DB_HOST) &&
  (process.env.MAINTENANCE_DB_NAME || 'maintenance_db')
);

let maintenancePoolRaw = null;

if (isMaintenanceConfigured) {
  maintenancePoolRaw = mysql.createPool({
    host: process.env.MAINTENANCE_DB_HOST || process.env.DB_HOST || 'localhost',
    user: process.env.MAINTENANCE_DB_USER || process.env.DB_USER || 'root',
    password: process.env.MAINTENANCE_DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MAINTENANCE_DB_NAME || 'maintenance_db',
    port: parseInt(process.env.MAINTENANCE_DB_PORT || process.env.DB_PORT, 10) || 3306,
    connectionLimit: 15,
    ...sharedPoolOptions,
    ssl: ((process.env.MAINTENANCE_DB_SSL || process.env.DB_SSL) === 'true') ? {
      rejectUnauthorized: false,
    } : false,
  });

  maintenancePoolRaw.on('connection', (connection) => {
    connection.query('SET time_zone = "+05:30"');
  });
}

// Promise-based pools with connection-lost retry
const masterPool = wrapPoolWithRetry(masterPoolRaw.promise());
const stagingPool = wrapPoolWithRetry(stagingPoolRaw.promise());
const admissionsPool = wrapPoolWithRetry(admissionsPoolRaw.promise());
const maintenancePool = maintenancePoolRaw ? wrapPoolWithRetry(maintenancePoolRaw.promise()) : masterPool;

// Test connections with retry logic
const testConnection = async (retries = 3) => {
  let dbConnected = false;

  for (let i = 0; i < retries; i++) {
    try {
      const conn = await masterPool.getConnection();
      conn.release();
      dbConnected = true;
      console.log(`✅ Master DB Connected: ${process.env.DB_NAME || 'student_database'} @ ${process.env.DB_HOST || 'localhost'}`);
      break;
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  // Test and log Academic Portal connectivity
  if (!isAcademicConfigured) {
    console.log('ℹ️  Academic Portal DB: Not configured in .env (ACADEMIC_DB_* missing) - Timetables will show "Not Configured"');
  } else {
    try {
      const aConn = await academicPool.getConnection();
      aConn.release();
      console.log(`📚 Academic Portal DB Connected: ${process.env.ACADEMIC_DB_NAME} @ ${process.env.ACADEMIC_DB_HOST} [Source: ACADEMIC_DB_* in .env]`);
    } catch (err) {
      console.warn(`⚠️  Academic Portal DB Connection Failed: ${err.message} [Target: ${process.env.ACADEMIC_DB_NAME} @ ${process.env.ACADEMIC_DB_HOST}]`);
    }
  }

  // Test and log EMS connectivity
  if (!isExamConfigured) {
    console.log('ℹ️  EMS DB: Not configured in .env (EXAM_DB_* missing)');
  } else {
    try {
      const eConn = await examPool.getConnection();
      eConn.release();
      console.log(`📊 EMS DB Connected: ${process.env.EXAM_DB_NAME} @ ${process.env.EXAM_DB_HOST} [Source: EXAM_DB_* in .env]`);
    } catch (err) {
      console.warn(`⚠️  EMS DB Connection Failed: ${err.message} [Target: ${process.env.EXAM_DB_NAME} @ ${process.env.EXAM_DB_HOST}]`);
    }
  }

  // Test and log Maintenance DB connectivity
  try {
    const mConn = await maintenancePool.getConnection();
    mConn.release();
    console.log(`🔧 Maintenance DB Connected: ${process.env.MAINTENANCE_DB_NAME || 'maintenance_db'} @ ${process.env.MAINTENANCE_DB_HOST || process.env.DB_HOST || 'localhost'}`);
  } catch (err) {
    console.warn(`⚠️  Maintenance DB Connection Failed: ${err.message} [Target: ${process.env.MAINTENANCE_DB_NAME || 'maintenance_db'}]`);
  }

  return dbConnected;
};

module.exports = {
  masterPool,
  stagingPool,
  academicPool,
  examPool,
  admissionsPool,
  maintenancePool,
  // Backward compat: default pool points to master
  pool: masterPool,
  testConnection
};

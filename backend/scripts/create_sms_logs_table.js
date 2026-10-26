const { masterPool } = require('../config/database');

async function createSmsLogsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      mobile_number VARCHAR(20),
      message TEXT,
      category VARCHAR(50) DEFAULT 'General',
      current_year INT,
      current_semester INT,
      status VARCHAR(20) DEFAULT 'Sent',
      message_id VARCHAR(100),
      notification_data JSON NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      error_details TEXT,
      INDEX idx_student_id (student_id),
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    const connection = await masterPool.getConnection();
    await connection.query(createTableQuery);
    console.log('✅ sms_logs table created or already exists.');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create sms_logs table:', error);
    process.exit(1);
  }
}

createSmsLogsTable();

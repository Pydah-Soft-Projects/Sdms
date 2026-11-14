const path = require('path');
const mysql = require(path.join(__dirname, 'node_modules', 'mysql2', 'promise'));
require(path.join(__dirname, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env') });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.DB_NAME
  });
  const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ?", ["student_portal_layout"]);
  console.log("Stored student_portal_layout:", rows[0]?.value);
  await pool.end();
})();


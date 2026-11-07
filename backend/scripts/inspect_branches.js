const mysql = require("mysql2/promise");
require("dotenv").config({ path: __dirname + "/../.env" });

async function run() {
  const master = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  const academic = await mysql.createConnection({
    host: process.env.ACADEMIC_DB_HOST,
    port: process.env.ACADEMIC_DB_PORT,
    user: process.env.ACADEMIC_DB_USER,
    password: process.env.ACADEMIC_DB_PASSWORD,
    database: process.env.ACADEMIC_DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  console.log("Connected to both databases!");

  // 1. Check recent publications
  const [pubs] = await academic.query("SELECT id, title, college_name, course_name, branch_name, branch_id, target_branches, is_active, mapped_staff_subjects FROM ap_feedback_publications ORDER BY id DESC LIMIT 3");
  console.log("\n=== RECENT PUBLICATIONS ===");
  pubs.forEach(p => {
    let mapped = [];
    try { mapped = JSON.parse(p.mapped_staff_subjects || "[]"); } catch(e) {}
    console.log(`Pub ID ${p.id}: "${p.title}"`);
    console.log(`  branch_id: ${p.branch_id}, branch_name: ${p.branch_name}`);
    console.log(`  target_branches: ${p.target_branches}`);
    console.log(`  mapped_staff_subjects count: ${mapped.length}`);

    const distinctBranches = [...new Set(mapped.map(m => `${m.branchId}:${m.branchName}`))];
    console.log("  distinct branches in mapped subjects:", distinctBranches);
  });

  // 2. Check course_branches in master DB
  const [masterBranches] = await master.query("SELECT id, name, code, course_id FROM course_branches LIMIT 25");
  console.log("\n=== MASTER DB course_branches ===");
  console.table(masterBranches);

  // 3. Check students table sample branches
  const [studentBranchSample] = await master.query("SELECT DISTINCT branch, branch_id, course, course_id FROM students WHERE branch IS NOT NULL LIMIT 20");
  console.log("\n=== STUDENTS TABLE sample branches ===");
  console.table(studentBranchSample);

  await master.end();
  await academic.end();
}

run().catch(console.error);


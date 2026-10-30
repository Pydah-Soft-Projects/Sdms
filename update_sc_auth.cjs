const fs = require('fs');

const scPath = 'd:/pydahsoft projects/Student-Data-Management-Application/backend/controllers/serviceController.js';
let sc = fs.readFileSync(scPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Add isAuthorizedStaffOrAdmin near top of file
const topInsertion = `// Helper to check admin/staff privilege (supports admin, super_admin, subadmin, etc.)
const isAuthorizedStaffOrAdmin = (user) => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  return (
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superadmin' ||
    role === 'subadmin' ||
    role === 'sub_admin' ||
    Boolean(user.isAdmin || user.is_admin) ||
    (role !== 'student' && role !== 'parent')
  );
};

// --- Services Configuration (Admin) ---`;

sc = sc.replace('// --- Services Configuration (Admin) ---', topInsertion);

// 2. In getServices
const oldGetServices = `exports.getServices = async (req, res) => {
  try {
    const isAdmin =
      req.user &&
      (req.user.role === "admin" ||
        req.user.role === "super_admin" ||
        req.user.isAdmin);`;

const newGetServices = `exports.getServices = async (req, res) => {
  try {
    const isAdmin = isAuthorizedStaffOrAdmin(req.user);`;

sc = sc.replace(oldGetServices, newGetServices);

// 3. In createService
const oldCreateAdmin = `    const isAdmin =
      req.user.role === "admin" ||
      req.user.role === "super_admin" ||
      req.user.isAdmin;`;

// Replace all occurrences of that 4-line pattern with isAuthorizedStaffOrAdmin
sc = sc.replace(
  /const isAdmin =\s*req\.user\.role === "admin" \|\|\s*req\.user\.role === "super_admin" \|\|\s*req\.user\.isAdmin;/g,
  'const isAdmin = isAuthorizedStaffOrAdmin(req.user);'
);

sc = sc.replace(
  /const isAdmin =\s*\(req\.user\.role === "admin" \|\|\s*req\.user\.role === "super_admin" \|\|\s*req\.user\.isAdmin\);/g,
  'const isAdmin = isAuthorizedStaffOrAdmin(req.user);'
);

// 4. In previewTemplate college query, optimize with LIMIT 1 and check targetCollegeId
const oldCollegeQuery = `    try {
      let target;
      if (config.college_id) {
        const [specCollege] = await masterPool.execute(
          "SELECT * FROM colleges WHERE id = ?",
          [config.college_id],
        );
        if (specCollege.length > 0) target = specCollege[0];
      }

      if (!target) {
        const [colleges] = await masterPool.execute(
          "SELECT * FROM colleges WHERE is_active = 1",
        );
        if (colleges.length > 0) {
          target =
            colleges.find((c) =>
              c.name.includes("Pydah College of Engineering"),
            ) || colleges[0];
        }
      }`;

const newCollegeQuery = `    try {
      let target;
      const targetCollegeId = config.college_id || req.body.college_id;
      if (targetCollegeId) {
        const [specCollege] = await masterPool.execute(
          "SELECT * FROM colleges WHERE id = ? LIMIT 1",
          [targetCollegeId],
        );
        if (specCollege.length > 0) target = specCollege[0];
      }

      if (!target) {
        const [colleges] = await masterPool.execute(
          "SELECT * FROM colleges WHERE is_active = 1 LIMIT 1",
        );
        if (colleges.length > 0) target = colleges[0];
      }`;

if (!sc.includes(oldCollegeQuery)) {
  console.error('oldCollegeQuery not found!');
  process.exit(1);
}

sc = sc.replace(oldCollegeQuery, newCollegeQuery);

fs.writeFileSync(scPath, sc, 'utf8');
console.log('Successfully updated serviceController.js!');


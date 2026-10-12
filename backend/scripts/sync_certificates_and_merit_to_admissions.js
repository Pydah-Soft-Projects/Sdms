require('dotenv').config();
const { bulkSyncAllStudentsToAdmissions, syncStudentToAdmissions } = require('../services/admissionsSyncService');

async function main() {
  const args = process.argv.slice(2);
  const targetAdm = args[0];

  try {
    if (targetAdm && targetAdm !== '--all') {
      console.log(`[Sync] Resyncing student ${targetAdm} to admissions portal...`);
      const res = await syncStudentToAdmissions(targetAdm);
      console.log('[Sync] Result:', res);
    } else {
      console.log('[Sync] Starting bulk resync of all students to admissions portal...');
      const stats = await bulkSyncAllStudentsToAdmissions({ batchSize: 50 });
      console.log('[Sync] Completed bulk sync:', stats);
    }
  } catch (err) {
    console.error('[Sync] Fatal error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();

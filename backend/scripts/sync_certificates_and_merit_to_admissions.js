require('dotenv').config();
const { bulkSyncAllStudentsToAdmissions, syncStudentToAdmissions } = require('../services/admissionsSyncService');

async function main() {
  const args = process.argv.slice(2);
  const targetAdm = args[0];

  try {
    if (targetAdm && targetAdm !== '--all' && !targetAdm.startsWith('--year=')) {
      console.log(`[Sync SDMS -> Admissions] Resyncing student ${targetAdm} to admissions portal...`);
      const res = await syncStudentToAdmissions(targetAdm);
      console.log('[Sync SDMS -> Admissions] Result:', res);
    } else {
      let batch = null;
      if (targetAdm && targetAdm.startsWith('--year=')) {
        batch = targetAdm.split('=')[1];
      }
      console.log(`[Sync SDMS -> Admissions] Starting bulk resync to admissions portal (batch: ${batch || 'ALL'})...`);
      const stats = await bulkSyncAllStudentsToAdmissions({ batchSize: 50, batch });
      console.log('[Sync SDMS -> Admissions] Completed bulk sync:', stats);
    }
  } catch (err) {
    console.error('[Sync SDMS -> Admissions] Fatal error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();

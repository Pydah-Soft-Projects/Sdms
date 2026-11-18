require('dotenv').config();
const { syncAdmissionsToStudent, bulkSyncAdmissionsToSDMS } = require('../services/admissionsSyncService');

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  try {
    if (target && target !== '--all' && !target.startsWith('--year=')) {
      console.log(`[Sync Admissions -> SDMS] Syncing student ${target}...`);
      const res = await syncAdmissionsToStudent(target);
      console.log('[Sync Admissions -> SDMS] Result:', res);
    } else {
      let batch = '2026';
      if (target && target.startsWith('--year=')) {
        batch = target.split('=')[1];
      } else if (target === '--all') {
        batch = null;
      }
      console.log(`[Sync Admissions -> SDMS] Starting bulk sync for batch: ${batch || 'ALL'}...`);
      const stats = await bulkSyncAdmissionsToSDMS({ batchSize: 50, batch });
      console.log('[Sync Admissions -> SDMS] Completed bulk sync:', stats);
    }
  } catch (err) {
    console.error('[Sync Admissions -> SDMS] Fatal error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();

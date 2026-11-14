const mongoose = require('mongoose');
const { masterPool } = require('../config/database');
const { getHRMSConnection } = require('../config/mongoConfig');
const { getModel: getHRMSEmployeeModel } = require('../models/HRMSEmployee');
const { getModel: getHRMSUserModel } = require('../models/HRMSUser');

/**
 * Checks whether an HRMS record (Employee or User document) indicates a deactivated state.
 * Evaluates boolean flags (is_active, isActive) and common status strings.
 */
function isHrmsDeactivated(doc) {
  if (!doc) return false;

  // Direct boolean checks
  if (doc.is_active === false || doc.is_active === 0) return true;
  if (doc.isActive === false || doc.isActive === 0) return true;

  // Status string check (case-insensitive)
  if (typeof doc.status === 'string') {
    const s = doc.status.toLowerCase().trim();
    if (['inactive', 'deactivated', 'terminated', 'disabled', 'resigned', 'blocked', 'suspended', 'relieved'].includes(s)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an HRMS record is explicitly active.
 */
function isHrmsActive(doc) {
  if (!doc) return false;
  if (isHrmsDeactivated(doc)) return false;
  return doc.is_active === true || doc.isActive === true || doc.status === 'active' || doc.status === 'Active';
}

/**
 * Check a single SDMS user against HRMS.
 * Uses fail-fast timeout (maxTimeMS: 2000) so it does not block callers.
 *
 * @param {Object} user - User record with { hrms_id, username, email }
 * @returns {Promise<{ checked: boolean, isDeactivated: boolean, reason?: string, record?: Object }>}
 */
async function checkEmployeeHrmsStatus(user) {
  if (!user) {
    return { checked: false, isDeactivated: false, reason: 'No user provided' };
  }

  const hrmsConn = getHRMSConnection();
  if (!hrmsConn || hrmsConn.readyState !== 1 || !process.env.HRMS_MONGO_URL) {
    return { checked: false, isDeactivated: false, reason: 'HRMS connection not available' };
  }

  try {
    const HRMSEmployee = getHRMSEmployeeModel(hrmsConn);
    const HRMSUser = getHRMSUserModel(hrmsConn);

    const hrmsId = user.hrms_id ? String(user.hrms_id).trim() : null;
    const cleanUsername = user.username ? String(user.username).trim() : null;
    const cleanEmail = user.email ? String(user.email).trim().toLowerCase() : null;

    // Build search queries for Employee
    const employeeQueries = [];
    if (hrmsId && mongoose.Types.ObjectId.isValid(hrmsId)) {
      employeeQueries.push({ _id: hrmsId });
    }
    if (cleanUsername) {
      employeeQueries.push({ emp_no: cleanUsername });
    }
    if (cleanEmail && !cleanEmail.includes('@hrms')) {
      employeeQueries.push({ email: cleanEmail });
    }

    if (employeeQueries.length > 0) {
      const empDoc = await HRMSEmployee.findOne({ $or: employeeQueries })
        .maxTimeMS(2000)
        .lean()
        .exec();

      if (empDoc) {
        if (isHrmsDeactivated(empDoc)) {
          return {
            checked: true,
            isDeactivated: true,
            reason: `HRMS Employee (${empDoc.emp_no || empDoc.employee_name}) is deactivated`,
            record: empDoc
          };
        }
      }
    }

    // Build search queries for HRMS User
    const userQueries = [];
    if (hrmsId && mongoose.Types.ObjectId.isValid(hrmsId)) {
      userQueries.push({ _id: hrmsId });
    }
    if (cleanUsername) {
      userQueries.push({ employeeId: cleanUsername });
    }
    if (cleanEmail && !cleanEmail.includes('@hrms')) {
      userQueries.push({ email: cleanEmail });
    }

    if (userQueries.length > 0) {
      const userDoc = await HRMSUser.findOne({ $or: userQueries })
        .maxTimeMS(2000)
        .lean()
        .exec();

      if (userDoc) {
        if (isHrmsDeactivated(userDoc)) {
          return {
            checked: true,
            isDeactivated: true,
            reason: `HRMS User (${userDoc.employeeId || userDoc.name || userDoc.email}) is deactivated`,
            record: userDoc
          };
        }
      }
    }

    return { checked: true, isDeactivated: false };
  } catch (error) {
    console.warn(`[HRMS Check] Warning checking status for user ${user.username || user.email}:`, error.message);
    return { checked: false, isDeactivated: false, reason: error.message };
  }
}

/**
 * Bulk synchronize employee status from HRMS to SDMS.
 * Finds any SDMS users currently marked active (is_active = 1) whose corresponding
 * HRMS record is in a deactivated state, and automatically sets is_active = 0 in SDMS.
 *
 * @returns {Promise<{ success: boolean, deactivatedCount: number, deactivatedUsers: Array, message: string }>}
 */
async function syncHrmsEmployeeStatus() {
  const hrmsConn = getHRMSConnection();
  if (!hrmsConn || hrmsConn.readyState !== 1 || !process.env.HRMS_MONGO_URL) {
    console.log('[HRMS Sync] HRMS connection not available, skipping auto-deactivation sync.');
    return {
      success: false,
      deactivatedCount: 0,
      deactivatedUsers: [],
      message: 'HRMS connection not available'
    };
  }

  try {
    const HRMSEmployee = getHRMSEmployeeModel(hrmsConn);
    const HRMSUser = getHRMSUserModel(hrmsConn);

    // 1. Fetch all active users from SDMS rbac_users
    const [activeRbacUsers] = await masterPool.query(
      `SELECT id, name, username, email, hrms_id, role, is_active 
       FROM rbac_users 
       WHERE is_active = 1`
    );

    if (!activeRbacUsers || activeRbacUsers.length === 0) {
      return {
        success: true,
        deactivatedCount: 0,
        deactivatedUsers: [],
        message: 'No active users found in SDMS to sync'
      };
    }

    // 2. Query HRMS for deactivated employees
    const deactivatedFilter = {
      $or: [
        { is_active: false },
        { is_active: 0 },
        { isActive: false },
        { isActive: 0 },
        { status: { $in: ['inactive', 'deactivated', 'terminated', 'disabled', 'resigned', 'blocked', 'suspended', 'relieved', 'Inactive', 'Deactivated', 'Terminated', 'Disabled'] } }
      ]
    };

    const [deactivatedEmployees, deactivatedUsers] = await Promise.all([
      HRMSEmployee.find(deactivatedFilter, '_id emp_no email is_active status employee_name')
        .maxTimeMS(5000)
        .lean()
        .exec(),
      HRMSUser.find(deactivatedFilter, '_id employeeId email isActive is_active status name')
        .maxTimeMS(5000)
        .lean()
        .exec()
    ]);

    // 3. Build lookup sets of deactivated identifiers
    const deactivatedIds = new Set();
    const deactivatedEmpNos = new Set();
    const deactivatedEmails = new Set();

    (deactivatedEmployees || []).forEach(emp => {
      if (emp._id) deactivatedIds.add(String(emp._id));
      if (emp.emp_no) deactivatedEmpNos.add(String(emp.emp_no).trim().toLowerCase());
      if (emp.email) deactivatedEmails.add(String(emp.email).trim().toLowerCase());
    });

    (deactivatedUsers || []).forEach(u => {
      if (u._id) deactivatedIds.add(String(u._id));
      if (u.employeeId) deactivatedEmpNos.add(String(u.employeeId).trim().toLowerCase());
      if (u.email) deactivatedEmails.add(String(u.email).trim().toLowerCase());
    });

    // 4. Match active SDMS users against deactivated HRMS sets
    const rbacUsersToDeactivate = [];
    for (const user of activeRbacUsers) {
      const userHrmsId = user.hrms_id ? String(user.hrms_id).trim() : null;
      const userUsername = user.username ? String(user.username).trim().toLowerCase() : null;
      const userEmail = user.email ? String(user.email).trim().toLowerCase() : null;

      const isMatch = (userHrmsId && deactivatedIds.has(userHrmsId)) ||
                      (userUsername && deactivatedEmpNos.has(userUsername)) ||
                      (userEmail && deactivatedEmails.has(userEmail));

      if (isMatch) {
        rbacUsersToDeactivate.push(user);
      }
    }

    // 5. Deactivate matching rbac_users in MySQL
    if (rbacUsersToDeactivate.length > 0) {
      const ids = rbacUsersToDeactivate.map(u => u.id);
      const placeholders = ids.map(() => '?').join(',');
      await masterPool.query(
        `UPDATE rbac_users SET is_active = 0, updated_at = NOW() WHERE id IN (${placeholders})`,
        ids
      );

      console.log(`[HRMS Sync] Automatically deactivated ${rbacUsersToDeactivate.length} user(s) in SDMS:`,
        rbacUsersToDeactivate.map(u => `${u.name} (username: ${u.username}, id: ${u.id})`).join('; ')
      );
    }

    // 6. Also check legacy staff_users table
    let staffDeactivatedCount = 0;
    try {
      const [activeStaff] = await masterPool.query(
        'SELECT id, username, email FROM staff_users WHERE is_active = 1'
      );
      if (activeStaff && activeStaff.length > 0) {
        const staffToDeactivate = activeStaff.filter(s => {
          const uName = s.username ? String(s.username).trim().toLowerCase() : null;
          const uEmail = s.email ? String(s.email).trim().toLowerCase() : null;
          return (uName && deactivatedEmpNos.has(uName)) || (uEmail && deactivatedEmails.has(uEmail));
        });

        if (staffToDeactivate.length > 0) {
          const staffIds = staffToDeactivate.map(s => s.id);
          const placeholders = staffIds.map(() => '?').join(',');
          await masterPool.query(
            `UPDATE staff_users SET is_active = 0, updated_at = NOW() WHERE id IN (${placeholders})`,
            staffIds
          );
          staffDeactivatedCount = staffToDeactivate.length;
          console.log(`[HRMS Sync] Automatically deactivated ${staffDeactivatedCount} legacy staff user(s) in SDMS.`);
        }
      }
    } catch (staffErr) {
      // Non-fatal if staff_users table differs
      console.warn('[HRMS Sync] Warning syncing staff_users:', staffErr.message);
    }

    const totalDeactivated = rbacUsersToDeactivate.length + staffDeactivatedCount;

    return {
      success: true,
      deactivatedCount: totalDeactivated,
      deactivatedUsers: rbacUsersToDeactivate.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role
      })),
      message: totalDeactivated > 0
        ? `Successfully deactivated ${totalDeactivated} employee(s) in SDMS matching HRMS deactivate state`
        : 'All active SDMS users are in sync with HRMS'
    };
  } catch (error) {
    console.error('[HRMS Sync] Error during HRMS sync:', error);
    return {
      success: false,
      deactivatedCount: 0,
      deactivatedUsers: [],
      message: 'Error during HRMS sync: ' + error.message
    };
  }
}

module.exports = {
  isHrmsDeactivated,
  isHrmsActive,
  checkEmployeeHrmsStatus,
  syncHrmsEmployeeStatus
};

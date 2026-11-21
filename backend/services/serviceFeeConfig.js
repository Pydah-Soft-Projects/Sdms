const { masterPool } = require('../config/database');
const FeeHead = require('../MongoDb-Models/FeeHead');
const StudentFee = require('../MongoDb-Models/StudentFee');
const Transaction = require('../MongoDb-Models/Transaction');

const SETTINGS_KEY = 'service_requests_settings';

/**
 * Get Service Request Settings from MySQL settings table
 */
async function getServiceSettingsFromDb() {
  try {
    const [rows] = await masterPool.query(
      'SELECT value FROM settings WHERE `key` = ? LIMIT 1',
      [SETTINGS_KEY]
    );
    if (rows && rows.length > 0 && rows[0].value) {
      return typeof rows[0].value === 'string'
        ? JSON.parse(rows[0].value)
        : rows[0].value;
    }
  } catch (err) {
    console.warn('[SERVICE SETTINGS] Error reading settings:', err.message);
  }
  return null;
}

/**
 * Save Service Request Settings to MySQL settings table
 */
async function saveServiceSettingsToDb(settingsObj) {
  const jsonValue = JSON.stringify(settingsObj);
  const description = 'Configuration for Service Requests Fee Head and sync options';
  await masterPool.query(
    `INSERT INTO settings (\`key\`, value, description, updated_at) 
     VALUES (?, ?, ?, NOW()) 
     ON DUPLICATE KEY UPDATE value = ?, description = ?, updated_at = NOW()`,
    [SETTINGS_KEY, jsonValue, description, jsonValue, description]
  );
  return settingsObj;
}

/**
 * Get all available Fee Heads dynamically from Fee Portal (MongoDB)
 */
async function getAllAvailableFeeHeads() {
  try {
    return await FeeHead.find().sort({ name: 1 }).lean();
  } catch (err) {
    console.error('[SERVICE SETTINGS] Failed to fetch fee heads:', err);
    return [];
  }
}

/**
 * Dynamically resolves the Fee Head for Service Requests without hardcoding:
 * 1. Checks saved settings in MySQL (`service_requests_settings`)
 * 2. If no head is configured or invalid, searches MongoDB FeeHead for any head matching service/certificate/request keywords
 * 3. Fallback: Any active FeeHead in Fee Portal
 * 4. Safe fallback creation only if MongoDB collection has 0 fee heads
 */
async function getDynamicServiceFeeHead() {
  try {
    const settings = await getServiceSettingsFromDb();

    // 1. If configured in settings
    if (settings) {
      if (settings.feeHeadId) {
        const head = await FeeHead.findById(settings.feeHeadId);
        if (head) return head;
      }
      if (settings.feeHeadCode) {
        const head = await FeeHead.findOne({ code: settings.feeHeadCode });
        if (head) return head;
      }
      if (settings.feeHeadName) {
        const head = await FeeHead.findOne({ name: settings.feeHeadName });
        if (head) return head;
      }
    }

    // 2. Dynamic pattern matching from Fee Portal (case-insensitive)
    const dynamicMatch = await FeeHead.findOne({
      $or: [
        { name: { $regex: /service/i } },
        { code: { $regex: /service|^ss/i } },
        { description: { $regex: /service/i } },
        { name: { $regex: /certificate/i } }
      ]
    });
    if (dynamicMatch) return dynamicMatch;

    // 3. Fallback: Any active fee head from Fee Portal
    const firstActive = await FeeHead.findOne({ isActive: { $ne: false } }).sort({ createdAt: 1 });
    if (firstActive) return firstActive;

    // 4. Any fee head at all in Fee Portal
    const anyHead = await FeeHead.findOne();
    if (anyHead) return anyHead;

    // 5. If MongoDB collection is completely empty, create one dynamically
    return await FeeHead.create({
      name: 'Service Requests Fee',
      code: 'SRF',
      description: 'Fees for Student Service Requests',
      isActive: true
    });
  } catch (err) {
    console.error('[SERVICE SETTINGS] Error resolving dynamic fee head:', err);
    return null;
  }
}

/**
 * Helper to check if a fee record or transaction is associated with service requests
 */
async function isServiceFeeRecord(feeHeadIdOrObj, remarks = '') {
  if (remarks && (
    /service\s*request/i.test(remarks) || 
    /\(Ref:\s*\d+\)/i.test(remarks) || 
    /SR-\d+/i.test(remarks)
  )) {
    return true;
  }

  const currentHead = await getDynamicServiceFeeHead();
  if (!currentHead) return false;

  const currentHeadIdStr = String(currentHead._id);

  if (typeof feeHeadIdOrObj === 'string' || (feeHeadIdOrObj && feeHeadIdOrObj._bsontype === 'ObjectID')) {
    return String(feeHeadIdOrObj) === currentHeadIdStr;
  }

  if (feeHeadIdOrObj && typeof feeHeadIdOrObj === 'object') {
    const id = feeHeadIdOrObj._id || feeHeadIdOrObj.id;
    if (id && String(id) === currentHeadIdStr) return true;
    if (feeHeadIdOrObj.code && currentHead.code && String(feeHeadIdOrObj.code).toUpperCase() === String(currentHead.code).toUpperCase()) return true;
    if (feeHeadIdOrObj.name && currentHead.name && String(feeHeadIdOrObj.name).toLowerCase() === String(currentHead.name).toLowerCase()) return true;
  }

  return false;
}

/**
 * Creates an unpaid fee demand (StudentFee) in MongoDB fee-management database.
 * Does NOT create a Transaction, so it stays UNPAID on the Fee Portal side.
 */
async function createServiceFeeDemand({ requestId, studentId, serviceId, sequence_no }) {
  try {
    // 1. Get service details
    const [services] = await masterPool.execute(
      'SELECT id, name, price FROM services WHERE id = ?',
      [serviceId]
    );
    if (!services || services.length === 0) return null;
    const service = services[0];
    const amount = Number(service.price) || 0;
    if (amount <= 0) {
      // Free service: no fee demand needed
      return null;
    }

    // 2. Get student details from MySQL
    const [students] = await masterPool.execute(
      'SELECT id, admission_number, pin_no, student_name, course, branch, college, current_year, current_semester FROM students WHERE id = ?',
      [studentId]
    );
    if (!students || students.length === 0) return null;
    const student = students[0];

    const studentAdmission = student.admission_number || student.pin_no;
    if (!studentAdmission) return null;

    // 3. Resolve dynamic FeeHead
    const feeHead = await getDynamicServiceFeeHead();
    if (!feeHead) {
      console.warn('[SERVICE FEE] No active fee head found for service requests');
      return null;
    }

    // 4. Compute academic year
    const now = new Date();
    const currYear = now.getFullYear();
    const academicYear = `${currYear}-${currYear + 1}`;

    const remarks = `Service Request: ${service.name} (Ref: ${requestId})`;

    // Check if demand already exists
    const existingDemand = await StudentFee.findOne({
      studentId: studentAdmission,
      feeHead: feeHead._id,
      remarks: remarks
    });

    if (existingDemand) {
      if (existingDemand.amount !== amount || existingDemand.status !== 'active') {
        existingDemand.amount = amount;
        existingDemand.status = 'active';
        await existingDemand.save();
      }
      return existingDemand;
    }

    // Create new demand in MongoDB (Unpaid due)
    const newFeeDemand = await StudentFee.create({
      studentId: studentAdmission,
      studentName: student.student_name || 'STUDENT',
      feeHead: feeHead._id,
      college: student.college || 'DEFAULT',
      course: student.course || 'GENERAL',
      branch: student.branch || 'GENERAL',
      academicYear,
      studentYear: Number(student.current_year) || 1,
      semester: Number(student.current_semester) || 1,
      amount,
      status: 'active',
      remarks
    });

    console.log(`[SERVICE FEE] Created unpaid fee demand in MongoDB for student ${studentAdmission}: ₹${amount} (Ref: ${requestId})`);
    return newFeeDemand;
  } catch (err) {
    console.error('[SERVICE FEE] Error creating service fee demand:', err);
    return null;
  }
}

/**
 * Checks if a service request fee has been paid in the Fee Portal MongoDB
 */
async function checkFeePaymentStatus({ requestId, studentAdmission, pinNo, servicePrice, sequenceNo, createdAt }) {
  try {
    const price = Number(servicePrice) || 0;
    if (price <= 0) {
      return { isPaid: true, reason: 'Free service' };
    }

    const identifiers = [studentAdmission, pinNo].filter(Boolean).map(id => String(id).trim());
    if (identifiers.length === 0) {
      return { isPaid: false, reason: 'No student identifier' };
    }

    const idRegexes = identifiers.map(id => new RegExp(`^${id}$`, 'i'));

    // 1. Check for specific transaction by remarks or reference
    const refRegex = new RegExp(`Ref:\\s*${requestId}\\b|\\bSR-${requestId}\\b` + (sequenceNo ? `|${sequenceNo}` : ''), 'i');

    const specificTx = await Transaction.findOne({
      studentId: { $in: idRegexes },
      transactionType: 'DEBIT',
      status: { $nin: ['cancelled', 'transferred'] },
      $or: [
        { remarks: { $regex: refRegex } },
        { referenceNo: { $regex: refRegex } }
      ]
    });

    if (specificTx) {
      return {
        isPaid: true,
        transaction: specificTx,
        reason: `Matched transaction ${specificTx.receiptNumber || specificTx._id} (₹${specificTx.amount})`
      };
    }

    // 2. Fallback: Check for payment made under the service Fee Head AFTER this request was created
    // CRITICAL: Must strictly be created AFTER request was created, AND must NOT belong to a different request
    const feeHead = await getDynamicServiceFeeHead();
    if (feeHead && createdAt) {
      const requestCreatedDate = new Date(createdAt);

      const headTxQuery = {
        studentId: { $in: idRegexes },
        feeHead: feeHead._id,
        transactionType: 'DEBIT',
        status: { $nin: ['cancelled', 'transferred'] },
        paymentDate: { $gte: requestCreatedDate }
      };

      const headTxs = await Transaction.find(headTxQuery).sort({ paymentDate: -1 });

      // Filter out any transactions that explicitly belong to a DIFFERENT service request
      const otherRefRegex = /Ref:\s*(\d+)/i;
      const otherSrRegex = /\bSR-(\d+)/i;
      const validTxs = headTxs.filter(tx => {
        const refMatch = (tx.remarks || '').match(otherRefRegex) || (tx.referenceNo || '').match(otherSrRegex);
        if (refMatch && String(refMatch[1]) !== String(requestId)) {
          return false; // Belongs to a different request
        }
        return true;
      });

      const totalPaid = validTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      if (totalPaid >= price && validTxs.length > 0) {
        return {
          isPaid: true,
          transaction: validTxs[0],
          reason: `Matched fee head transaction(s) totaling ₹${totalPaid}`
        };
      }
    }

    return { isPaid: false, reason: 'Payment not found in Fee Portal' };
  } catch (err) {
    console.error('[SERVICE FEE] Error checking payment status:', err);
    return { isPaid: false, error: err.message };
  }
}

module.exports = {
  SETTINGS_KEY,
  getServiceSettingsFromDb,
  saveServiceSettingsToDb,
  getAllAvailableFeeHeads,
  getDynamicServiceFeeHead,
  isServiceFeeRecord,
  createServiceFeeDemand,
  checkFeePaymentStatus
};

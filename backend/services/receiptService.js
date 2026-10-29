/**
 * Receipt Number Service
 * Inter-service client for Next Receipt Number Generation API (Fees System)
 * Documentation: docs/RECEIPT_API_DOCUMENTATION.md
 */

const getFeesBaseUrl = () => {
  return (process.env.FEES_BACKEND_URL || 'http://localhost:5001').replace(/\/+$/, '');
};

/**
 * Fallback receipt number generator in case Fees microservice is unreachable
 * Format: REC<timestamp_part><random> (adheres to standard fallback in docs)
 */
function generateFallbackReceiptNumber() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `REC${ts}${rand}`;
}

/**
 * Allocate next receipt number from Fees system (atomically increments counter)
 * 
 * @param {Object} options
 * @param {string} [options.studentId] - Student admission number (e.g. '23PEC001')
 * @param {string} [options.feeHeadId] - Fee head MongoDB ID
 * @param {string} [options.collegeCode] - Direct college code override (e.g. 'PEC')
 * @param {string} [options.courseCode] - Direct course code override (e.g. 'BTECH')
 * @param {string} [options.groupCode] - Direct fee group override (e.g. 'TUITION')
 * @param {string|Date} [options.date] - Date for financial year calculation
 * @param {string[]} [options.feeHeadIds] - Array of fee head IDs
 * @param {boolean} [options.allocate=true] - true to allocate/increment, false to preview
 * @returns {Promise<string>} Allocated receipt number
 */
async function allocateReceiptNumber(options = {}) {
  const {
    studentId,
    feeHeadId,
    collegeCode,
    courseCode,
    groupCode,
    date,
    feeHeadIds,
    allocate = true,
  } = options;

  const feesBaseUrl = getFeesBaseUrl();
  const url = `${feesBaseUrl}/api/public/transactions/next-receipt`;

  try {
    const payload = {
      studentId: studentId || undefined,
      feeHeadId: feeHeadId ? String(feeHeadId) : undefined,
      collegeCode: collegeCode || undefined,
      courseCode: courseCode || undefined,
      groupCode: groupCode || undefined,
      date: date || undefined,
      feeHeadIds: Array.isArray(feeHeadIds) && feeHeadIds.length > 0 ? feeHeadIds : undefined,
      allocate: allocate !== false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success || !data?.receiptNumber) {
      console.warn('[RECEIPT SERVICE] Fees API returned unsuccessful response:', data?.message || response.status);
      return generateFallbackReceiptNumber();
    }

    console.log(`[RECEIPT SERVICE] Successfully allocated receipt: ${data.receiptNumber} (student: ${studentId || 'N/A'})`);
    return data.receiptNumber;
  } catch (error) {
    console.warn(`[RECEIPT SERVICE] Unable to connect to Fees backend at ${url} (${error.message}). Using fallback receipt.`);
    return generateFallbackReceiptNumber();
  }
}

/**
 * Preview next receipt number without incrementing counter
 */
async function previewReceiptNumber(options = {}) {
  return allocateReceiptNumber({ ...options, allocate: false });
}

module.exports = {
  allocateReceiptNumber,
  previewReceiptNumber,
  generateFallbackReceiptNumber,
};


const crypto = require('crypto');
const Razorpay = require('razorpay');
const PaymentConfig = require('../MongoDb-Models/PaymentConfig');
const Transaction = require('../MongoDb-Models/Transaction');
const FeeHead = require('../MongoDb-Models/FeeHead');
const StudentFee = require('../MongoDb-Models/StudentFee');
const { masterPool } = require('../config/database');
const mongoose = require('mongoose');
const { allocateReceiptNumber } = require('../services/receiptService');

// PPG Gateway Settings
const getPpgConfig = () => ({
  baseUrl: (process.env.PPG_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, ''),
  appKey: process.env.PPG_APP_KEY || '',
  appSecret: process.env.PPG_APP_SECRET || '',
});

/**
 * Helper to communicate with Pydah Payment Gateway (PPG)
 */
async function callPpg(path, options = {}) {
  const { baseUrl, appKey, appSecret } = getPpgConfig();
  const url = `${baseUrl}/${path.replace(/^\/+/, '')}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-App-Key': appKey,
    'X-App-Secret': appSecret,
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

/**
 * Helper: Post-payment synchronizations (Club fees & Service requests)
 */
async function postPaymentSync({ finalFeeHeadId, remarks, studentId, studentRecord, serviceRequestId }) {
  // 1. Update Club Membership Status if this is a Club Fee payment
  const clubFeeHead = finalFeeHeadId ? await FeeHead.findById(finalFeeHeadId).select('name') : null;
  const clubFeeRemark = String(remarks || '').match(/^\s*Club Fee\s*[:\-–]\s*(.+)$/i);

  if (remarks && (clubFeeHead?.name === 'Club Fee' || clubFeeRemark) && studentRecord) {
    try {
      const clubName = (clubFeeRemark ? clubFeeRemark[1] : remarks).trim();
      if (clubName) {
        const [clubs] = await masterPool.query('SELECT id, membership_fee FROM clubs WHERE name = ?', [clubName]);
        if (clubs.length > 0) {
          const clubId = clubs[0].id;
          const requiredFee = Number(clubs[0].membership_fee) || 0;

          const clubFeeRemarks = [clubName, `Club Fee: ${clubName}`, `Club Fee - ${clubName}`];
          const cancelledFeeQuery = {
            studentId,
            remarks: { $in: clubFeeRemarks },
            status: 'cancelled',
          };
          if (finalFeeHeadId) cancelledFeeQuery.feeHead = finalFeeHeadId;
          await StudentFee.updateMany(cancelledFeeQuery, { $set: { status: 'active' } });

          const txs = await Transaction.find({
            studentId,
            transactionType: 'DEBIT',
            status: { $nin: ['cancelled', 'transferred'] },
            remarks: { $regex: new RegExp(clubName, 'i') },
          });
          const totalPaid = txs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

          if (totalPaid >= requiredFee) {
            await masterPool.query(
              'UPDATE club_members SET status = ?, payment_status = ? WHERE club_id = ? AND student_id = ?',
              ['approved', 'paid', clubId, studentRecord.id]
            );

            const [chan] = await masterPool.query('SELECT id FROM chat_channels WHERE club_id = ? AND is_active = 1 LIMIT 1', [clubId]);
            if (chan.length) {
              await masterPool.query(
                'INSERT IGNORE INTO chat_channel_members (channel_id, member_type, student_id) VALUES (?, ?, ?)',
                [chan[0].id, 'student', studentRecord.id]
              ).catch(() => {});
            }
            console.log(`[PAYMENT] Club fee satisfied & member approved for student ${studentId}, club: ${clubName}`);
          }
        }
      }
    } catch (clubErr) {
      console.error('[PAYMENT] Club membership update error:', clubErr);
    }
  }

  // 2. Update Service Request Status if applicable
  const activeServiceReqId = serviceRequestId;
  if (activeServiceReqId) {
    try {
      await masterPool.query('UPDATE service_requests SET payment_status = ?, status = ? WHERE id = ?', [
        'paid',
        'processing',
        activeServiceReqId,
      ]);
      console.log(`[PAYMENT] Updated Service Request #${activeServiceReqId} to PAID / PROCESSING`);
    } catch (serviceErr) {
      console.error('[PAYMENT] Error updating service request:', serviceErr);
    }
  } else if (remarks && remarks.toLowerCase().includes('service request')) {
    const match = remarks.match(/Ref:\s*(\d+)/i) || remarks.match(/SR-(\d+)/i);
    if (match && match[1]) {
      try {
        await masterPool.query('UPDATE service_requests SET payment_status = ?, status = ? WHERE id = ?', [
          'paid',
          'processing',
          match[1],
        ]);
        console.log(`[PAYMENT] Updated Service Request #${match[1]} to PAID from remarks`);
      } catch (e) {
        console.error('[PAYMENT] Error updating service request from remarks:', e);
      }
    }
  }
}

/**
 * Endpoint 1: Create a Payment Order
 * POST /api/payments/create
 * Legacy alias: POST /api/payments/create-order
 */
exports.createOrder = async (req, res) => {
  try {
    const {
      studentId,
      amount,
      amountInRupees,
      collegeCode,
      courseCode,
      college,
      course,
      feeHeadId,
      studentYear,
      semester,
      remarks,
      description,
      referenceId,
      customerName,
      customerEmail,
      customerPhone,
      serviceRequestId,
      returnUrl,
    } = req.body;

    const amountVal = amountInRupees !== undefined ? Number(amountInRupees) : Number(amount);

    if (!amountVal || isNaN(amountVal) || amountVal <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    // 1. Fetch Student Details (if studentId provided) to enrich customer info & dynamic multi-tenant routing
    let student = null;
    let collegeName = 'Pydah Group';
    let studentName = customerName || '';
    let studentEmail = customerEmail || '';
    let studentContact = customerPhone || '';
    let resolvedCollege = collegeCode || college || null;
    let resolvedCourse = courseCode || course || null;

    if (studentId) {
      try {
        const [students] = await masterPool.query(
          `SELECT 
             s.id, s.admission_number, s.student_name, s.current_year, s.current_semester,
             s.course, s.branch, s.college,
             COALESCE(s.college_id, col.id) as resolved_college_id,
             COALESCE(s.course_id, c.id) as resolved_course_id,
             col.code as college_code,
             col.name as college_name,
             c.code as course_code,
             c.name as course_name,
             cb.code as branch_code,
             cb.name as branch_name,
             s.student_data
           FROM students s
           LEFT JOIN colleges col ON (s.college_id = col.id OR s.college COLLATE utf8mb4_unicode_ci = col.name COLLATE utf8mb4_unicode_ci)
           LEFT JOIN courses c ON (s.course_id = c.id OR (s.course COLLATE utf8mb4_unicode_ci = c.name COLLATE utf8mb4_unicode_ci AND (c.college_id = col.id OR c.college_id IS NULL)))
           LEFT JOIN course_branches cb ON (s.branch_id = cb.id OR (s.branch COLLATE utf8mb4_unicode_ci = cb.name COLLATE utf8mb4_unicode_ci AND cb.course_id = c.id))
           WHERE s.admission_number = ? OR s.admission_no = ?
           LIMIT 1`,
          [studentId, studentId]
        );

        if (students && students.length > 0) {
          student = students[0];
          studentName = studentName || student.student_name || '';

          // Dynamically resolve college & course codes for PPG dynamic routing
          if (!resolvedCollege) {
            resolvedCollege = student.college_code || student.resolved_college_id;
          }
          if (!resolvedCourse) {
            resolvedCourse = student.course_code || student.resolved_course_id;
          }

          if (student.college_name) collegeName = student.college_name;

          if (student.student_data) {
            const sd = typeof student.student_data === 'string' ? JSON.parse(student.student_data) : student.student_data;
            if (!collegeName && (sd.college || sd.College)) collegeName = sd.college || sd.College;

            studentEmail = studentEmail || sd.student_email || sd.email || sd.Student_Email || '';
            studentContact = studentContact || sd.student_mobile || sd.mobile || sd.parent_mobile1 || sd.Student_Mobile || '';
          }
        }
      } catch (err) {
        console.warn('[PAYMENT] Student lookup warning:', err.message);
      }
    }

    const { appKey, appSecret } = getPpgConfig();

    // 2. PRIMARY FLOW: Pydah Payment Gateway (PPG) Multi-Tenant Hosted Checkout Integration
    if (appKey && appSecret) {
      // PPG stores money in integer minor units (paise). ₹1,500.00 = 150000 paise.
      const amountInPaise = Math.round(amountVal * 100);
      const businessReference = referenceId || (studentId ? `SDMS-${studentId.replace(/\s+/g, '')}-${Date.now()}` : `REF-${Date.now()}`);
      const idempotencyKey = `idemp-${businessReference}`;

      console.log(`[PAYMENT -> PPG] Creating hosted payment order for reference: ${businessReference}, amount: ₹${amountVal}, college: ${resolvedCollege}, course: ${resolvedCourse}`);

      // Sanitize customer details (PPG Zod validator rejects empty strings for email)
      const customer = {};
      const validName = (studentName || customerName || '').trim();
      if (validName) {
        customer.name = validName.slice(0, 100);
      }
      const cleanEmail = (customerEmail || studentEmail || '').trim();
      if (cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        customer.email = cleanEmail;
      }
      const cleanPhone = (customerPhone || studentContact || '').trim();
      if (cleanPhone) {
        customer.phone = cleanPhone.slice(0, 20);
      }

      const defaultReturnUrl = returnUrl || (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0] + '/student/fees' : 'http://localhost:5173/student/fees');

      // Build payload strictly following PPG External App Integration Guide
      const ppgBody = {
        businessReference,
        amount: amountInPaise,
        currency: 'INR',
        description: description || remarks || 'Semester Tuition Fee',
        customer,
        returnUrl: defaultReturnUrl,
        notes: {
          studentId: studentId ? String(studentId) : '',
          feeHeadId: feeHeadId ? String(feeHeadId) : '',
          studentYear: studentYear ? String(studentYear) : '',
          semester: semester ? String(semester) : '',
          serviceRequestId: serviceRequestId ? String(serviceRequestId) : '',
          remarks: remarks ? String(remarks) : '',
        },
        idempotencyKey,
      };

      // Multi-tenant routing fields
      if (resolvedCollege) {
        ppgBody.college = resolvedCollege;
      }
      if (resolvedCourse) {
        ppgBody.course = resolvedCourse;
      }

      const ppgResponse = await callPpg('payments', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(ppgBody),
      });

      if (!ppgResponse.ok || !ppgResponse.data?.success) {
        console.error('[PAYMENT -> PPG] Order creation failed:', ppgResponse.data || ppgResponse.status);
        return res.status(ppgResponse.status || 500).json({
          success: false,
          error: ppgResponse.data?.error?.message || ppgResponse.data?.message || 'Failed to create payment order on PPG gateway',
        });
      }

      const ppgData = ppgResponse.data.data;

      return res.status(201).json({
        success: true,
        paymentId: ppgData.paymentId,
        checkoutUrl: ppgData.checkoutUrl,
        businessReference: ppgData.businessReference,
        status: ppgData.status,
        amount: ppgData.amount,
        currency: ppgData.currency,
        checkout: ppgData.checkout,
        // Backwards compatibility mappings for older frontend callers:
        order: {
          id: ppgData.checkout?.orderId,
          amount: ppgData.checkout?.amount,
          currency: ppgData.checkout?.currency || 'INR',
        },
        key_id: ppgData.checkout?.keyId,
        studentDetails: {
          name: studentName,
          email: studentEmail,
          contact: studentContact,
        },
      });
    }

    // 3. FALLBACK FLOW: Direct Razorpay via PaymentConfig if PPG keys are not yet configured in .env
    console.warn('[PAYMENT] PPG_APP_KEY/SECRET not found in .env; falling back to direct Razorpay config.');

    if (!student) {
      return res.status(400).json({ success: false, message: 'Student ID and active payment configuration required' });
    }

    const paymentConfig = await PaymentConfig.findOne({
      college: collegeName,
      course: student.course,
      is_active: true,
      razorpay_key_id: { $exists: true, $ne: '' },
    });

    if (!paymentConfig) {
      return res.status(404).json({ success: false, message: 'Online payment not configured for this college/course' });
    }

    const razorpay = new Razorpay({
      key_id: paymentConfig.razorpay_key_id,
      key_secret: paymentConfig.razorpay_key_secret,
    });

    const options = {
      amount: Math.round(amountVal * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${studentId.replace(/\s+/g, '')}`,
      notes: {
        studentId,
        studentName: student.student_name,
        feeHeadId: feeHeadId || '',
        studentYear: studentYear || '',
        semester: semester || '',
        serviceRequestId: serviceRequestId || '',
        remarks: remarks || 'Online Fee Payment',
      },
    };

    const order = await razorpay.orders.create(options);

    return res.json({
      success: true,
      order,
      key_id: paymentConfig.razorpay_key_id,
      studentDetails: {
        name: student.student_name,
        email: studentEmail,
        contact: studentContact,
      },
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    return res.status(500).json({ success: false, error: 'Failed to create payment order: ' + error.message });
  }
};

/**
 * Endpoint 2: Hosted Checkout Confirmation (Verify & Record from redirect)
 * POST /api/payments/confirm
 * GET /api/payments/confirm/:paymentId
 */
exports.confirmPayment = async (req, res) => {
  try {
    const paymentId = req.params.paymentId || req.body.paymentId;
    if (!paymentId) {
      return res.status(400).json({ success: false, error: 'Payment ID is required' });
    }

    // 1. Check if transaction is already recorded in MongoDB
    const existingTx = await Transaction.findOne({
      $or: [
        { ppgPaymentId: paymentId },
        { gatewayPaymentId: paymentId },
      ],
    });

    if (existingTx) {
      return res.json({
        success: true,
        message: 'Payment already recorded',
        status: 'SUCCEEDED',
        transaction: existingTx,
        receiptNumber: existingTx.receiptNumber,
      });
    }

    // 2. Fetch authoritative payment details from PPG
    const ppgRes = await callPpg(`payments/${paymentId}`);
    if (!ppgRes.ok || !ppgRes.data?.success) {
      return res.status(ppgRes.status || 400).json({
        success: false,
        error: ppgRes.data?.error?.message || ppgRes.data?.message || 'Failed to verify payment status with PPG',
      });
    }

    const payment = ppgRes.data.data;
    if (payment.status !== 'SUCCEEDED') {
      return res.json({
        success: false,
        status: payment.status,
        message: `Payment status is ${payment.status}`,
      });
    }

    // 3. Extract metadata stored in notes
    const notes = payment.notes || {};
    const studentId = notes.studentId;
    const finalFeeHeadId = notes.feeHeadId || null;
    const studentYear = notes.studentYear;
    const semester = notes.semester;
    const serviceRequestId = notes.serviceRequestId;
    const remarks = notes.remarks || payment.description || 'Paid via PPG Hosted Checkout';
    const payAmount = payment.amount ? payment.amount / 100 : 0;
    const providerPaymentId = payment.providerPaymentId || payment.providerOrderId || paymentId;

    // 4. Resolve Student from MySQL
    let studentRecord = null;
    if (studentId) {
      try {
        const [rows] = await masterPool.query(
          'SELECT s.id, s.student_name, s.course, s.current_year, s.current_semester, s.admission_number FROM students s WHERE s.admission_number = ?',
          [studentId]
        );
        if (rows && rows.length > 0) studentRecord = rows[0];
      } catch (e) {
        console.warn('[CONFIRM PAYMENT] Student lookup warning:', e.message);
      }
    }

    // 5. Allocate Receipt Number via Fees Service
    let receiptNumber = null;
    try {
      receiptNumber = await allocateReceiptNumber({
        studentId: studentId || studentRecord?.admission_number,
        feeHeadId: finalFeeHeadId,
        allocate: true,
      });
    } catch (e) {
      console.warn('[CONFIRM PAYMENT] Receipt allocation warning:', e.message);
    }

    // 6. Record Transaction in MongoDB
    const newTx = new Transaction({
      studentId: studentId || studentRecord?.admission_number || '',
      studentName: studentRecord?.student_name || payment.customer?.name || '',
      amount: Number(payAmount),
      transactionType: 'DEBIT',
      paymentMode: 'UPI',
      referenceNo: providerPaymentId,
      gatewayPaymentId: providerPaymentId,
      ppgPaymentId: paymentId,
      referenceOrderId: payment.providerOrderId || undefined,
      receiptNumber: receiptNumber || undefined,
      remarks,
      feeHead: finalFeeHeadId,
      studentYear: (studentYear || studentRecord?.current_year)?.toString(),
      semester: (semester || studentRecord?.current_semester)?.toString(),
      paymentDate: payment.paidAt ? new Date(payment.paidAt) : new Date(),
      collectedBy: 'Paid through UPI',
      collectedByName: 'Paid through UPI',
    });

    await newTx.save();
    console.log(`[CONFIRM PAYMENT] Transaction recorded: ${newTx._id} for student ${studentId} (Amount: ₹${payAmount}, Receipt: ${receiptNumber})`);

    // 7. Update Club Membership Status or Service Request if applicable
    await postPaymentSync({
      finalFeeHeadId,
      remarks,
      studentId,
      studentRecord,
      serviceRequestId,
    });

    return res.json({
      success: true,
      message: 'Payment confirmed & recorded successfully',
      status: 'SUCCEEDED',
      transaction: newTx,
      receiptNumber: newTx.receiptNumber,
    });
  } catch (err) {
    console.error('[CONFIRM PAYMENT] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Endpoint 3: Direct Verify Payment Signature (for backwards compatibility)
 * POST /api/payments/verify/:paymentId
 * Legacy alias: POST /api/payments/verify
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId: paramPaymentId } = req.params;
    const {
      paymentId: bodyPaymentId,
      ppgPaymentId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      amount,
      amountInRupees,
      feeHeadId,
      studentYear,
      semester,
      remarks,
      serviceRequestId,
    } = req.body;

    const activePaymentId = paramPaymentId || bodyPaymentId || ppgPaymentId;
    const rzpOrderId = razorpayOrderId || razorpay_order_id;
    const rzpPaymentId = razorpayPaymentId || razorpay_payment_id;
    const rzpSignature = razorpaySignature || razorpay_signature;
    let payAmount = Number(amountInRupees !== undefined ? amountInRupees : amount || 0);

    if (!rzpOrderId || !rzpPaymentId || !rzpSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment signature parameters (orderId, paymentId, signature)',
      });
    }

    // 1. Prevent duplicate recording of the same transaction
    const existingTx = await Transaction.findOne({
      $or: [
        { gatewayPaymentId: rzpPaymentId },
        ...(activePaymentId ? [{ ppgPaymentId: activePaymentId }] : []),
      ],
    });

    if (existingTx) {
      console.log(`[PAYMENT] Duplicate payment verification attempt: ${rzpPaymentId}`);
      return res.status(200).json({
        success: true,
        message: 'This payment has already been recorded',
        transaction: existingTx,
      });
    }

    const { appKey, appSecret } = getPpgConfig();
    let verifiedViaPpg = false;
    let ppgVerifiedData = null;

    // 2. Cryptographic Verification via PPG
    if (appKey && appSecret && activePaymentId) {
      console.log(`[PAYMENT -> PPG] Verifying payment ${activePaymentId} with PPG gateway...`);

      const verifyResponse = await callPpg(`payments/${activePaymentId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId,
          razorpaySignature: rzpSignature,
        }),
      });

      if (!verifyResponse.ok || !verifyResponse.data?.success) {
        console.error('[PAYMENT -> PPG] Gateway verification rejected:', verifyResponse.data || verifyResponse.status);
        return res.status(400).json({
          success: false,
          error: verifyResponse.data?.error?.message || verifyResponse.data?.message || 'Cryptographic signature verification failed by PPG',
        });
      }

      ppgVerifiedData = verifyResponse.data.data;
      verifiedViaPpg = true;

      // Extract verified amount from PPG (amount is in paise)
      if (ppgVerifiedData?.amount) {
        payAmount = ppgVerifiedData.amount / 100;
      }
    } else {
      // 3. Fallback signature verification
      let paymentConfig = null;
      if (studentId) {
        const [students] = await masterPool.query(
          'SELECT s.id, s.student_name, s.course, s.student_data FROM students s WHERE s.admission_number = ?',
          [studentId]
        );
        if (students && students.length > 0) {
          const student = students[0];
          let collegeName = 'Pydah Group';
          if (student.student_data) {
            try {
              const sd = typeof student.student_data === 'string' ? JSON.parse(student.student_data) : student.student_data;
              if (sd.college) collegeName = sd.college;
              else if (sd.College) collegeName = sd.College;
            } catch (e) {}
          }
          paymentConfig = await PaymentConfig.findOne({
            college: collegeName,
            course: student.course,
            is_active: true,
          });
        }
      }

      if (!paymentConfig) {
        paymentConfig = await PaymentConfig.findOne({ is_active: true });
      }

      if (!paymentConfig || !paymentConfig.razorpay_key_secret) {
        return res.status(400).json({ success: false, error: 'Payment configuration not found for signature verification' });
      }

      const sign = rzpOrderId + '|' + rzpPaymentId;
      const expectedSign = crypto
        .createHmac('sha256', paymentConfig.razorpay_key_secret)
        .update(sign.toString())
        .digest('hex');

      if (rzpSignature !== expectedSign) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature' });
      }
    }

    // 4. Fetch Student Info from MySQL
    let studentRecord = null;
    if (studentId) {
      try {
        const [rows] = await masterPool.query(
          'SELECT s.id, s.student_name, s.course, s.current_year, s.current_semester, s.admission_number FROM students s WHERE s.admission_number = ?',
          [studentId]
        );
        if (rows && rows.length > 0) {
          studentRecord = rows[0];
        }
      } catch (err) {
        console.warn('[PAYMENT] Error fetching student record for tx:', err.message);
      }
    }

    // 5. Link Service Request Fee Head (SSF) if applicable
    let finalFeeHeadId = feeHeadId || null;
    let finalRemarks = remarks || `Online Payment via PPG (${rzpPaymentId})`;
    const activeServiceReqId = serviceRequestId || req.body.service_request_id;

    if (activeServiceReqId || (remarks && remarks.toLowerCase().includes('service request'))) {
      try {
        const ssFeeHead = await FeeHead.findOne({ code: 'SSF' });
        if (ssFeeHead) {
          finalFeeHeadId = ssFeeHead._id;
        }
        if (activeServiceReqId && !finalRemarks.includes('Ref:')) {
          finalRemarks += ` (Ref: ${activeServiceReqId})`;
        }
      } catch (e) {
        console.error('[PAYMENT] Failed to link SSF fee head:', e);
      }
    }

    // 6. Allocate Receipt Number and Record Transaction in MongoDB
    let receiptNumber = req.body.receiptNumber;
    if (!receiptNumber) {
      try {
        receiptNumber = await allocateReceiptNumber({
          studentId: studentId || studentRecord?.admission_number,
          feeHeadId: finalFeeHeadId,
          allocate: true,
        });
      } catch (rcptErr) {
        console.warn('[PAYMENT] Error allocating receipt number:', rcptErr.message);
      }
    }

    const resolvedStudentName = (studentRecord?.student_name || req.body.customerName || '').trim();
    const newTransaction = new Transaction({
      studentId: studentId || studentRecord?.admission_number || '',
      studentName: resolvedStudentName,
      amount: Number(payAmount),
      transactionType: 'DEBIT',
      paymentMode: 'UPI',
      referenceNo: rzpPaymentId,
      gatewayPaymentId: rzpPaymentId,
      ppgPaymentId: activePaymentId || null,
      referenceOrderId: rzpOrderId,
      receiptNumber: receiptNumber || undefined,
      remarks: finalRemarks,
      feeHead: finalFeeHeadId,
      studentYear: (studentYear || studentRecord?.current_year)?.toString(),
      semester: (semester || studentRecord?.current_semester)?.toString(),
      paymentDate: new Date(),
      collectedBy: 'Paid through UPI',
      collectedByName: 'Paid through UPI',
    });

    await newTransaction.save();
    console.log(`[PAYMENT] Transaction recorded: ${newTransaction._id} for student ${studentId} (Amount: ₹${payAmount}, Receipt: ${receiptNumber})`);

    // 7. Post-payment sync
    await postPaymentSync({
      finalFeeHeadId,
      remarks,
      studentId,
      studentRecord,
      serviceRequestId: activeServiceReqId,
    });

    return res.json({
      success: true,
      message: 'Payment verified successfully and recorded',
      data: ppgVerifiedData,
      transaction: newTransaction,
      receiptNumber: newTransaction.receiptNumber,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ success: false, error: 'Payment verification failed: ' + error.message });
  }
};

/**
 * Endpoint 4: Status Check
 * GET /api/payments/status/:paymentId
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).json({ success: false, error: 'Payment ID is required' });
    }

    const { appKey, appSecret } = getPpgConfig();
    if (!appKey || !appSecret) {
      return res.status(400).json({ success: false, error: 'PPG credentials are not configured in environment' });
    }

    const ppgRes = await callPpg(`payments/${paymentId}`);
    return res.status(ppgRes.status).json(ppgRes.data || { success: false, error: 'Failed to retrieve payment status' });
  } catch (err) {
    console.error('[PAYMENT] Status lookup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Endpoint 5: Inbound Webhook Listener
 * POST /api/payments/webhook
 */
exports.handleWebhook = async (req, res) => {
  try {
    const event = req.body;
    const signature = req.headers['x-ppg-signature'];

    console.log(`[PPG Webhook] Event received: ${event?.event}`, event?.data);

    if (event?.event === 'payment.succeeded') {
      const { paymentId, providerPaymentId, amount, notes, description } = event.data || {};

      if (providerPaymentId || paymentId) {
        const existingTx = await Transaction.findOne({
          $or: [
            ...(providerPaymentId ? [{ gatewayPaymentId: providerPaymentId }] : []),
            ...(paymentId ? [{ ppgPaymentId: paymentId }] : []),
          ],
        });

        if (!existingTx && notes?.studentId) {
          console.log(`[PPG Webhook] Auto-reconciling unrecorded transaction: ${providerPaymentId || paymentId}`);
          let webhookStudentName = '';
          let studentRecord = null;
          try {
            const [rows] = await masterPool.query('SELECT s.id, s.student_name, s.admission_number FROM students WHERE admission_number = ?', [notes.studentId]);
            if (rows && rows.length > 0) {
              studentRecord = rows[0];
              webhookStudentName = rows[0].student_name || '';
            }
          } catch (e) {}

          let webhookReceiptNumber = null;
          try {
            webhookReceiptNumber = await allocateReceiptNumber({
              studentId: notes.studentId,
              feeHeadId: notes.feeHeadId || null,
              allocate: true,
            });
          } catch (e) {}

          const newTx = new Transaction({
            studentId: notes.studentId,
            studentName: webhookStudentName,
            amount: amount ? amount / 100 : 0,
            transactionType: 'DEBIT',
            paymentMode: 'UPI',
            referenceNo: providerPaymentId || paymentId,
            gatewayPaymentId: providerPaymentId || paymentId,
            ppgPaymentId: paymentId || null,
            receiptNumber: webhookReceiptNumber || undefined,
            remarks: notes.remarks || description || 'PPG Asynchronous Webhook Settlement',
            feeHead: notes.feeHeadId || null,
            studentYear: notes.studentYear || undefined,
            semester: notes.semester || undefined,
            paymentDate: new Date(),
            collectedBy: 'Paid through UPI',
            collectedByName: 'Paid through UPI',
          });
          await newTx.save();

          await postPaymentSync({
            finalFeeHeadId: notes.feeHeadId || null,
            remarks: notes.remarks || description,
            studentId: notes.studentId,
            studentRecord,
            serviceRequestId: notes.serviceRequestId,
          });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[PPG Webhook] Processing error:', error);
    return res.status(200).json({ received: false, error: error.message });
  }
};

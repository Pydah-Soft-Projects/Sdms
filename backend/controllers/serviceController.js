const { masterPool } = require("../config/database");
const { buildScopeConditions } = require("../utils/scoping");
const { sendNotificationToUser } = require("./pushController");
const { createNotification } = require("../services/notificationService");
const pdfService = require("../services/pdfService");
const fs = require("fs");
const FeeHead = require('../MongoDb-Models/FeeHead');
const {
  getDynamicServiceFeeHead,
  getAllAvailableFeeHeads,
  getServiceSettingsFromDb,
  saveServiceSettingsToDb,
  createServiceFeeDemand,
  checkFeePaymentStatus,
  cancelServiceFeeDemand
} = require("../services/serviceFeeConfig");

// Helper to check admin/staff privilege (supports admin, super_admin, subadmin, etc.)
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

// --- Services Configuration (Admin) ---

// Get all services (Admin sees all, Students see active only)
exports.getServices = async (req, res) => {
  try {
    const isAdmin = isAuthorizedStaffOrAdmin(req.user);
    let query = "SELECT * FROM services";
    const params = [];

    if (!isAdmin) {
      query += " WHERE is_active = TRUE";
    }

    query += " ORDER BY name ASC";

    const [rows] = await masterPool.execute(query, params);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createService = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      is_active,
      template_type,
      template_config,
      admin_fields,
    } = req.body;

    // Basic validation
    if (!name || price === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Name and Price are required" });
    }

    const [result] = await masterPool.execute(
      "INSERT INTO services (name, description, price, is_active, template_type, template_config, admin_fields) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        description,
        price,
        is_active !== undefined ? is_active : true,
        template_type || "standard",
        template_config ? JSON.stringify(template_config) : null,
        admin_fields ? JSON.stringify(admin_fields) : null,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      serviceId: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ success: false, message: "Service name already exists" });
    }
    console.error("Error creating service:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      is_active,
      template_type,
      template_config,
      admin_fields,
    } = req.body;

    const [result] = await masterPool.execute(
      "UPDATE services SET name = ?, description = ?, price = ?, is_active = ?, template_type = ?, template_config = ?, admin_fields = ? WHERE id = ?",
      [
        name,
        description,
        price,
        is_active,
        template_type || "standard",
        template_config ? JSON.stringify(template_config) : null,
        admin_fields ? JSON.stringify(admin_fields) : null,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, message: "Service updated successfully" });
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if used in requests
    const [requests] = await masterPool.execute(
      "SELECT 1 FROM service_requests WHERE service_id = ? LIMIT 1",
      [id],
    );
    if (requests.length > 0) {
      // Soft delete or prevent? Let's just deactivate if used
      await masterPool.execute(
        "UPDATE services SET is_active = FALSE WHERE id = ?",
        [id],
      );
      return res.json({
        success: true,
        message: "Service deactivated (cannot delete as it has requests)",
      });
    }

    const [result] = await masterPool.execute(
      "DELETE FROM services WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// --- Service Requests (Student & Admin) ---

// Helper to generate next sequential reference number per year, e.g. SR-2026-0001
const generateServiceRequestSequence = async (pool, targetYear) => {
  const year = targetYear || new Date().getFullYear();
  const prefix = `SR-${year}-`;
  try {
    const [rows] = await pool.execute(
      `SELECT sequence_no FROM service_requests WHERE sequence_no LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let nextNum = 1;
    if (rows.length > 0 && rows[0].sequence_no) {
      const parts = rows[0].sequence_no.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(4, "0")}`;
  } catch (err) {
    console.error("Error generating service request sequence:", err);
    return `${prefix}${String(Date.now()).slice(-4)}`;
  }
};

// Helper to append a lifecycle event to request history
const appendRequestHistory = async (pool, requestId, event) => {
  try {
    const [rows] = await pool.execute("SELECT history FROM service_requests WHERE id = ?", [requestId]);
    if (rows.length === 0) return;
    let history = [];
    if (rows[0].history) {
      try {
        history = typeof rows[0].history === 'string' ? JSON.parse(rows[0].history) : rows[0].history;
        if (!Array.isArray(history)) history = [];
      } catch (e) {
        history = [];
      }
    }
    const historyItem = {
      action: event.action || 'STATUS_UPDATE',
      title: event.title || 'Request Updated',
      details: event.details || '',
      performed_by: {
        id: event.performed_by?.id || null,
        name: event.performed_by?.name || 'Staff/Admin',
        role: event.performed_by?.role || 'admin',
      },
      timestamp: new Date().toISOString(),
    };
    history.push(historyItem);
    await pool.execute("UPDATE service_requests SET history = ? WHERE id = ?", [
      JSON.stringify(history),
      requestId,
    ]);
  } catch (err) {
    console.error(`[HISTORY AUDIT ERROR] Failed to append history for request ${requestId}:`, err);
  }
};

// Create Request (Student)
exports.requestService = async (req, res) => {
  try {
    const { service_id, purpose, ...otherData } = req.body;
    const student_id = req.user.id; // User must be a student

    // Verify service exists and is active
    const [service] = await masterPool.execute(
      "SELECT * FROM services WHERE id = ? AND is_active = TRUE",
      [service_id],
    );
    if (service.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or inactive service" });
    }

    // Generate unique sequence number
    const sequence_no = await generateServiceRequestSequence(masterPool);

    // Determine initial payment status based on price
    const servicePrice = Number(service[0].price || 0);
    const initialPaymentStatus = servicePrice > 0 ? "pending" : "paid";

    // Store additional request data properly
    const request_data = JSON.stringify({ purpose, sequence_no, ...otherData });

    const initialHistory = [{
      action: 'CREATED',
      title: 'Request Submitted by Student',
      details: `Service requested: ${service[0].name}. Price: ₹${servicePrice}. Purpose: ${purpose || 'Not specified'}`,
      performed_by: {
        id: student_id,
        name: req.user.name || req.user.student_name || 'Student',
        role: 'student'
      },
      timestamp: new Date().toISOString()
    }];

    const [result] = await masterPool.execute(
      "INSERT INTO service_requests (student_id, service_id, sequence_no, status, payment_status, request_data, history, created_at, request_date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [student_id, service_id, sequence_no, "pending", initialPaymentStatus, request_data, JSON.stringify(initialHistory)],
    );

    // If payment required, create unpaid demand in Fee Portal (MongoDB)
    if (servicePrice > 0) {
      try {
        await createServiceFeeDemand({
          requestId: result.insertId,
          studentId: student_id,
          serviceId: service_id,
          sequence_no,
        });
      } catch (feeErr) {
        console.error("[SERVICE FEE DEMAND ERROR]:", feeErr);
      }
    }

    res.status(201).json({
      success: true,
      message: servicePrice > 0
        ? "Service requested successfully. Unpaid due registered in Fee Portal."
        : "Service requested successfully.",
      requestId: result.insertId,
      sequence_no,
      payment_status: initialPaymentStatus,
    });
  } catch (error) {
    console.error("Error requesting service:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE Service Request (Student)
exports.deleteServiceRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const student_id = req.user.id; // Internal ID from auth middleware

        // 1. Fetch Request
        const [requests] = await masterPool.execute(
            'SELECT * FROM service_requests WHERE id = ?',
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const request = requests[0];

        // 2. Authorization Check (Must be own request)
        if (request.student_id !== student_id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // 3. Status Check (Must be pending/pending)
        if (request.status !== 'pending' || request.payment_status === 'paid') {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete processed or paid requests.' 
            });
        }

        // 4. Deactivate fee demand in MongoDB Fee Portal if any
        await cancelServiceFeeDemand({
            requestId: id,
            sequenceNo: request.sequence_no,
            reason: req.body?.reason || 'Cancelled/Deleted by student'
        });

        // 5. Delete from MySQL
        await masterPool.execute('DELETE FROM service_requests WHERE id = ?', [id]);

        res.json({ success: true, message: 'Request deleted successfully' });

    } catch (error) {
        console.error('Error deleting service request:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Fast Student Lookup for Service Requests (supports PIN or Admission Number)
exports.studentLookup = async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: "Identifier is required" });
    }
    const key = identifier.trim();

    const [rows] = await masterPool.query(
      `SELECT s.id, s.admission_number, s.admission_no, s.pin_no, s.student_name, s.father_name,
              s.student_mobile, s.parent_mobile1, s.student_address, s.dob, s.adhar_no, s.gender, s.caste,
              s.current_year, s.current_semester, s.batch, s.section,
              COALESCE(colleges.name, s.college) as college_name,
              COALESCE(colleges.name, s.college) as college,
              COALESCE(courses.name, s.course) as course,
              COALESCE(course_branches.name, s.branch) as branch,
              s.student_data
       FROM students s
       LEFT JOIN colleges ON s.college_id = colleges.id
       LEFT JOIN courses ON s.course_id = courses.id
       LEFT JOIN course_branches ON s.branch_id = course_branches.id
       WHERE s.admission_number = ? OR s.admission_no = ? OR s.pin_no = ?
       LIMIT 1`,
      [key, key, key]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const student = rows[0];
    let extra = {};
    if (student.student_data) {
      try {
        extra = typeof student.student_data === 'string' ? JSON.parse(student.student_data) : student.student_data;
      } catch (e) {
        extra = {};
      }
    }
    delete student.student_data;

    const admissionNum = student.admission_number || extra.admission_number || key;
    const pinNum = student.pin_no || extra.pin_no || (key !== admissionNum ? key : "");
    const collegeName = student.college_name || extra.college || extra.college_name || student.college || "";
    const courseName = student.course || extra.course || extra.Course || "";
    const branchName = student.branch || extra.branch || extra.Branch || "";
    const currentYear = student.current_year || extra.current_year || "";
    const currentSem = student.current_semester || extra.current_semester || extra['Current Semester'] || "";
    const acadYear = student.batch ? `${student.batch}-${parseInt(student.batch) + 1}` : (extra.academic_year || "");

    const merged = {
      ...extra,
      ...student,
      admission_number: admissionNum,
      admission_no: admissionNum,
      pin_no: pinNum,
      pin: pinNum,
      roll_number: pinNum,
      ht_no: pinNum,
      college_name: collegeName,
      college: collegeName,
      course: courseName,
      program: courseName,
      degree: courseName,
      branch: branchName,
      department: branchName,
      current_year: currentYear,
      year: currentYear,
      current_semester: currentSem,
      semester: currentSem,
      sem: currentSem,
      academic_year: acadYear,
      student_name: student.student_name || extra.student_name || "",
      name: student.student_name || extra.student_name || "",
      father_name: student.father_name || extra.father_name || "",
      father: student.father_name || extra.father_name || "",
      mother_name: extra.mother_name || "",
      mother: extra.mother_name || "",
      guardian_name: extra.guardian_name || "",
      guardian: extra.guardian_name || "",
      caste: student.caste || extra.caste || "",
      category: student.caste || extra.caste || "",
      dob: student.dob || extra.dob || "",
      date_of_birth: student.dob || extra.dob || "",
      gender: student.gender || extra.gender || "",
      sex: student.gender || extra.gender || "",
      student_mobile: student.student_mobile || extra.student_mobile || student.parent_mobile1 || "",
      mobile: student.student_mobile || extra.student_mobile || student.parent_mobile1 || "",
      phone_number: student.student_mobile || extra.student_mobile || student.parent_mobile1 || "",
      student_address: student.student_address || extra.student_address || "",
      address: student.student_address || extra.student_address || "",
    };

    return res.json({
      success: true,
      data: merged
    });
  } catch (error) {
    console.error("Student lookup error:", error);
    res.status(500).json({ success: false, message: "Lookup failed" });
  }
};

// Create Request (Admin on behalf of Student)
exports.createRequestByAdmin = async (req, res) => {
  try {
    const {
      service_id,
      admission_number,
      purpose,
      // Student Details
      student_name,
      father_name,
      student_mobile,
      course,
      branch,
      current_year,
      current_semester,
      dob,
      gender,
      caste,
      student_address,
      ...otherData
    } = req.body;

    // Validation
    const lookupKey = String(admission_number || otherData.pin_no || "").trim();
    if (!service_id || !lookupKey || !student_name) {
      return res.status(400).json({
        success: false,
        message: "Service, Admission / PIN Number, and Student Name are required",
      });
    }

    // Check if student exists by admission_number or pin_no
    const [students] = await masterPool.execute(
      "SELECT * FROM students WHERE admission_number = ? OR admission_no = ? OR pin_no = ?",
      [lookupKey, lookupKey, lookupKey],
    );
    let student_id;
    let resolvedAdmission = lookupKey;
    let resolvedPin = otherData.pin_no || "";

    if (students.length > 0) {
      student_id = students[0].id;
      resolvedAdmission = students[0].admission_number || lookupKey;
      resolvedPin = otherData.pin_no || students[0].pin_no || (lookupKey !== resolvedAdmission ? lookupKey : "");
      // Do not mutate existing student master data; service request data belongs only to this service request
    } else {
      // Create New Student
      resolvedAdmission = (admission_number || otherData.pin_no || "").toUpperCase().trim();
      resolvedPin = (otherData.pin_no || (admission_number !== resolvedAdmission ? admission_number : "") || "").toUpperCase().trim();
      const [insertStudentRes] = await masterPool.execute(
        `INSERT INTO students (
                    admission_number, pin_no, student_name, father_name, student_mobile,
                    course, branch, current_year, current_semester,
                    dob, gender, caste, student_address, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          resolvedAdmission,
          resolvedPin || null,
          student_name ? String(student_name).toUpperCase() : null,
          father_name ? String(father_name).toUpperCase() : null,
          student_mobile || null,
          course ? String(course).toUpperCase() : null,
          branch ? String(branch).toUpperCase() : null,
          current_year || null,
          current_semester || null,
          dob || null,
          gender ? String(gender).toUpperCase() : null,
          caste ? String(caste).toUpperCase() : null,
          student_address ? String(student_address).toUpperCase() : null,
        ],
      );
      student_id = insertStudentRes.insertId;
    }

    // Verify service
    const [service] = await masterPool.execute(
      "SELECT * FROM services WHERE id = ?",
      [service_id],
    );
    if (service.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid service" });
    }

    // Generate unique sequence number
    const sequence_no = await generateServiceRequestSequence(masterPool);

    const requestDataObj = {
      sequence_no,
      purpose,
      student_name,
      father_name,
      admission_number: resolvedAdmission,
      pin_no: resolvedPin || undefined,
      student_mobile,
      course,
      branch,
      current_year,
      current_semester,
      dob,
      gender,
      caste,
      student_address,
      ...otherData
    };
    Object.keys(requestDataObj).forEach((k) => {
      if (requestDataObj[k] === undefined) {
        delete requestDataObj[k];
      } else if (typeof requestDataObj[k] === 'string' && k !== 'dob' && !k.includes('date') && !k.includes('email') && !k.includes('image')) {
        requestDataObj[k] = requestDataObj[k].toUpperCase();
      }
    });
    const request_data = JSON.stringify(requestDataObj);

    // Determine initial payment status based on price
    const servicePrice = Number(service[0].price || 0);
    const initialPaymentStatus = servicePrice > 0 ? "pending" : "paid";

    const initialHistory = [{
      action: 'CREATED_BY_ADMIN',
      title: 'Request Created by Staff/Admin',
      details: `Created on behalf of student ${student_name} (${resolvedAdmission}). Service: ${service[0].name}, Price: ₹${servicePrice}. Payment status: ${initialPaymentStatus}.`,
      performed_by: {
        id: req.user?.id || null,
        name: req.user?.name || req.user?.username || 'Staff/Admin',
        role: req.user?.role || 'admin',
      },
      timestamp: new Date().toISOString(),
    }];

    // Create request with payment_status based on price
    const [result] = await masterPool.execute(
      "INSERT INTO service_requests (student_id, service_id, sequence_no, status, payment_status, request_data, history, created_at, request_date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [student_id, service_id, sequence_no, "pending", initialPaymentStatus, request_data, JSON.stringify(initialHistory)],
    );

    // If payment required, create unpaid demand in Fee Portal (MongoDB)
    if (servicePrice > 0) {
      try {
        await createServiceFeeDemand({
          requestId: result.insertId,
          studentId: student_id,
          serviceId: service_id,
          sequence_no,
        });
      } catch (feeErr) {
        console.error("[SERVICE FEE DEMAND ERROR]:", feeErr);
      }
    }

    res.status(201).json({
      success: true,
      message: servicePrice > 0
        ? "Service request created. Unpaid due registered in Fee Portal."
        : "Service request created.",
      requestId: result.insertId,
      sequence_no,
      payment_status: initialPaymentStatus,
      // Return context for frontend
      student_name: student_name,
      service_name: service[0].name,
      service_price: servicePrice,
    });
  } catch (error) {
    console.error("Error creating admin request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get Requests
exports.getServiceRequests = async (req, res) => {
  try {
    const { status, student_id, course, branch, current_year, current_semester } = req.query;
    const isStudent =
      req.user.role === "student" || (!req.user.isAdmin && !req.user.role); // Assuming simplified role check

    // Build query
    let query = `
      SELECT sr.*, s.name as service_name, s.price as service_price, s.admin_fields, s.template_type, s.template_config,
             st.student_name, st.admission_number, st.pin_no, st.course, st.branch, st.current_year, st.current_semester, st.student_mobile
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN students st ON sr.student_id = st.id
    `;

    const params = [];
    const conditions = [];

    // If student, only show their requests
    if (isStudent || student_id) {
      // Allow admin to filter by student_id
      // If isStudent is true, force student_id to be logged in user
      const targetId = isStudent ? req.user.id : student_id;
      conditions.push("sr.student_id = ?");
      params.push(targetId);
    }

    if (status) {
      conditions.push("sr.status = ?");
      params.push(status);
    }

    if (course) {
      conditions.push("(st.course = ? OR JSON_UNQUOTE(JSON_EXTRACT(sr.request_data, '$.course')) = ?)");
      params.push(course, course);
    }

    if (branch) {
      conditions.push("(st.branch = ? OR JSON_UNQUOTE(JSON_EXTRACT(sr.request_data, '$.branch')) = ?)");
      params.push(branch, branch);
    }

    if (current_year) {
      conditions.push("(st.current_year = ? OR JSON_UNQUOTE(JSON_EXTRACT(sr.request_data, '$.current_year')) = ?)");
      params.push(current_year, current_year);
    }

    if (current_semester) {
      conditions.push("(st.current_semester = ? OR JSON_UNQUOTE(JSON_EXTRACT(sr.request_data, '$.current_semester')) = ?)");
      params.push(current_semester, current_semester);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Apply Scope Filtering (for admins)
    if (!isStudent && req.userScope) {
      const { conditions: scopeConditions, params: scopeParams } =
        buildScopeConditions(req.userScope, "st");
      if (scopeConditions.length > 0) {
        // If WHERE clause exists, append with AND, else start with WHERE
        query +=
          (query.includes("WHERE") ? " AND " : " WHERE ") +
          scopeConditions.join(" AND ");
        params.push(...scopeParams);
      }
    }

    query += " ORDER BY sr.request_date DESC";

    const [rows] = await masterPool.execute(query, params);

    // Ensure sequence_no is populated and apply request_data overrides to row display
    rows.forEach((r) => {
      if (!r.sequence_no) {
        const year = new Date(r.created_at || r.request_date || Date.now()).getFullYear();
        r.sequence_no = `SR-${year}-${String(r.id).padStart(4, '0')}`;
      }
      if (r.request_data) {
        let rd = r.request_data;
        if (typeof rd === 'string') {
          try { rd = JSON.parse(rd); } catch (e) { rd = {}; }
        }
        if (rd && typeof rd === 'object') {
          if (rd.sequence_no) r.sequence_no = rd.sequence_no;
          if (rd.student_name) r.student_name = rd.student_name;
          if (rd.course) r.course = rd.course;
          if (rd.branch) r.branch = rd.branch;
          if (rd.student_mobile) r.student_mobile = rd.student_mobile;
          if (rd.current_year) r.current_year = rd.current_year;
          if (rd.current_semester) r.current_semester = rd.current_semester;
        }
      }
      // History normalization: parse string or generate sensible timeline for legacy records
      let hist = r.history;
      if (typeof hist === 'string') {
        try { hist = JSON.parse(hist); } catch (e) { hist = []; }
      }
      if (!Array.isArray(hist) || hist.length === 0) {
        hist = [{
          action: 'CREATED',
          title: 'Request Initiated',
          details: `Request created for ${r.service_name || 'Service'}. Initial fee status: ${r.payment_status || 'pending'}.`,
          performed_by: {
            id: r.student_id,
            name: r.student_name || 'Student',
            role: 'student'
          },
          timestamp: r.created_at || r.request_date || new Date().toISOString()
        }];
        if (r.payment_status === 'paid') {
          hist.push({
            action: 'PAYMENT_VERIFIED',
            title: 'Payment Completed',
            details: `Fee payment verified.`,
            performed_by: { name: 'Fee System', role: 'system' },
            timestamp: r.request_date || new Date().toISOString()
          });
        }
        if (r.status === 'processing') {
          hist.push({
            action: 'STATUS_CHANGED',
            title: 'Request Marked as In Processing',
            details: 'Request is currently being processed by staff.',
            performed_by: { name: 'Staff/Admin', role: 'admin' },
            timestamp: r.request_date || new Date().toISOString()
          });
        } else if (r.status === 'ready_to_collect') {
          hist.push({
            action: 'READY_TO_COLLECT',
            title: 'Ready for Collection',
            details: `Collection scheduled: ${r.collect_date ? new Date(r.collect_date).toLocaleDateString() : 'Ready'}. Note: ${r.admin_note || 'Available at office.'}`,
            performed_by: { name: 'Staff/Admin', role: 'admin' },
            timestamp: r.collect_date || r.request_date || new Date().toISOString()
          });
        } else if (r.status === 'closed') {
          hist.push({
            action: 'CLOSED',
            title: 'Request Closed & Delivered',
            details: 'Certificate issued and delivered to student.',
            performed_by: { name: 'Staff/Admin', role: 'admin' },
            timestamp: r.request_date || new Date().toISOString()
          });
        } else if (r.status === 'cancelled') {
          hist.push({
            action: 'CANCELLED',
            title: 'Request Cancelled',
            details: `Request cancelled. Reason: ${r.admin_note || 'Cancelled before payment.'}`,
            performed_by: { name: 'Staff/Admin', role: 'admin' },
            timestamp: r.updated_at || r.request_date || new Date().toISOString()
          });
        }
      }
      r.history = hist;
    });

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching service requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Request Status (Admin)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, collect_date, admin_note, reason, ...otherUpdates } = req.body;

    // Fetch current request data to merge JSON, and get student/service info for notification
    const [existing] = await masterPool.execute(
      "SELECT sr.request_data, sr.student_id, sr.payment_status, sr.sequence_no, s.name as service_name, s.price as service_price FROM service_requests sr LEFT JOIN services s ON sr.service_id = s.id WHERE sr.id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    const cancellationReason = (admin_note || reason || req.body?.cancellation_reason || '').trim();

    // Cancellation Handling
    if (status === 'cancelled') {
      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is mandatory when cancelling a request.'
        });
      }

      if (existing[0].payment_status === 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel request: Fee payment has already been received.'
        });
      }

      // 1. Update status to cancelled in MySQL
      await masterPool.execute(
        "UPDATE service_requests SET status = 'cancelled', admin_note = ? WHERE id = ?",
        [cancellationReason, id]
      );

      // 2. Mark fee demand in MongoDB Fee Portal as inactive
      await cancelServiceFeeDemand({
        requestId: id,
        sequenceNo: existing[0].sequence_no,
        reason: cancellationReason
      });

      // 3. Append to Audit Log History
      await appendRequestHistory(masterPool, id, {
        action: 'CANCELLED',
        title: 'Request Cancelled',
        details: `Request cancelled. Reason: ${cancellationReason}`,
        performed_by: {
          id: req.user?.id || null,
          name: req.user?.name || req.user?.username || 'Staff/Admin',
          role: req.user?.role || 'admin',
        },
      });

      // 4. Send Push Notification to Student
      if (existing[0] && existing[0].student_id) {
        sendNotificationToUser(existing[0].student_id, {
          title: "Service Request Cancelled",
          body: `Your request for ${existing[0].service_name || 'Service'} has been cancelled. Reason: ${cancellationReason}`,
          icon: "/icon-192x192.png",
          data: { url: "/student/services" }
        }).catch(err => console.error("Notification send error:", err));
      }

      return res.json({
        success: true,
        message: 'Request cancelled successfully and fee demand marked inactive in Fee Portal.'
      });
    }

    // Block all other status updates (processing, ready_to_collect, closed) if fee is pending
    const serviceFee = Number(existing[0].service_price || 0);
    if (existing[0].payment_status !== 'paid' && serviceFee > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot process or update request status: Payment is pending in the Fee Portal.'
      });
    }

    let currentData = existing[0].request_data;
    // Parse if string
    if (typeof currentData === "string") {
      try {
        currentData = JSON.parse(currentData);
      } catch (e) {
        currentData = {};
      }
    }

    // Merge legitimate extra fields that shouldn't be top-level columns
    // Merge extra fields into request_data
    // We now allow any extra fields sent from the frontend dynamic form
    const predefinedFields = ["status", "collect_date", "admin_note"];
    let hasDataUpdate = false;

    Object.keys(otherUpdates).forEach((key) => {
      if (!predefinedFields.includes(key)) {
        currentData[key] = otherUpdates[key];
        hasDataUpdate = true;
      }
    });

    let query = "UPDATE service_requests SET status = ?";
    const params = [status];

    if (collect_date) {
      query += ", collect_date = ?";
      params.push(collect_date);
    }

    if (admin_note) {
      query += ", admin_note = ?";
      params.push(admin_note);
    }

    if (hasDataUpdate) {
      query += ", request_data = ?";
      params.push(JSON.stringify(currentData));
    }

    query += " WHERE id = ?";
    params.push(id);

    const [result] = await masterPool.execute(query, params);

    // Append to audit history
    const statusLabels = {
      pending: 'Pending',
      processing: 'In Processing',
      ready_to_collect: 'Ready to Collect',
      closed: 'Closed / Completed',
      rejected: 'Rejected',
    };
    let detailsStr = `Status updated to ${statusLabels[status] || status}.`;
    if (collect_date) detailsStr += ` Scheduled collection date: ${collect_date}.`;
    if (admin_note) detailsStr += ` Note: ${admin_note}`;

    await appendRequestHistory(masterPool, id, {
      action: status === 'ready_to_collect' ? 'READY_TO_COLLECT' : status === 'closed' ? 'CLOSED' : 'STATUS_CHANGED',
      title: `Status: ${statusLabels[status] || status}`,
      details: detailsStr,
      performed_by: {
        id: req.user?.id || null,
        name: req.user?.name || req.user?.username || 'Staff/Admin',
        role: req.user?.role || 'admin',
      },
    });

    // Send Push Notification
    if (existing[0] && existing[0].student_id) {
      const studentId = existing[0].student_id;
      const serviceName = existing[0].service_name || "Service Request";

      // Async send (don't await)
      sendNotificationToUser(studentId, {
        title: "Service Update",
        body: `Your request for ${serviceName} is now ${status}.`,
        icon: "/icon-192x192.png",
        data: {
          url: "/student/services",
        },
      }).catch((e) => console.error("Service notification failed:", e));

      // Send Web Notification
      createNotification({
        studentId: studentId,
        title: "Service Request Update",
        message: `Your request for ${serviceName || "Service"} is now ${status}.`,
        category: "Service",
        data: { requestId: id, url: "/student/services" },
      }).catch((e) => console.error("Web notification failed:", e));
    }

    res.json({ success: true, message: "Request updated successfully" });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Service Request Data (Admin/Staff) - Only updates service request data, NEVER affects students master table
exports.updateServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { request_data, status, collect_date, admin_note, ...rest } = req.body;

    const [existing] = await masterPool.execute(
      "SELECT id, request_data, status FROM service_requests WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    let currentData = existing[0].request_data;
    if (typeof currentData === "string") {
      try {
        currentData = JSON.parse(currentData);
      } catch (e) {
        currentData = {};
      }
    } else if (!currentData || typeof currentData !== "object") {
      currentData = {};
    }

    const incomingData =
      request_data && typeof request_data === "object"
        ? request_data
        : rest && Object.keys(rest).length > 0
          ? rest
          : {};

    const mergedData = {
      ...currentData,
      ...incomingData,
    };

    Object.keys(mergedData).forEach((k) => {
      if (typeof mergedData[k] === 'string' && k !== 'dob' && k !== 'collect_date' && !k.includes('date') && !k.includes('email') && !k.includes('image')) {
        mergedData[k] = mergedData[k].toUpperCase();
      }
    });

    const updateFields = ["request_data = ?"];
    const params = [JSON.stringify(mergedData)];

    if (status) {
      updateFields.push("status = ?");
      params.push(status);
    }
    if (collect_date !== undefined) {
      updateFields.push("collect_date = ?");
      params.push(collect_date || null);
    }
    if (admin_note !== undefined) {
      updateFields.push("admin_note = ?");
      params.push(admin_note || null);
    }

    if (req.body.sequence_no || incomingData.sequence_no) {
      updateFields.push("sequence_no = ?");
      params.push(req.body.sequence_no || incomingData.sequence_no);
    }

    params.push(id);

    await masterPool.execute(
      `UPDATE service_requests SET ${updateFields.join(", ")} WHERE id = ?`,
      params,
    );

    await appendRequestHistory(masterPool, id, {
      action: 'DATA_UPDATED',
      title: 'Certificate Data Verified / Updated',
      details: 'Staff/Admin verified and updated student & certificate issuance fields before printing.',
      performed_by: {
        id: req.user?.id || null,
        name: req.user?.name || req.user?.username || 'Staff/Admin',
        role: req.user?.role || 'admin',
      },
    });

    res.json({
      success: true,
      message: "Service request updated successfully",
      data: {
        id,
        request_data: mergedData,
        ...(status ? { status } : {}),
      },
    });
  } catch (error) {
    console.error("Error updating service request:", error);
    res.status(500).json({ success: false, message: "Failed to update service request" });
  }
};

// Mock Payment Process
// Mark Payment as Received (Admin/Staff)
exports.processPayment = async (req, res) => {
  try {
    const { request_id } = req.body;

    // Ensure user is admin (or handled by middleware)
    const isAdmin =
      req.user &&
      (req.user.role === "admin" ||
        req.user.role === "super_admin" ||
        req.user.isAdmin);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const [requests] = await masterPool.execute(
      "SELECT * FROM service_requests WHERE id = ?",
      [request_id],
    );

    if (requests.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    // Mark as paid
    await masterPool.execute(
      "UPDATE service_requests SET payment_status = 'paid' WHERE id = ?",
      [request_id],
    );

    res.json({
      success: true,
      message: "Payment marked as received",
      status: "paid",
    });
  } catch (error) {
    console.error("Error in payment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Download Certificate
exports.downloadCertificate = async (req, res) => {
  try {
    const { id } = req.params; // request id
    const student_id = req.user.id;
    const isAdmin = isAuthorizedStaffOrAdmin(req.user);

    // Fetch request with service and student details
    const query = `
            SELECT sr.*, s.name as service_name, s.price as service_price, s.template_type, s.template_config, st.*,
            c.name as college_name, c.metadata as college_metadata, c.address as college_address
            FROM service_requests sr
            JOIN services s ON sr.service_id = s.id
            JOIN students st ON sr.student_id = st.id
            LEFT JOIN colleges c ON st.college COLLATE utf8mb4_unicode_ci = c.name
            WHERE sr.id = ?
        `;

    const [rows] = await masterPool.execute(query, [id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    const request = rows[0];

    // Access Check
    if (!isAdmin && request.student_id !== student_id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Payment Check: Cannot issue or download certificate if fee is pending
    const reqPrice = Number(request.service_price || request.price || 0);
    if (reqPrice > 0 && request.payment_status !== "paid") {
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed in Fee Portal. Please pay and sync fee status before issuing certificate." });
    }

    // Parse request_data safely
    if (typeof request.request_data === "string") {
      try {
        request.request_data = JSON.parse(request.request_data);
      } catch (e) {
        request.request_data = {};
      }
    } else if (!request.request_data || typeof request.request_data !== "object") {
      request.request_data = {};
    }

    // Sequence calculation for reference in certificates
    const reqYear = new Date(request.created_at || request.request_date || Date.now()).getFullYear();
    const seqCode = request.sequence_no || `SR-${reqYear}-${String(request.id).padStart(4, "0")}`;
    const seqDigits = seqCode.includes("-") ? seqCode.split("-").pop() : String(request.id).padStart(4, "0");

    // Effective student combines base student record with service-specific overrides from request_data
    const effectiveStudent = {
      ...request,
      sequence_no: seqCode,
      sequence: seqDigits,
      serial_no: seqCode,
      ref_no: seqCode,
      certificate_no: seqCode,
      ...request.request_data
    };

    // Parse college metadata
    let collegeDetails = {
      name: request.college_name || "College",
      phone: "",
      website: "",
      address: request.college_address || "",
    };
    if (request.college_metadata) {
      try {
        const meta =
          typeof request.college_metadata === "string"
            ? JSON.parse(request.college_metadata)
            : request.college_metadata;
        collegeDetails = { ...collegeDetails, ...meta };
      } catch (e) {}
    }
    if (request.college_address && !collegeDetails.address) {
      collegeDetails.address = request.college_address;
    }

    // Generate PDF based on template type
    if (
      request.template_type === "study_certificate" ||
      request.service_name.toLowerCase().includes("study")
    ) {
      filePath = await pdfService.generateStudyCertificate(
        effectiveStudent,
        request,
        collegeDetails,
      );
    } else if (
      request.template_type === "refund_application" ||
      request.service_name.toLowerCase().includes("refund")
    ) {
      filePath = await pdfService.generateRefundApplication(
        effectiveStudent,
        request,
        collegeDetails,
      );
    } else if (request.template_type === "custodian_certificate") {
      filePath = await pdfService.generateCustodianCertificate(
        effectiveStudent,
        request,
        collegeDetails,
      );
    } else if (request.template_type === "dynamic" && request.template_config) {
      let config = request.template_config;
      if (typeof config === "string") {
        try {
          config = JSON.parse(config);
        } catch (e) {
          config = {};
        }
      }

      // Check if it's the three-section format or element-based format
      if (
        config.top_content ||
        config.middle_content ||
        config.bottom_content
      ) {
        // Process variables for the three sections
        const todayDateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");
        const studentData = {
          current_date: todayDateStr,
          date: todayDateStr,
          sequence_no: seqCode,
          sequence: seqDigits,
          serial_no: seqCode,
          ref_no: seqCode,
          certificate_no: seqCode,
          ...request,
          ...request.request_data,
          ...collegeDetails,
        };
        if (!studentData.current_date) studentData.current_date = todayDateStr;
        if (!studentData.date) studentData.date = todayDateStr;

        const replaceVariables = (text) => {
          if (!text) return "";
          const inputSize = Math.min(Math.max(parseInt(config.input_field_size) || 10, 4), 30);
          const defaultBlank = "_".repeat(inputSize);

          // 1. Sanitize tabs and carriage returns
          let processed = text.replace(/[\t\r]/g, " ");

          // 2. Clean inner content of alignment tags [right]...[/right], etc.
          processed = processed.replace(/\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]/gi, (match, tag, inner) => {
            return `[${tag}]${inner.trim()}[/${tag}]`;
          });

          // 3. Normalize multiple consecutive spaces in text first
          processed = processed.replace(/ {2,}/g, " ");

          // 4. Handle blanks: replace fill values if provided, or represent with free space (no drawn lines)
          let blankIdx = 0;
          processed = processed.replace(/(?:___(?:\[(\d+)\])?(?:\s*___)*)+|_{2,}|[.\u2026]{2,}|[—–―-]{2,}/g, (match, customLen) => {
            blankIdx++;
            const val = studentData[`field_${blankIdx}`] || studentData[`input_field_${blankIdx}`] || studentData[`blank_${blankIdx}`];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              return String(val).toUpperCase();
            }
            return "        ";
          });

          // 5. Handle {{variable}} syntax
          processed = processed.replace(/{{(.*?)}}/g, (match, p1) => {
            const key = p1.trim();
            if (key === "current_date" || key === "date") return todayDateStr;
            return studentData[key] !== undefined && studentData[key] !== null ? String(studentData[key]).toUpperCase() : "";
          });
          // 6. Handle @[label](variable) or @variable syntax
          processed = processed.replace(/@\[.*?\]\((.*?)\)/g, (match, p1) => {
            if (p1 === "current_date" || p1 === "date") return todayDateStr;
            return studentData[p1] !== undefined && studentData[p1] !== null ? String(studentData[p1]).toUpperCase() : "";
          });
          processed = processed.replace(/@(\w+)/g, (match, p1) => {
            if (p1 === "current_date" || p1 === "date") return todayDateStr;
            return studentData[p1] !== undefined && studentData[p1] !== null ? String(studentData[p1]).toUpperCase() : "";
          });
          return processed;
        };

        const topSource = config.top_content || collegeDetails?.metadata?.header_content || "";
        const processedContent = {
          topContent: replaceVariables(topSource),
          middleContent: replaceVariables(config.middle_content),
          bottomContent: replaceVariables(config.bottom_content),
        };

        const enrichedConfig = {
          ...config,
          header_image_url: collegeDetails.header_image_url,
          footer_image_url: null,
          footer_height: 0,
        };
        const sanitizedCollegeDetails = {
          ...collegeDetails,
          footer_image: null,
          footer_image_url: null,
        };

        filePath = await pdfService.generateTemplatedCertificate(
          enrichedConfig,
          processedContent,
          effectiveStudent,
          sanitizedCollegeDetails,
        );
      } else {
        filePath = await pdfService.generateDynamicCertificate(
          effectiveStudent,
          request,
          collegeDetails,
          config,
        );
      }
    } else {
      // Default or throw
      return res.status(400).json({
        success: false,
        message:
          "Certificate template not implemented or config missing for this service",
      });
    }

    // Record certificate generation in audit history
    appendRequestHistory(masterPool, id, {
      action: 'CERTIFICATE_GENERATED',
      title: 'Certificate Generated & Printed',
      details: `Generated official document for ${request.service_name || 'Service'}. Ready for delivery to student.`,
      performed_by: {
        id: req.user?.id || null,
        name: req.user?.name || req.user?.username || (isAdmin ? 'Admin' : 'Student'),
        role: req.user?.role || (isAdmin ? 'admin' : 'student'),
      },
    }).catch(err => console.error("Failed to append download history:", err));

    // Send file as inline preview (for printing)
    res.sendFile(
      filePath,
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Certificate_${request.admission_number || "document"}.pdf"`,
        },
      },
      (err) => {
        if (err) console.error("Error sending file:", err);
        // Cleanup
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        }, 5000); // 5s should be enough for browser to buffer
      },
    );
  } catch (error) {
    console.error("Error downloading certificate:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Fixed character lengths for system variables in blank preview
const VARIABLE_FIXED_CHARS = {
  student_name: 24,
  name: 24,
  admission_number: 12,
  pin_no: 12,
  ht_no: 12,
  father_name: 22,
  mother_name: 22,
  guardian_name: 22,
  dob: 10,
  date_of_birth: 10,
  course: 10,
  branch: 22,
  current_year: 4,
  year: 4,
  current_semester: 4,
  semester: 4,
  academic_year: 11,
  admission_date: 10,
  date: 10,
  current_date: 10,
  principal_signature: 20,
  college_name: 30,
  gender: 6,
  caste: 6,
  religion: 8,
  sequence_no: 12,
  sequence: 6,
  serial_no: 12,
  ref_no: 12,
  certificate_no: 12,
  student_mobile: 10,
  phone_number: 10,
};

// Preview Template (Admin)
exports.previewTemplate = async (req, res) => {
  try {
    const { template_type, service_name } = req.body;
    const isAdmin = isAuthorizedStaffOrAdmin(req.user);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const todayDateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");

    let config = req.body.template_config || {};
    if (typeof config === "string") {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }

    // Fetch Actual College Details
    let collegeDetails = {
      name: "",
      phone: "",
      website: "",
    };

    const targetCollegeId = config.college_id || req.body.college_id;

    try {
      let target;
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
      }

      if (target) {
        collegeDetails.name = target.name || "";
        collegeDetails.college_name = target.name || "";
        if (target.address) {
          collegeDetails.address = target.address;
        }
        if (target.website) {
          collegeDetails.website = target.website;
        }
        if (target.metadata) {
          const meta =
            typeof target.metadata === "string"
              ? JSON.parse(target.metadata)
              : target.metadata;
          collegeDetails = { ...collegeDetails, ...meta };
          if (target.website) {
            collegeDetails.website = target.website;
          }
        }
        // Add image URLs and binary data for templated certificate (footers omitted)
        if (target.header_image_url)
          collegeDetails.header_image_url = target.header_image_url;
        collegeDetails.footer_image_url = null;
        if (target.header_image)
          collegeDetails.header_image = target.header_image;
        collegeDetails.footer_image = null;
        if (target.principal_signature)
          collegeDetails.principal_signature = target.principal_signature;
        if (target.principal_signature_url)
          collegeDetails.principal_signature_url = target.principal_signature_url;
      }
    } catch (e) {
      console.warn("Could not fetch college details for preview", e);
    }

    // Blank Student Data (for template structure preview)
    const blankStudent = {
      student_name: "_".repeat(VARIABLE_FIXED_CHARS.student_name || 24),
      name: "_".repeat(VARIABLE_FIXED_CHARS.student_name || 24),
      admission_number: "_".repeat(VARIABLE_FIXED_CHARS.admission_number || 12),
      father_name: "_".repeat(VARIABLE_FIXED_CHARS.father_name || 20),
      mother_name: "_".repeat(VARIABLE_FIXED_CHARS.mother_name || 20),
      current_year: "_".repeat(VARIABLE_FIXED_CHARS.current_year || 4),
      year: "_".repeat(VARIABLE_FIXED_CHARS.year || 4),
      current_semester: "_".repeat(VARIABLE_FIXED_CHARS.current_semester || 4),
      semester: "_".repeat(VARIABLE_FIXED_CHARS.semester || 4),
      course: "_".repeat(VARIABLE_FIXED_CHARS.course || 10),
      branch: "_".repeat(VARIABLE_FIXED_CHARS.branch || 22),
      student_mobile: "_".repeat(10),
      parent_mobile1: "_".repeat(10),
      academic_year: "_".repeat(VARIABLE_FIXED_CHARS.academic_year || 11),
      pin_no: "_".repeat(VARIABLE_FIXED_CHARS.pin_no || 10),
      ht_no: "_".repeat(VARIABLE_FIXED_CHARS.pin_no || 10),
      dob: "_".repeat(VARIABLE_FIXED_CHARS.dob || 10),
      date_of_birth: "_".repeat(VARIABLE_FIXED_CHARS.dob || 10),
      email: "{{email}}",
      religion: "_".repeat(VARIABLE_FIXED_CHARS.religion || 8),
      caste: "_".repeat(VARIABLE_FIXED_CHARS.caste || 6),
      gender: "_".repeat(VARIABLE_FIXED_CHARS.gender || 6),
      admission_date: "_".repeat(VARIABLE_FIXED_CHARS.admission_date || 10),
      sequence_no: `SR-${new Date().getFullYear()}-0001`,
      sequence: "0001",
      serial_no: `SR-${new Date().getFullYear()}-0001`,
      ref_no: `SR-${new Date().getFullYear()}-0001`,
      certificate_no: `SR-${new Date().getFullYear()}-0001`,
      mole_1: "{{mole_1}}",
      mole_2: "{{mole_2}}",
      conduct: "Good",
      date_of_leaving: "{{date_of_leaving}}",
      promoted: "Promoted",
      date: todayDateStr,
      current_date: todayDateStr,
      college_name: collegeDetails.name || "",
      principal_signature: "_".repeat(VARIABLE_FIXED_CHARS.principal_signature || 20),
    };

    // Blank Request Data (dynamic from request body, zero hardcoded values)
    const blankRequest = {
      request_data:
        typeof req.body.request_data === "string"
          ? req.body.request_data
          : JSON.stringify(req.body.request_data || {}),
      admission_number: "",
    };

    let filePath;
    const type = template_type || "";
    const name = service_name || "";

    // Check if dynamic
    if (type === "dynamic") {
      // Check if it's the three-section format or element-based format
      if (
        config.top_content ||
        config.middle_content ||
        config.bottom_content
      ) {
        // Process variables
        const todayDateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");
        const data = {
          current_date: todayDateStr,
          date: todayDateStr,
          sequence_no: `SR-${new Date().getFullYear()}-0001`,
          sequence: "0001",
          serial_no: `SR-${new Date().getFullYear()}-0001`,
          ref_no: `SR-${new Date().getFullYear()}-0001`,
          certificate_no: `SR-${new Date().getFullYear()}-0001`,
          ...blankStudent,
          ...JSON.parse(blankRequest.request_data),
          ...collegeDetails,
        };
        if (!data.current_date) data.current_date = todayDateStr;
        if (!data.date) data.date = todayDateStr;

        const replaceVariables = (text) => {
          if (!text) return "";
          const inputSize = Math.min(Math.max(parseInt(config.input_field_size) || 10, 4), 30);
          const defaultBlank = "_".repeat(inputSize);

          // 1. Sanitize tabs and carriage returns
          let processed = text.replace(/[\t\r]/g, " ");

          // 2. Clean inner content of alignment tags [right]...[/right], etc.
          processed = processed.replace(/\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]/gi, (match, tag, inner) => {
            return `[${tag}]${inner.trim()}[/${tag}]`;
          });

          // 4. Handle blanks: replace fill values if provided, or render fillable blank
          let blankIdx = 0;
          processed = processed.replace(/(?:___(?:\[(\d+)\])?(?:\s*___)*)+|_{2,}|[.\u2026]{2,}|[—–―-]{2,}/g, (match, customLen) => {
            blankIdx++;
            const val = data[`field_${blankIdx}`] || data[`input_field_${blankIdx}`] || data[`blank_${blankIdx}`];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              return String(val);
            }
            const len = customLen ? Math.min(Math.max(parseInt(customLen), 4), 40) : inputSize;
            return "_".repeat(len);
          });

          // 5. Handle {{variable}} syntax
          processed = processed.replace(/{{(.*?)}}/g, (match, p1) => {
            const key = p1.trim();
            if (key === "current_date" || key === "date") return todayDateStr;
            return data[key] !== undefined && data[key] !== null ? String(data[key]) : defaultBlank;
          });
          // 6. Handle @[label](variable) or @variable syntax
          processed = processed.replace(/@\[.*?\]\((.*?)\)/g, (match, p1) => {
            if (p1 === "current_date" || p1 === "date") return todayDateStr;
            return data[p1] !== undefined && data[p1] !== null ? String(data[p1]) : defaultBlank;
          });
          processed = processed.replace(/@(\w+)/g, (match, p1) => {
            if (p1 === "current_date" || p1 === "date") return todayDateStr;
            return data[p1] !== undefined && data[p1] !== null ? String(data[p1]) : defaultBlank;
          });

          return processed;
        };

        const topSource = config.top_content || collegeDetails?.metadata?.header_content || "";
        const processedContent = {
          topContent: replaceVariables(topSource),
          middleContent: replaceVariables(config.middle_content),
          bottomContent: replaceVariables(config.bottom_content),
        };

        // Merge image URLs into config for the generator (no footer)
        const enrichedConfig = {
          ...config,
          header_image_url: collegeDetails.header_image_url,
          footer_image_url: null,
          footer_height: 0,
        };

        filePath = await pdfService.generateTemplatedCertificate(
          enrichedConfig,
          processedContent,
          blankStudent,
          collegeDetails,
        );
      } else {
        filePath = await pdfService.generateDynamicCertificate(
          blankStudent,
          blankRequest,
          collegeDetails,
          config,
        );
      }
    } else if (
      type === "study_certificate" ||
      name.toLowerCase().includes("study")
    ) {
      filePath = await pdfService.generateStudyCertificate(
        blankStudent,
        blankRequest,
        collegeDetails,
      );
    } else if (
      type === "refund_application" ||
      name.toLowerCase().includes("refund")
    ) {
      filePath = await pdfService.generateRefundApplication(
        blankStudent,
        blankRequest,
        collegeDetails,
      );
    } else if (type === "custodian_certificate") {
      filePath = await pdfService.generateCustodianCertificate(
        blankStudent,
        blankRequest,
        collegeDetails,
      );
    } else if (type === "dynamic" && req.body.template_config) {
      let config = req.body.template_config;
      if (typeof config === "string") {
        try {
          config = JSON.parse(config);
        } catch (e) {
          config = {};
        }
      }
      filePath = await pdfService.generateDynamicCertificate(
        blankStudent,
        blankRequest,
        collegeDetails,
        config,
      );
    } else {
      return res.status(400).json({
        success: false,
        message: "Preview not available for this template type",
      });
    }

    res.sendFile(
      filePath,
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Preview_${type}.pdf"`,
        },
      },
      (err) => {
        if (err) console.error("Error sending file:", err);
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        }, 5000);
      },
    );
  } catch (error) {
    console.error("Error creating preview:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/services/settings
 * Super Admin Only: Fetch Service Requests Fee Head settings & dynamic options
 */
exports.getServiceSettings = async (req, res) => {
  try {
    const settings = await getServiceSettingsFromDb();
    const currentFeeHead = await getDynamicServiceFeeHead();
    const availableFeeHeads = await getAllAvailableFeeHeads();

    res.json({
      success: true,
      settings: settings || {
        feeHeadId: currentFeeHead ? String(currentFeeHead._id) : null,
        feeHeadCode: currentFeeHead?.code || '',
        feeHeadName: currentFeeHead?.name || '',
        description: currentFeeHead?.description || '',
        autoSync: true
      },
      currentFeeHead,
      availableFeeHeads
    });
  } catch (error) {
    console.error("Error fetching service settings:", error);
    res.status(500).json({ success: false, message: "Server error while fetching service settings" });
  }
};

/**
 * PUT /api/services/settings
 * Super Admin Only: Save Service Requests Fee Head configuration
 */
exports.updateServiceSettings = async (req, res) => {
  try {
    const { feeHeadId, feeHeadCode, feeHeadName, description, autoSync } = req.body;

    let resolvedHead = null;
    if (feeHeadId) {
      resolvedHead = await FeeHead.findById(feeHeadId);
    } else if (feeHeadCode) {
      resolvedHead = await FeeHead.findOne({ code: feeHeadCode });
    } else if (feeHeadName) {
      resolvedHead = await FeeHead.findOne({ name: feeHeadName });
    }

    const settingsObj = {
      feeHeadId: resolvedHead ? String(resolvedHead._id) : (feeHeadId || null),
      feeHeadCode: resolvedHead?.code || feeHeadCode || '',
      feeHeadName: resolvedHead?.name || feeHeadName || '',
      description: description !== undefined ? description : (resolvedHead?.description || ''),
      autoSync: autoSync !== undefined ? Boolean(autoSync) : true,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.id || req.user?.username || 'super_admin'
    };

    await saveServiceSettingsToDb(settingsObj);

    res.json({
      success: true,
      message: "Service requests settings saved successfully",
      settings: settingsObj,
      currentFeeHead: resolvedHead
    });
  } catch (error) {
    console.error("Error updating service settings:", error);
    res.status(500).json({ success: false, message: "Server error while saving service settings" });
  }
};

/**
 * GET /api/services/fee-heads
 * Super Admin Only: Dynamically list all available Fee Heads from the Fee Portal
 */
exports.getAvailableFeeHeads = async (req, res) => {
  try {
    const heads = await getAllAvailableFeeHeads();
    res.json({ success: true, feeHeads: heads });
  } catch (error) {
    console.error("Error fetching available fee heads:", error);
    res.status(500).json({ success: false, message: "Failed to fetch fee heads from fee portal" });
  }
};

/**
 * POST /api/services/sync-fee-status
 * Sync Fee Payment Status with Fee Portal (MongoDB)
 * Checks pending service requests against Fee Portal MongoDB transactions,
 * updates payment_status to 'paid' when verified.
 */
exports.syncFeeStatus = async (req, res) => {
  try {
    const { requestId } = req.body;
    const isStudent = req.user && (req.user.role === 'student' || (!req.user.isAdmin && !req.user.role));

    if (requestId) {
      const [targetReq] = await masterPool.execute(
        "SELECT status FROM service_requests WHERE id = ?",
        [requestId]
      );
      if (targetReq.length > 0 && targetReq[0].status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: "Cancelled requests cannot be synced with the Fee Portal."
        });
      }
    }

    let query = `
      SELECT sr.id, sr.student_id, sr.service_id, sr.sequence_no, sr.status, sr.payment_status, sr.created_at,
             s.name as service_name, s.price as service_price,
             st.admission_number, st.pin_no, st.student_name
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN students st ON sr.student_id = st.id
      WHERE sr.payment_status = 'pending' AND sr.status NOT IN ('cancelled', 'rejected')
    `;
    const params = [];

    if (isStudent) {
      query += " AND sr.student_id = ?";
      params.push(req.user.id);
    }

    if (requestId) {
      query += " AND sr.id = ?";
      params.push(requestId);
    }

    const [pendingRequests] = await masterPool.execute(query, params);

    if (pendingRequests.length === 0) {
      return res.json({
        success: true,
        message: requestId
          ? "Request is already marked as paid or not found."
          : "No pending payment requests found to sync.",
        syncedCount: 0,
        syncedRequests: [],
      });
    }

    const updated = [];

    for (const reqItem of pendingRequests) {
      // Ensure demand exists in Mongo if missing
      if (Number(reqItem.service_price) > 0) {
        await createServiceFeeDemand({
          requestId: reqItem.id,
          studentId: reqItem.student_id,
          serviceId: reqItem.service_id,
          sequence_no: reqItem.sequence_no,
        });
      }

      const check = await checkFeePaymentStatus({
        requestId: reqItem.id,
        studentAdmission: reqItem.admission_number,
        pinNo: reqItem.pin_no,
        servicePrice: reqItem.service_price,
        sequenceNo: reqItem.sequence_no,
        createdAt: reqItem.created_at,
      });

      if (check.isPaid) {
        await masterPool.execute(
          "UPDATE service_requests SET payment_status = 'paid' WHERE id = ?",
          [reqItem.id],
        );
        await appendRequestHistory(masterPool, reqItem.id, {
          action: 'PAYMENT_VERIFIED',
          title: 'Payment Verified from Fee Portal',
          details: `Fee payment verified for ₹${reqItem.service_price}. Reference: ${check.reason || 'Paid in Fee Management'}`,
          performed_by: {
            id: req.user?.id || null,
            name: req.user?.name || req.user?.username || (isStudent ? reqItem.student_name : 'Staff/Admin'),
            role: isStudent ? 'student' : (req.user?.role || 'admin'),
          },
        });
        updated.push({
          id: reqItem.id,
          sequence_no: reqItem.sequence_no,
          student_name: reqItem.student_name,
          service_name: reqItem.service_name,
          reason: check.reason,
        });
      }
    }

    res.json({
      success: true,
      message:
        updated.length > 0
          ? `Successfully synced! ${updated.length} request(s) verified as paid.`
          : "Payment check completed. No new payments verified in Fee Portal.",
      syncedCount: updated.length,
      syncedRequests: updated,
    });
  } catch (error) {
    console.error("Error syncing fee status:", error);
    res.status(500).json({ success: false, message: "Server error while syncing fee status" });
  }
};



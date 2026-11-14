const mongoose = require('mongoose');
const { masterPool } = require('../config/database');
const { getHostelConnection } = require('../config/mongoConfig');

/**
 * Helper to ensure the hostel connection is ready and return the connection
 */
async function ensureHostelConnection() {
  const hostelConn = getHostelConnection();
  if (!hostelConn) return null;
  if (hostelConn.readyState === 1 && hostelConn.db) return hostelConn;
  try {
    await hostelConn.asPromise();
    return hostelConn;
  } catch (err) {
    console.error('⚠️ [Hostel] Connection failed:', err.message);
    return null;
  }
}

/**
 * Resolve student identifiers (admission numbers and roll/pin numbers) from request
 */
async function resolveStudentIdentifiers(req) {
  const identifiers = new Set();

  if (req.query && req.query.admission_number) {
    const val = String(req.query.admission_number).trim();
    if (val) {
      identifiers.add(val);
      identifiers.add(val.toUpperCase());
    }
  }

  if (req.user && req.user.admission_number) {
    const val = String(req.user.admission_number).trim();
    if (val) {
      identifiers.add(val);
      identifiers.add(val.toUpperCase());
    }
  }

  if (req.user && req.user.roll_number) {
    const val = String(req.user.roll_number).trim();
    if (val) {
      identifiers.add(val);
      identifiers.add(val.toUpperCase());
    }
  }

  if (req.user && req.user.pin_no) {
    const val = String(req.user.pin_no).trim();
    if (val) {
      identifiers.add(val);
      identifiers.add(val.toUpperCase());
    }
  }

  if (req.user && req.user.id) {
    try {
      const [rows] = await masterPool.execute(
        'SELECT admission_number, pin_no FROM students WHERE id = ? LIMIT 1',
        [req.user.id]
      );
      if (rows && rows.length > 0) {
        if (rows[0].admission_number) {
          const adm = String(rows[0].admission_number).trim();
          identifiers.add(adm);
          identifiers.add(adm.toUpperCase());
        }
        if (rows[0].pin_no) {
          const pin = String(rows[0].pin_no).trim();
          identifiers.add(pin);
          identifiers.add(pin.toUpperCase());
        }
      }
    } catch (dbErr) {
      console.warn('⚠️ [Hostel] Could not resolve student from MySQL:', dbErr.message);
    }
  }

  const result = Array.from(identifiers).filter(Boolean);
  // Also add numeric variants for string-represented numeric admission numbers
  result.forEach(id => {
    if (/^\d+$/.test(id)) {
      result.push(Number(id));
    }
  });

  return Array.from(new Set(result));
}

/**
 * GET /api/hostel/my-details
 * Returns whether the student has an account in the hostel, plus full enriched hostel details:
 * room allocation, fee breakdown, payments, leave/outing history, complaints, attendance, and menu.
 */
exports.getMyHostelDetails = async (req, res) => {
  try {
    const identifiers = await resolveStudentIdentifiers(req);

    if (!identifiers || identifiers.length === 0) {
      return res.json({
        success: true,
        hasHostelAccount: false,
        message: 'No student identifier found'
      });
    }

    const hostelConn = await ensureHostelConnection();
    if (!hostelConn || !hostelConn.db) {
      return res.json({
        success: true,
        hasHostelAccount: false,
        message: 'Hostel database is not reachable'
      });
    }

    const db = hostelConn.db;
    const usersColl = db.collection('users');
    const hostelRequestsColl = db.collection('hostelrequests');
    const studentMastersColl = db.collection('studentmasters');

    // 1. Locate student in Hostel users collection
    const searchConditions = [
      { admissionNumber: { $in: identifiers } },
      { rollNumber: { $in: identifiers } }
    ];

    let studentUser = await usersColl.findOne({
      role: 'student',
      $or: searchConditions
    });

    // If not found in users by exact matches, try case-insensitive regex for string identifiers
    if (!studentUser) {
      const stringIds = identifiers.filter(id => typeof id === 'string' && id.length > 2);
      if (stringIds.length > 0) {
        const regexConditions = stringIds.map(id => ({
          admissionNumber: { $regex: new RegExp(`^${id}$`, 'i') }
        })).concat(stringIds.map(id => ({
          rollNumber: { $regex: new RegExp(`^${id}$`, 'i') }
        })));

        studentUser = await usersColl.findOne({
          role: 'student',
          $or: regexConditions
        });
      }
    }

    // 2. Also check hostel requests
    let hostelRequests = await hostelRequestsColl.find({
      $or: [
        { admissionNumber: { $in: identifiers } },
        { sdmsRollNumber: { $in: identifiers } },
        ...(studentUser ? [{ studentMasterId: studentUser._id }] : [])
      ]
    }).sort({ academicYear: -1, createdAt: -1 }).toArray();

    // 3. Also check student masters if user not found yet
    let studentMaster = null;
    if (!studentUser) {
      studentMaster = await studentMastersColl.findOne({
        $or: [
          { admissionNumber: { $in: identifiers } },
          { rollNumber: { $in: identifiers } }
        ]
      });

      if (studentMaster && studentMaster.userId) {
        const masterUserId = typeof studentMaster.userId === 'string'
          ? new mongoose.Types.ObjectId(studentMaster.userId)
          : studentMaster.userId;
        studentUser = await usersColl.findOne({ _id: masterUserId });
      }
    }

    // Determine if student has account in hostel
    const hasHostelAccount = Boolean(studentUser || studentMaster || (hostelRequests && hostelRequests.length > 0));

    if (!hasHostelAccount) {
      return res.json({
        success: true,
        hasHostelAccount: false,
        hasActiveAllocation: false,
        message: 'No hostel record found for this student'
      });
    }

    const userId = studentUser?._id || studentMaster?.userId;
    const latestRequest = hostelRequests && hostelRequests.length > 0 ? hostelRequests[0] : null;

    // Parallel fetch related reference collections
    const hostelId = studentUser?.hostel || latestRequest?.hostelId;
    const categoryId = studentUser?.hostelCategory || latestRequest?.hostelCategoryId;
    const roomId = studentUser?.room || latestRequest?.roomId;

    const [
      hostelDoc,
      categoryDoc,
      roomDoc,
      payments,
      leaves,
      complaints,
      attendances,
      menus,
      announcements
    ] = await Promise.all([
      hostelId ? db.collection('hostels').findOne({
        _id: typeof hostelId === 'string' ? new mongoose.Types.ObjectId(hostelId) : hostelId
      }) : null,
      categoryId ? db.collection('hostelcategories').findOne({
        _id: typeof categoryId === 'string' ? new mongoose.Types.ObjectId(categoryId) : categoryId
      }) : null,
      roomId ? db.collection('rooms').findOne({
        _id: typeof roomId === 'string' ? new mongoose.Types.ObjectId(roomId) : roomId
      }) : null,
      userId ? db.collection('payments').find({
        $or: [
          { studentId: userId },
          { studentId: userId.toString() },
          { admissionNumber: { $in: identifiers } }
        ]
      }).sort({ paymentDate: -1, createdAt: -1 }).toArray() : [],
      userId ? db.collection('leaves').find({
        $or: [
          { student: userId },
          { student: userId.toString() }
        ]
      }).sort({ createdAt: -1 }).toArray() : [],
      userId ? db.collection('complaints').find({
        $or: [
          { student: userId },
          { student: userId.toString() }
        ]
      }).sort({ createdAt: -1 }).toArray() : [],
      userId ? db.collection('attendances').find({
        $or: [
          { student: userId },
          { student: userId.toString() }
        ]
      }).sort({ date: -1 }).limit(60).toArray() : [],
      (async () => {
        // Calculate start of today in IST (UTC+5:30)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;
        const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);

        // Fetch current and upcoming menus from today onwards with populated meal items
        const upcomingMenus = await db.collection('menus').find({
          date: { $gte: startOfToday },
          $or: [
            { 'meals.breakfast.0': { $exists: true } },
            { 'meals.lunch.0': { $exists: true } },
            { 'meals.snacks.0': { $exists: true } },
            { 'meals.dinner.0': { $exists: true } }
          ]
        }).sort({ date: 1 }).limit(7).toArray();

        // Also check if there is a menu record for today specifically
        const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);
        const todayDoc = await db.collection('menus').findOne({
          date: { $gte: startOfToday, $lte: endOfToday }
        });

        const resultList = [...upcomingMenus];
        if (todayDoc && !resultList.some(m => m._id.toString() === todayDoc._id.toString())) {
          resultList.unshift(todayDoc);
        }

        return resultList;
      })(),
      db.collection('announcements').find({ isActive: true }).sort({ createdAt: -1 }).limit(10).toArray()
    ]);

    // Financial calculations
    const totalCalculatedFee = Number(studentUser?.totalCalculatedFee) || 0;
    const concession = Number(studentUser?.concession) || Number(latestRequest?.concession) || 0;
    const netFee = Math.max(0, totalCalculatedFee - concession);

    const totalPaid = payments
      .filter(p => (p.status || '').toLowerCase() === 'success')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const balanceDue = Math.max(0, netFee - totalPaid);

    // Active status evaluation
    const isActive = Boolean(
      (studentUser?.hostelStatus && studentUser.hostelStatus.toLowerCase() === 'active') ||
      (studentUser?.applicationStatus && studentUser.applicationStatus.toLowerCase() === 'active') ||
      (latestRequest?.status && latestRequest.status.toLowerCase() === 'active')
    );

    // Attendance stats
    const totalAttendanceDays = attendances.length;
    const morningPresentCount = attendances.filter(a => a.morning === true).length;
    const eveningPresentCount = attendances.filter(a => a.evening === true).length;
    const nightPresentCount = attendances.filter(a => a.night === true).length;

    // Build enriched payload
    const data = {
      hasHostelAccount: true,
      hasActiveAllocation: isActive,
      student: {
        name: studentUser?.name || latestRequest?.sdmsName || studentMaster?.name || '',
        admissionNumber: studentUser?.admissionNumber || latestRequest?.admissionNumber || studentMaster?.admissionNumber || '',
        rollNumber: studentUser?.rollNumber || latestRequest?.sdmsRollNumber || studentMaster?.rollNumber || '',
        hostelId: studentUser?.hostelId || latestRequest?.hostelSequenceId || 'N/A',
        course: studentUser?.course || latestRequest?.sdmsCourse || '',
        branch: studentUser?.branch || latestRequest?.sdmsBranch || '',
        year: studentUser?.year || latestRequest?.sdmsYearOfStudy || null,
        batch: studentUser?.batch || latestRequest?.sdmsBatch || '',
        gender: studentUser?.gender || latestRequest?.sdmsGender || '',
        studentPhoto: studentUser?.studentPhoto || studentMaster?.studentPhoto || null,
        studentPhone: studentUser?.studentPhone || studentMaster?.studentPhone || '',
        parentPhone: studentUser?.parentPhone || studentMaster?.parentPhone || '',
        motherPhone: studentUser?.motherPhone || studentMaster?.motherPhone || '',
        college: studentUser?.college || {
          name: latestRequest?.sdmsCollegeName || 'Pydah Educational Institutions',
          code: latestRequest?.collegeCode || ''
        }
      },
      allocation: {
        hostelName: hostelDoc?.name || (studentUser?.hostelId?.startsWith('BH') ? 'Boys Hostel' : 'Girls Hostel'),
        hostelCode: hostelDoc?.code || latestRequest?.hostelCode || (studentUser?.hostelId?.slice(0, 2)) || 'GH',
        categoryName: categoryDoc?.name || studentUser?.category || 'Standard',
        roomNumber: studentUser?.roomNumber || roomDoc?.roomNumber || latestRequest?.roomNumber || 'Not Assigned',
        bedNumber: studentUser?.bedNumber || latestRequest?.bedNumber || 'Not Assigned',
        lockerNumber: studentUser?.lockerNumber || latestRequest?.lockerNumber || 'Not Assigned',
        academicYear: studentUser?.academicYear || latestRequest?.academicYear || '',
        mealType: studentUser?.mealType || latestRequest?.mealType || 'veg',
        parentPermissionForOuting: studentUser?.parentPermissionForOuting ?? latestRequest?.parentPermissionForOuting ?? true,
        hostelStatus: studentUser?.hostelStatus || (isActive ? 'Active' : 'Inactive'),
        applicationStatus: studentUser?.applicationStatus || latestRequest?.status || 'Active',
        admitDate: studentUser?.admitDate || latestRequest?.admitDate || null,
        joiningDate: studentUser?.joiningDate || latestRequest?.joiningDate || null,
        isActive
      },
      fees: {
        totalCalculatedFee,
        concession,
        netFee,
        totalPaid,
        balanceDue,
        term1: {
          amount: Number(studentUser?.calculatedTerm1Fee) || 0,
          lateFee: Number(studentUser?.term1LateFee) || 0,
          lateFeeApplied: Boolean(studentUser?.lateFeeApplied?.term1)
        },
        term2: {
          amount: Number(studentUser?.calculatedTerm2Fee) || 0,
          lateFee: Number(studentUser?.term2LateFee) || 0,
          lateFeeApplied: Boolean(studentUser?.lateFeeApplied?.term2)
        },
        term3: {
          amount: Number(studentUser?.calculatedTerm3Fee) || 0,
          lateFee: Number(studentUser?.term3LateFee) || 0,
          lateFeeApplied: Boolean(studentUser?.lateFeeApplied?.term3)
        }
      },
      payments: payments.map(p => ({
        id: p._id,
        amount: Number(p.amount) || 0,
        currency: p.currency || 'INR',
        paymentMethod: p.paymentMethod || 'Online',
        paymentDate: p.paymentDate || p.createdAt,
        receiptNumber: p.receiptNumber || 'N/A',
        transactionId: p.transactionId || p.utrNumber || 'N/A',
        term: p.term || 'General',
        academicYear: p.academicYear || '',
        status: p.status || 'success',
        notes: p.notes || ''
      })),
      leaves: leaves.map(l => ({
        id: l._id,
        applicationType: l.applicationType || 'Leave',
        startDate: l.startDate,
        endDate: l.endDate,
        gatePassDateTime: l.gatePassDateTime,
        numberOfDays: l.numberOfDays || 1,
        reason: l.reason || '',
        status: l.status || 'Pending',
        verificationStatus: l.verificationStatus || 'Pending',
        parentPhone: l.parentPhone,
        createdAt: l.createdAt
      })),
      complaints: complaints.map(c => ({
        id: c._id,
        category: c.category || 'General',
        subCategory: c.subCategory || '',
        description: c.description || '',
        currentStatus: c.currentStatus || 'Open',
        priority: c.priority || 'medium',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      attendance: {
        stats: {
          totalDays: totalAttendanceDays,
          morningPresent: morningPresentCount,
          eveningPresent: eveningPresentCount,
          nightPresent: nightPresentCount
        },
        recentRecords: attendances.map(a => ({
          id: a._id,
          date: a.date || a.createdAt,
          morning: Boolean(a.morning),
          evening: Boolean(a.evening),
          night: Boolean(a.night),
          notes: a.notes || ''
        }))
      },
      requestsHistory: hostelRequests.map(r => ({
        id: r._id,
        academicYear: r.academicYear,
        status: r.status,
        hostelCode: r.hostelCode,
        roomNumber: r.roomNumber,
        bedNumber: r.bedNumber,
        lockerNumber: r.lockerNumber,
        allocatedAt: r.allocatedAt,
        joiningDate: r.joiningDate,
        admitDate: r.admitDate,
        expiredAt: r.expiredAt,
        mealType: r.mealType
      })),
      todayMenu: (() => {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;
        const found = menus.find(m => {
          if (!m.date) return false;
          const d = new Date(m.date);
          const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          return dStr === todayStr;
        });
        return found ? { id: found._id, date: found.date, meals: found.meals || {} } : null;
      })(),
      menus: menus.map(m => ({
        id: m._id,
        date: m.date,
        meals: m.meals || {}
      })),
      announcements: announcements.map(a => ({
        id: a._id,
        title: a.title,
        description: a.description,
        imageUrl: a.imageUrl,
        createdAt: a.createdAt
      }))
    };

    return res.json({
      success: true,
      hasHostelAccount: true,
      data
    });
  } catch (error) {
    console.error('❌ Error fetching student hostel details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hostel details: ' + error.message
    });
  }
};

/**
 * GET /api/hostel/menu
 * Returns weekly mess menus
 */
exports.getHostelMenu = async (req, res) => {
  try {
    const hostelConn = await ensureHostelConnection();
    if (!hostelConn || !hostelConn.db) {
      return res.json({ success: true, data: [] });
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);

    const menus = await hostelConn.db.collection('menus')
      .find({
        date: { $gte: startOfToday },
        $or: [
          { 'meals.breakfast.0': { $exists: true } },
          { 'meals.lunch.0': { $exists: true } },
          { 'meals.snacks.0': { $exists: true } },
          { 'meals.dinner.0': { $exists: true } }
        ]
      })
      .sort({ date: 1 })
      .limit(14)
      .toArray();

    return res.json({
      success: true,
      data: menus.map(m => ({
        id: m._id,
        date: m.date,
        meals: m.meals || {}
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching hostel menus:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch mess menu' });
  }
};

/**
 * GET /api/hostel/announcements
 * Returns active hostel announcements
 */
exports.getHostelAnnouncements = async (req, res) => {
  try {
    const hostelConn = await ensureHostelConnection();
    if (!hostelConn || !hostelConn.db) {
      return res.json({ success: true, data: [] });
    }

    const announcements = await hostelConn.db.collection('announcements')
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('❌ Error fetching hostel announcements:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

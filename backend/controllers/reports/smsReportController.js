const { masterPool } = require('../../config/database');
const { getScopeConditionString } = require('../../utils/scoping');
const smsService = require('../../services/smsService');

function buildSmsLogScope(req) {
  let joinClause = '';
  let whereClause = `WHERE sl.mobile_number != 'WEB'`;
  const params = [];

  if (req.userScope) {
    const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 's');
    if (scopeCondition) {
      joinClause = ' INNER JOIN students s ON sl.student_id = s.id ';
      whereClause += ` AND ${scopeCondition}`;
      params.push(...scopeParams);
    }
  }

  return { joinClause, whereClause, params };
}

/**
 * GET /students/reports/sms — SMS usage summary, category breakdown, account credits.
 */
exports.getSmsReport = async (req, res) => {
  try {
    const { date_from, date_to, category } = req.query;
    const { joinClause, whereClause, params } = buildSmsLogScope(req);

    let dateWhere = whereClause;
    const dateParams = [...params];

    if (date_from) {
      dateWhere += ' AND DATE(sl.sent_at) >= ?';
      dateParams.push(date_from);
    }
    if (date_to) {
      dateWhere += ' AND DATE(sl.sent_at) <= ?';
      dateParams.push(date_to);
    }

    let filteredWhere = dateWhere;
    const filteredParams = [...dateParams];

    if (category) {
      if (category === 'General') {
        filteredWhere += " AND (sl.category = 'General' OR sl.category = 'SMS Template' OR sl.category IS NULL)";
      } else {
        filteredWhere += ' AND sl.category = ?';
        filteredParams.push(category);
      }
    }

    const baseFrom = `FROM sms_logs sl ${joinClause}`;

    const [summaryRows] = await masterPool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN sl.status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN sl.status = 'Failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN sl.status NOT IN ('Sent', 'Delivered', 'Failed') THEN 1 ELSE 0 END) AS other
      ${baseFrom}
      ${filteredWhere}`,
      filteredParams
    );

    // Group by category based on date range (mapping SMS Template to General)
    const [byCategory] = await masterPool.query(
      `SELECT
        CASE WHEN sl.category = 'SMS Template' OR sl.category IS NULL THEN 'General' ELSE sl.category END AS category,
        COUNT(*) AS total,
        SUM(CASE WHEN sl.status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN sl.status = 'Failed' THEN 1 ELSE 0 END) AS failed
      ${baseFrom}
      ${dateWhere}
      GROUP BY CASE WHEN sl.category = 'SMS Template' OR sl.category IS NULL THEN 'General' ELSE sl.category END
      ORDER BY total DESC`,
      dateParams
    );

    // Group by template based on date range (using template_id match with pattern fallback)
    const [byTemplate] = await masterPool.query(
      `SELECT
        t.template_id,
        COUNT(sl.id) AS total,
        SUM(CASE WHEN sl.status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN sl.status = 'Failed' THEN 1 ELSE 0 END) AS failed
      FROM sms_templates t
      LEFT JOIN sms_logs sl ON (
        sl.template_id = t.template_id
        OR (sl.category = 'SMS Template' AND sl.template_id IS NULL AND sl.message LIKE CONCAT('%', SUBSTRING_INDEX(t.content, '{#var#}', 1), '%'))
      )
      ${joinClause}
      ${dateWhere}
      GROUP BY t.id, t.name, t.template_id`,
      dateParams
    );

    const templateCountMap = {};
    byTemplate.forEach((row) => {
      templateCountMap[row.template_id] = Number(row.sent || 0);
    });

    const [byDate] = await masterPool.query(
      `SELECT
        DATE(sl.sent_at) AS date,
        COUNT(*) AS total,
        SUM(CASE WHEN sl.status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN sl.status = 'Failed' THEN 1 ELSE 0 END) AS failed
      ${baseFrom}
      ${filteredWhere}
      AND sl.sent_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(sl.sent_at)
      ORDER BY date DESC`,
      filteredParams
    );

    const [categories] = await masterPool.query(
      `SELECT DISTINCT CASE WHEN sl.category = 'SMS Template' OR sl.category IS NULL THEN 'General' ELSE sl.category END AS category
      ${baseFrom}
      ${dateWhere}
      ORDER BY category`,
      dateParams
    );

    const [templates] = await masterPool.query(
      `SELECT id, name, template_id, content FROM sms_templates ORDER BY name ASC`
    );

    const templatesWithCounts = templates.map((tpl) => ({
      ...tpl,
      sent_count: templateCountMap[tpl.template_id] || 0
    }));

    const balance = await smsService.getAccountBalance();

    res.json({
      success: true,
      data: {
        summary: {
          total: Number(summaryRows[0]?.total || 0),
          sent: Number(summaryRows[0]?.sent || 0),
          failed: Number(summaryRows[0]?.failed || 0),
          other: Number(summaryRows[0]?.other || 0)
        },
        byCategory: byCategory.map((row) => ({
          category: row.category,
          total: Number(row.total),
          sent: Number(row.sent),
          failed: Number(row.failed)
        })),
        byDate: byDate.map((row) => ({
          date: row.date,
          total: Number(row.total),
          sent: Number(row.sent),
          failed: Number(row.failed)
        })),
        categories: categories.map((r) => r.category),
        templates: templatesWithCounts,
        accountBalance: balance
      }
    });
  } catch (error) {
    console.error('Failed to fetch SMS report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching SMS report'
    });
  }
};

/**
 * GET /students/reports/sms/logs — Paginated SMS log list for the reports page.
 */
exports.getSmsReportLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const { date_from, date_to, category, status, template_id, course, branch, year, semester, search } = req.query;

    const { joinClause, whereClause, params } = buildSmsLogScope(req);
    let filteredWhere = whereClause;
    const filteredParams = [...params];

    if (date_from) {
      filteredWhere += ' AND DATE(sl.sent_at) >= ?';
      filteredParams.push(date_from);
    }
    if (date_to) {
      filteredWhere += ' AND DATE(sl.sent_at) <= ?';
      filteredParams.push(date_to);
    }
    if (category) {
      if (category === 'General') {
        filteredWhere += " AND (sl.category = 'General' OR sl.category = 'SMS Template' OR sl.category IS NULL)";
      } else {
        filteredWhere += ' AND sl.category = ?';
        filteredParams.push(category);
      }
    }
    if (status) {
      filteredWhere += ' AND sl.status = ?';
      filteredParams.push(status);
    }
    if (template_id) {
      const [tplRows] = await masterPool.query('SELECT template_id, content FROM sms_templates WHERE template_id = ?', [template_id]);
      if (tplRows.length > 0) {
        const parts = tplRows[0].content.split(/\{#var#\}|\{\{.*?\}\}/);
        const snippet = (parts.find(p => p.trim().length >= 8) || parts[0] || '').trim();
        if (snippet) {
          filteredWhere += ' AND (sl.template_id = ? OR (sl.category = \'SMS Template\' AND sl.template_id IS NULL AND sl.message LIKE ?))';
          filteredParams.push(template_id, `%${snippet}%`);
        } else {
          filteredWhere += ' AND sl.template_id = ?';
          filteredParams.push(template_id);
        }
      } else {
        filteredWhere += ' AND sl.template_id = ?';
        filteredParams.push(template_id);
      }
    }
    if (course) {
      filteredWhere += ' AND s.course = ?';
      filteredParams.push(course);
    }
    if (branch) {
      filteredWhere += ' AND s.branch = ?';
      filteredParams.push(branch);
    }
    if (year) {
      filteredWhere += ' AND COALESCE(sl.current_year, s.current_year) = ?';
      filteredParams.push(year);
    }
    if (semester) {
      filteredWhere += ' AND COALESCE(sl.current_semester, s.current_semester) = ?';
      filteredParams.push(semester);
    }
    if (search) {
      filteredWhere += ' AND (sl.mobile_number LIKE ? OR s.student_name LIKE ? OR s.admission_number LIKE ? OR sl.message LIKE ? OR sl.sent_by LIKE ?)';
      filteredParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const studentJoin = joinClause || ' LEFT JOIN students s ON sl.student_id = s.id ';

    const [countRows] = await masterPool.query(
      `SELECT COUNT(*) AS total FROM sms_logs sl ${studentJoin} ${filteredWhere}`,
      filteredParams
    );
    const total = Number(countRows[0]?.total || 0);

    const [logs] = await masterPool.query(
      `SELECT
        sl.id,
        sl.student_id,
        sl.mobile_number,
        sl.message,
        sl.category,
        sl.template_id,
        sl.status,
        sl.message_id,
        sl.sent_at,
        sl.error_details,
        sl.sent_by,
        COALESCE(NULLIF(TRIM(sl.sent_by), ''), 'System Generated') AS raised_by,
        s.admission_number,
        s.student_name,
        s.college,
        s.course,
        s.branch,
        COALESCE(sl.current_year, s.current_year) AS current_year,
        COALESCE(sl.current_semester, s.current_semester) AS current_semester
      FROM sms_logs sl
      ${studentJoin}
      ${filteredWhere}
      ORDER BY sl.sent_at DESC
      LIMIT ? OFFSET ?`,
      [...filteredParams, limit, offset]
    );

    // Enrich any missing student data by mobile number (e.g. parent OTP or unlinked logs)
    const missingMobiles = [
      ...new Set(
        logs
          .filter((l) => !l.student_name && l.mobile_number && l.mobile_number.length >= 10)
          .map((l) => l.mobile_number)
      )
    ];
    if (missingMobiles.length > 0) {
      try {
        const [matchedStudents] = await masterPool.query(
          `SELECT id, admission_number, student_name, college, course, branch, current_year, current_semester, student_mobile, parent_mobile1, parent_mobile2
           FROM students
           WHERE student_mobile IN (?) OR parent_mobile1 IN (?) OR parent_mobile2 IN (?)`,
          [missingMobiles, missingMobiles, missingMobiles]
        );
        const studentMap = {};
        matchedStudents.forEach((s) => {
          if (s.student_mobile) studentMap[s.student_mobile] = s;
          if (s.parent_mobile1) studentMap[s.parent_mobile1] = s;
          if (s.parent_mobile2) studentMap[s.parent_mobile2] = s;
        });

        logs.forEach((log) => {
          if (!log.student_name && studentMap[log.mobile_number]) {
            const matched = studentMap[log.mobile_number];
            log.student_id = log.student_id || matched.id;
            log.admission_number = matched.admission_number;
            log.student_name = matched.student_name;
            log.college = matched.college;
            log.course = matched.course;
            log.branch = matched.branch;
            log.current_year = log.current_year || matched.current_year;
            log.current_semester = log.current_semester || matched.current_semester;
          }
        });
      } catch (enrichErr) {
        console.warn('Non-fatal error enriching SMS logs by mobile:', enrichErr.message);
      }
    }

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0
      }
    });
  } catch (error) {
    console.error('Failed to fetch SMS report logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching SMS logs'
    });
  }
};

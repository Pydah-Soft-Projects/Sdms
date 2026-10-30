const { masterPool } = require("../config/database");
const path = require("path");
const fs = require("fs");

// Get all available system variables
exports.getAvailableVariables = async (req, res) => {
  try {
    const systemVariables = [
      // Student Details
      {
        name: "student_name",
        label: "Student Name",
        category: "Student Details",
        example: "JOHN DOE",
      },
      {
        name: "admission_number",
        label: "Admission Number",
        category: "Student Details",
        example: "2024001",
      },
      {
        name: "pin_no",
        label: "PIN Number",
        category: "Student Details",
        example: "PIN123",
      },
      {
        name: "father_name",
        label: "Father Name",
        category: "Student Details",
        example: "ROBERT DOE",
      },
      {
        name: "mother_name",
        label: "Mother Name",
        category: "Student Details",
        example: "MARY DOE",
      },
      {
        name: "guardian_name",
        label: "Guardian Name",
        category: "Student Details",
        example: "GUARDIAN NAME",
      },
      {
        name: "dob",
        label: "Date of Birth",
        category: "Student Details",
        example: "01/01/2000",
      },
      {
        name: "gender",
        label: "Gender",
        category: "Student Details",
        example: "Male",
      },
      {
        name: "email",
        label: "Email",
        category: "Student Details",
        example: "student@example.com",
      },
      {
        name: "phone_number",
        label: "Phone Number",
        category: "Student Details",
        example: "9876543210",
      },
      {
        name: "student_mobile",
        label: "Student Mobile",
        category: "Student Details",
        example: "9876543210",
      },
      {
        name: "caste",
        label: "Caste",
        category: "Student Details",
        example: "OC",
      },
      {
        name: "religion",
        label: "Religion",
        category: "Student Details",
        example: "Hindu",
      },
      {
        name: "student_address",
        label: "Address",
        category: "Student Details",
        example: "Street, City, State",
      },

      // Academic Details
      {
        name: "course",
        label: "Course",
        category: "Academic",
        example: "B.Tech",
      },
      {
        name: "branch",
        label: "Branch",
        category: "Academic",
        example: "Computer Science",
      },
      {
        name: "current_year",
        label: "Current Year",
        category: "Academic",
        example: "3",
      },
      {
        name: "current_semester",
        label: "Current Semester",
        category: "Academic",
        example: "5",
      },
      {
        name: "academic_year",
        label: "Academic Year",
        category: "Academic",
        example: "2024-2025",
      },
      {
        name: "admission_date",
        label: "Admission Date",
        category: "Academic",
        example: "01/08/2021",
      },

      // College Details
      {
        name: "college_name",
        label: "College Name",
        category: "College",
        example: "Pydah College of Engineering",
      },
      {
        name: "college_address",
        label: "College Address",
        category: "College",
        example: "Kakinada, AP",
      },
      {
        name: "college_phone",
        label: "College Phone",
        category: "College",
        example: "0884-2315333",
      },
      {
        name: "college_email",
        label: "College Email",
        category: "College",
        example: "info@pydah.edu.in",
      },

      // Signature Variables
      {
        name: "principal_signature",
        label: "Principal Signature",
        category: "Signatures",
        example: "Principal Signature",
      },

      // Date Variables
      {
        name: "date",
        label: "Current Date",
        category: "Date",
        example: "03/01/2026",
      },
      {
        name: "current_date",
        label: "Current Date",
        category: "Date",
        example: "03/01/2026",
      },
    ];

    res.json({
      success: true,
      data: {
        systemVariables,
        usage:
          "Use @ symbol followed by variable name (e.g., @student_name). For admin-fillable fields, use @blank_fieldname",
      },
    });
  } catch (error) {
    console.error("Error fetching variables:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all templates with optional filters
exports.getTemplates = async (req, res) => {
  try {
    const { service_id, college_id } = req.query;

    let query = `
            SELECT ct.*, s.name as service_name, c.name as college_name
            FROM certificate_templates ct
            LEFT JOIN services s ON ct.service_id = s.id
            LEFT JOIN colleges c ON ct.college_id = c.id
            WHERE ct.is_active = TRUE
        `;
    const params = [];

    if (service_id) {
      query += " AND ct.service_id = ?";
      params.push(service_id);
    }

    if (college_id) {
      query += " AND (ct.college_id = ? OR ct.college_id IS NULL)";
      params.push(college_id);
    }

    query += " ORDER BY ct.college_id DESC, ct.created_at DESC";

    const [rows] = await masterPool.execute(query, params);

    // Parse JSON fields
    rows.forEach((row) => {
      if (row.blank_variables && typeof row.blank_variables === "string") {
        try {
          row.blank_variables = JSON.parse(row.blank_variables);
        } catch (e) {
          row.blank_variables = [];
        }
      }
    });

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single template by ID
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await masterPool.execute(
      `SELECT ct.*, s.name as service_name, c.name as college_name
             FROM certificate_templates ct
             LEFT JOIN services s ON ct.service_id = s.id
             LEFT JOIN colleges c ON ct.college_id = c.id
             WHERE ct.id = ?`,
      [id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    const template = rows[0];
    if (
      template.blank_variables &&
      typeof template.blank_variables === "string"
    ) {
      try {
        template.blank_variables = JSON.parse(template.blank_variables);
      } catch (e) {
        template.blank_variables = [];
      }
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create new template
exports.createTemplate = async (req, res) => {
  try {
    const {
      service_id,
      college_id,
      top_content,
      middle_content,
      bottom_content,
      top_alignment,
      middle_alignment,
      bottom_alignment,
      padding_left,
      padding_right,
      padding_top,
      padding_bottom,
      top_section_padding,
      middle_section_padding,
      bottom_section_padding,
      blank_variables,
      font_size,
      line_spacing,
      header_height,
      footer_height,
      page_size,
      page_orientation,
      top_spacing,
      middle_spacing,
      bottom_spacing,
    } = req.body;

    // Validation
    if (!service_id || !middle_content) {
      return res.status(400).json({
        success: false,
        message: "Service ID and Middle Content are required",
      });
    }

    const [result] = await masterPool.execute(
      `INSERT INTO certificate_templates (
                service_id, college_id, top_content, middle_content, bottom_content,
                top_alignment, middle_alignment, bottom_alignment,
                padding_left, padding_right, padding_top, padding_bottom,
                top_section_padding, middle_section_padding, bottom_section_padding,
                blank_variables, font_size, line_spacing, header_height, footer_height,
                page_size, page_orientation,
                top_spacing, middle_spacing, bottom_spacing
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        service_id,
        college_id || null,
        top_content || null,
        middle_content,
        bottom_content || null,
        top_alignment || "center",
        middle_alignment || "center",
        bottom_alignment || "center",
        padding_left || 40,
        padding_right || 40,
        padding_top || 40,
        padding_bottom || 40,
        top_section_padding || 10,
        middle_section_padding || 20,
        bottom_section_padding || 10,
        blank_variables ? JSON.stringify(blank_variables) : null,
        font_size || 12,
        line_spacing || 1.5,
        header_height || 80,
        footer_height || 60,
        page_size || "A4",
        page_orientation || "portrait",
        top_spacing || 15,
        middle_spacing || 15,
        bottom_spacing || 15,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      templateId: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message:
          "Template already exists for this service and college combination",
      });
    }
    console.error("Error creating template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      top_content,
      middle_content,
      bottom_content,
      top_alignment,
      middle_alignment,
      bottom_alignment,
      padding_left,
      padding_right,
      padding_top,
      padding_bottom,
      top_section_padding,
      middle_section_padding,
      bottom_section_padding,
      blank_variables,
      font_size,
      line_spacing,
      header_height,
      footer_height,
      page_size,
      page_orientation,
      is_active,
      top_spacing,
      middle_spacing,
      bottom_spacing,
    } = req.body;

    const [result] = await masterPool.execute(
      `UPDATE certificate_templates SET
                top_content = ?,
                middle_content = ?,
                bottom_content = ?,
                top_alignment = ?,
                middle_alignment = ?,
                bottom_alignment = ?,
                padding_left = ?,
                padding_right = ?,
                padding_top = ?,
                padding_bottom = ?,
                top_section_padding = ?,
                middle_section_padding = ?,
                bottom_section_padding = ?,
                blank_variables = ?,
                font_size = ?,
                line_spacing = ?,
                header_height = ?,
                footer_height = ?,
                page_size = ?,
                page_orientation = ?,
                top_spacing = ?,
                middle_spacing = ?,
                bottom_spacing = ?,
                updated_at = NOW()
            WHERE id = ?`,
      [
        top_content || null,
        middle_content,
        bottom_content || null,
        top_alignment || "center",
        middle_alignment || "center",
        bottom_alignment || "center",
        padding_left || 40,
        padding_right || 40,
        padding_top || 40,
        padding_bottom || 40,
        top_section_padding || 10,
        middle_section_padding || 20,
        bottom_section_padding || 10,
        blank_variables ? JSON.stringify(blank_variables) : null,
        font_size || 12,
        line_spacing || 1.5,
        header_height || 80,
        footer_height || 60,
        page_size || "A4",
        page_orientation || "portrait",
        top_spacing || 15,
        middle_spacing || 15,
        bottom_spacing || 15,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    res.json({ success: true, message: "Template updated successfully" });
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await masterPool.execute(
      "DELETE FROM certificate_templates WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    res.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Upload header image
exports.uploadHeaderImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const imageUrl = `/uploads/certificate-images/${req.file.filename}`;

    // Update template with header image URL
    const [result] = await masterPool.execute(
      "UPDATE certificate_templates SET header_image_url = ? WHERE id = ?",
      [imageUrl, id],
    );

    if (result.affectedRows === 0) {
      // Delete uploaded file if template not found
      fs.unlinkSync(req.file.path);
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    res.json({
      success: true,
      message: "Header image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    console.error("Error uploading header image:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Upload footer image
exports.uploadFooterImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const imageUrl = `/uploads/certificate-images/${req.file.filename}`;

    // Update template with footer image URL
    const [result] = await masterPool.execute(
      "UPDATE certificate_templates SET footer_image_url = ? WHERE id = ?",
      [imageUrl, id],
    );

    if (result.affectedRows === 0) {
      // Delete uploaded file if template not found
      fs.unlinkSync(req.file.path);
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    res.json({
      success: true,
      message: "Footer image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    console.error("Error uploading footer image:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

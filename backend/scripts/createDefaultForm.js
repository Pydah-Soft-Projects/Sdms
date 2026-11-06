const { masterPool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const createDefaultForm = async () => {
  try {
    const [tables] = await masterPool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'forms'
       LIMIT 1`
    );

    if (tables.length === 0) {
      console.warn(
        'Skipping default student form creation: the forms table does not exist in the configured database. Initialize the student database schema to enable registration forms.'
      );
      return;
    }

    // Check if the default student form already exists
    const [forms] = await masterPool.query(
      'SELECT form_id FROM forms WHERE form_name = ? LIMIT 1',
      ['Default Student Registration Form']
    );
    
    if (forms && forms.length > 0) {
      console.log('Default student form already exists. Skipping creation.');
      return;
    }

    console.log('Creating default student form...');

    const formId = uuidv4();
    const formName = 'Default Student Registration Form';
    const formDescription = 'This is a default form for student registration, created automatically on deployment.';
    const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${formId}`;
    const qrCodeData = await QRCode.toDataURL(formUrl);

    // Define the fields for the default form
    const defaultFormFields = [
        { key: 'pin_no', label: 'Pin No', type: 'text', required: false, isEnabled: true },
        { key: 'batch', label: 'Batch', type: 'text', required: false, isEnabled: true },
        { key: 'branch', label: 'Branch', type: 'text', required: false, isEnabled: true },
        { key: 'stud_type', label: 'StudType', type: 'text', required: false, isEnabled: true },
        { key: 'student_name', label: 'Student Name', type: 'text', required: true, isEnabled: true },
        { key: 'student_status', label: 'Student Status', type: 'text', required: false, isEnabled: true },
        { key: 'scholar_status', label: 'Scholar Status', type: 'text', required: false, isEnabled: true },
        { key: 'student_mobile', label: 'Student Mobile Number', type: 'tel', required: false, isEnabled: true },
        { key: 'parent_mobile1', label: 'Parent Mobile Number 1', type: 'tel', required: false, isEnabled: true },
        { key: 'parent_mobile2', label: 'Parent Mobile Number 2', type: 'tel', required: false, isEnabled: true },
        { key: 'caste', label: 'Caste', type: 'text', required: false, isEnabled: true },
        { key: 'gender', label: 'M/F', type: 'select', options: ['M', 'F', 'Other'], required: false, isEnabled: true },
        { key: 'father_name', label: 'Father Name', type: 'text', required: false, isEnabled: true },
        { key: 'dob', label: 'DOB (Date-Month-Year)', type: 'date', required: false, isEnabled: true },
        { key: 'adhar_no', label: 'AADHAR No', type: 'text', required: false, isEnabled: true },
        { key: 'admission_date', label: 'Admission Year (Ex: 09-Sep-2003)', type: 'text', required: false, isEnabled: true },
        { key: 'admission_no', label: 'Admission No', type: 'text', required: false, isEnabled: true },
        { key: 'student_address', label: 'Student Address', type: 'textarea', required: false, isEnabled: true },
        { key: 'city_village', label: 'CityVillage Name', type: 'text', required: false, isEnabled: true },
        { key: 'mandal_name', label: 'Mandal Name', type: 'text', required: false, isEnabled: true },
        { key: 'district', label: 'District Name', type: 'text', required: false, isEnabled: true },
        { key: 'previous_college', label: 'Previous College Name', type: 'text', required: false, isEnabled: true },
        { key: 'certificates_status', label: 'Certificate Status', type: 'text', required: false, isEnabled: true },
        { key: 'student_photo', label: 'Student Photo', type: 'text', required: false, isEnabled: false }, // Hidden by default
        { key: 'remarks', label: 'Remarks', type: 'textarea', required: false, isEnabled: true },
    ];

    // Get first admin ID or use null
    const [admins] = await masterPool.query('SELECT id FROM admins LIMIT 1');
    const adminId = admins && admins.length > 0 ? admins[0].id : null;

    await masterPool.query(
      `INSERT INTO forms (form_id, form_name, form_description, form_fields, qr_code_data, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [formId, formName, formDescription, JSON.stringify(defaultFormFields), qrCodeData, adminId, true]
    );

    console.log('✅ Default student form created successfully with ID:', formId);
    console.log('📱 QR Code URL:', formUrl);

  } catch (error) {
    console.error('Error creating default form:', error);
    throw error;
  }
};

module.exports = { createDefaultForm };

const { masterPool } = require('../config/database');

const createClubRolesTable = async () => {
  try {
    console.log('Setting up Student Club Roles table and schema modifications...');

    // 1. Create club_roles table
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS club_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL,
        role_code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        pages JSON DEFAULT NULL,
        can_create_users BOOLEAN NOT NULL DEFAULT FALSE,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ club_roles table created/verified.');

    const [rolePageCols] = await masterPool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'club_roles'
        AND COLUMN_NAME = 'pages';
    `);
    if (rolePageCols.length === 0) {
      await masterPool.query('ALTER TABLE club_roles ADD COLUMN pages JSON DEFAULT NULL');
      console.log('✓ Added pages column to club_roles table.');
    } else {
      console.log('✓ club_roles.pages column already exists.');
    }

    const [userCreationAccessCols] = await masterPool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'club_roles'
        AND COLUMN_NAME = 'can_create_users';
    `);
    if (userCreationAccessCols.length === 0) {
      await masterPool.query(
        'ALTER TABLE club_roles ADD COLUMN can_create_users BOOLEAN NOT NULL DEFAULT FALSE'
      );
      console.log('✓ Added can_create_users column to club_roles table.');
    } else {
      console.log('✓ club_roles.can_create_users column already exists.');
    }

    // 2. Add admin_roles column to clubs table if missing
    const [cols] = await masterPool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'clubs' 
        AND COLUMN_NAME = 'admin_roles';
    `);

    if (cols.length === 0) {
      await masterPool.query(`
        ALTER TABLE clubs ADD COLUMN admin_roles JSON DEFAULT NULL;
      `);
      console.log('✓ Added admin_roles column to clubs table.');
    } else {
      console.log('✓ admin_roles column already exists in clubs table.');
    }

    // 3. Seed default dynamic roles if empty
    const [roles] = await masterPool.query('SELECT COUNT(*) as count FROM club_roles');
    if (roles[0].count === 0) {
      const defaultRoles = [
        ['Club Coordinator', 'club_coordinator', 'Coordinates club operations, members, and activities', true, true],
        ['President', 'president', 'Club President - Head of operations and club activities', true, false],
        ['Vice President', 'vice_president', 'Assists President in managing club operations', true, false],
        ['Secretary', 'secretary', 'Maintains club records, schedules, and correspondence', true, false],
        ['Treasurer', 'treasurer', 'Manages club finances and budget tracking', true, false],
        ['Faculty Coordinator', 'faculty_coordinator', 'Faculty advisor overseeing club activities', true, false],
        ['Event Lead', 'event_lead', 'Organizes and coordinates club events & activities', true, false],
        ['Club Member', 'club_member', 'Standard registered club member', true, false]
      ];

      for (const [role_name, role_code, description, is_system, can_create_users] of defaultRoles) {
        await masterPool.query(
          'INSERT INTO club_roles (role_name, role_code, description, can_create_users, is_system) VALUES (?, ?, ?, ?, ?)',
          [role_name, role_code, description, can_create_users, is_system]
        );
      }
      console.log('✓ Default dynamic club roles seeded successfully.');
    } else {
      console.log('✓ Dynamic club roles already present.');
    }

    const [clubCoordinatorRole] = await masterPool.query(
      'SELECT id FROM club_roles WHERE role_code = ? LIMIT 1',
      ['club_coordinator']
    );
    if (clubCoordinatorRole.length === 0) {
      await masterPool.query(
        'INSERT INTO club_roles (role_name, role_code, description, can_create_users, is_system) VALUES (?, ?, ?, TRUE, ?)',
        ['Club Coordinator', 'club_coordinator', 'Coordinates club operations, members, and activities', true]
      );
      console.log('✓ Club Coordinator role added.');
    } else {
      console.log('✓ Club Coordinator role already present.');
    }

    console.log('✓ Student Club schema initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize club roles schema:', error);
    process.exit(1);
  }
};

createClubRolesTable();

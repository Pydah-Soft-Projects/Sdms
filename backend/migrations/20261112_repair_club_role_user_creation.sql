ALTER TABLE club_roles ADD COLUMN can_create_users BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE club_roles
SET can_create_users = TRUE
WHERE role_code = 'club_coordinator';

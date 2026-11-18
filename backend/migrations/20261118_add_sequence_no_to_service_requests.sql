-- Add sequence_no column to service_requests table
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS sequence_no VARCHAR(100) NULL AFTER service_id;
CREATE INDEX IF NOT EXISTS idx_sr_sequence_no ON service_requests (sequence_no);

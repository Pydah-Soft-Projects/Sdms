ALTER TABLE sms_logs
  ADD COLUMN notification_data JSON NULL AFTER message_id;

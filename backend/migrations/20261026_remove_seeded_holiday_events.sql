DELETE FROM events
WHERE event_type = 'holiday'
  AND created_by = 1
  AND description IS NULL
  AND is_active = 1
  AND (
    (title = 'New Year''s Day' AND DATE(event_date) = '2025-01-01')
    OR (title = 'Republic Day' AND DATE(event_date) = '2025-01-26')
    OR (title = 'Holi' AND DATE(event_date) = '2025-03-25')
    OR (title = 'Good Friday' AND DATE(event_date) = '2025-03-29')
    OR (title = 'Eid al-Fitr' AND DATE(event_date) = '2025-04-11')
    OR (title = 'Independence Day' AND DATE(event_date) = '2025-08-15')
    OR (title = 'Gandhi Jayanti' AND DATE(event_date) = '2025-10-02')
    OR (title = 'Dussehra' AND DATE(event_date) = '2025-10-12')
    OR (title = 'Diwali' AND DATE(event_date) = '2025-11-01')
    OR (title = 'Christmas Day' AND DATE(event_date) = '2025-12-25')
  );

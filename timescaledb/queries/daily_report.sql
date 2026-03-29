CREATE VIEW daily_report AS
SELECT topic, ts, latest
FROM mqtt_summary, mqtt_points
WHERE ts > now() - interval '1 day';
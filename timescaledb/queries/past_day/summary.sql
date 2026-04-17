SELECT jsonb_pretty(to_jsonb(rollups))
FROM mqtt_summary
WHERE ts >= date_trunc('day', now() - interval '1 day')
ORDER BY ts DESC
LIMIT 1;
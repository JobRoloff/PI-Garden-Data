SELECT * 
FROM mqtt_points 
WHERE ts >= NOW() - INTERVAL '1 DAY' 
LIMIT 1;
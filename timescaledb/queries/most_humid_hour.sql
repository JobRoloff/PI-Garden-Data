-- Note: if you gotta change time interval, change dat_trunc in the cte. if you need some unique time like a 6 hr range, TimescaleDB got something called time_bucket
WITH humidity_samples AS (
  SELECT
    to_timestamp((p.point ->> 'timestamp')::double precision) AS sample_ts,
    date_trunc('hour', to_timestamp((p.point ->> 'timestamp')::double precision)) AS hour_bucket,
    (p.point -> 'series' ->> 'humidity')::double precision AS humidity
  FROM mqtt_points mp
  CROSS JOIN LATERAL jsonb_array_elements(mp.points) AS p(point)
  WHERE mp.ts >= NOW() - INTERVAL '24 HOURS'
    AND p.point ->> 'kind' = 'sensor_reading'
    AND p.point -> 'series' ? 'humidity'
)
SELECT
  hour_bucket,
  AVG(humidity) AS avg_humidity,
  MAX(humidity) AS max_humidity,
  COUNT(*) AS sample_count
FROM humidity_samples
GROUP BY hour_bucket
ORDER BY avg_humidity DESC
LIMIT 1;
# PI Garden Dashboard

Next.js dashboard for MQTT data stored in TimescaleDB (`mqtt_summary`, `mqtt_points`). Optimized for 5th gen iPad with light/dark Material Design 3 themes.

## Run locally

1. Copy env and set `DATABASE_URL` (use `127.0.0.1` when DB is on host or port-forwarded):

   ```bash
   cp .env.local.example .env.local
   ```

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000). On iPad, use your machine’s LAN IP (e.g. `http://192.168.1.x:3000`).

## Theme

The UI uses the Material Design 3 tokens in `css/light.css` and `css/dark.css`. Toggle light/dark via the header button; preference is stored in `localStorage` and respected on load.

## Data

- **mqtt_summary**: one row per flush (ts, topic, report_ts, interval fields, sample_count, dt_sec, latest/rollups/control JSONB).
- **mqtt_points**: one row per flush with a `points` JSONB array of sensor readings and actuator events.

Schema: `timescaledb/init/001_create_mqtt_messages.sql`.

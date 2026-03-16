import { useMemo } from 'react';
import { useGardenStreamContext } from '../GardenStreamProvider';

const MESSAGES_PER_HOUR = 12;
const NUM_HOURS = 24;
const CHART_POINTS = MESSAGES_PER_HOUR * NUM_HOURS;


/** Dashboard summary (from mqtt_summary / event_feed). */
export interface Summary {
  ts: string;
  topic?: string;
  report_ts?: number;
  latest: {
    temperature?: number;
    humidity?: number;
    soil_moisture?: number;
    light_level?: number;
    water_level?: number;
  };
  rollups?: {
    avg_temperature?: number;
    avg_humidity?: number;
    avg_soil_moisture?: number;
  };
  control?: {
    humidifier_status?: boolean;
    fan_status?: boolean;
  };
  sample_count?: number;
  dt_sec?: number;
}

export interface ChartPoint {
  /** Display time e.g. "15:39:04" (for tooltip) */
  timestamp: string;
  /** Epoch ms for x-axis scale so the line spreads across the chart */
  time: number;
  value: number;
}

/** Light spectrum chart point with per-channel values from AS7341Module. */
export interface LightChartPoint {
  timestamp: string;
  time: number;
  clear?: number;
  near_ir?: number;
  red_680?: number;
  blue_480?: number;
  cyan_515?: number;
  green_555?: number;
  indigo_445?: number;
  orange_630?: number;
  violet_451?: number;
  yellow_590?: number;
}

/** Raw summary event from event_feed (has `latest` and optional rollups/control). */
interface SummaryEvent {
  ts?: string;
  topic?: string;
  report_ts?: number;
  latest?: Summary['latest'];
  rollups?: Summary['rollups'];
  control?: Record<string, boolean>;
  sample_count?: number;
  dt_sec?: number;
}


/** Format for chart x-axis: include seconds so each point has a unique label (avoids collapsing multiple readings into one). */
function _formatChartTime(ts: string | number | undefined): string {
  if (ts == null) return '--:--';
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function _getEventTimestamp(event: SummaryEvent): number {
  const rt = event.report_ts;
  if (typeof rt === 'number' && Number.isFinite(rt)) return rt;
  if (typeof rt === 'string') {
    const n = Number(rt);
    if (Number.isFinite(n)) return n;
  }
  if (event.ts) return new Date(event.ts).getTime() / 1000;
  return 0;
}

function _isSummaryEvent(event: unknown): event is Record<string, unknown> & { latest: unknown } {
  return (
    event != null &&
    typeof event === 'object' &&
    'latest' in event &&
    (event as Record<string, unknown>).latest != null
  );
}

function _getSummaryEvents(eventFeed: Array<Record<string, unknown>>): SummaryEvent[] {
  return eventFeed.filter(_isSummaryEvent) as SummaryEvent[];
}

function _normalizeControl(raw: Record<string, boolean> | undefined): Summary['control'] {
  if (!raw || Object.keys(raw).length === 0) return undefined;
  return {
    humidifier_status: raw.humidifier_status ?? raw.valve_status,
    fan_status: raw.fan_status ?? raw.pump_status,
  };
}

function _buildSummary(
  latestEvent: SummaryEvent | undefined,
  firstTopic: string | undefined,
  latestFromTopics: Summary['latest'] | undefined,
  control: Summary['control']
): Summary {
  if (latestEvent) {
    return {
      ts: String(latestEvent.ts ?? ''),
      topic: latestEvent.topic != null ? String(latestEvent.topic) : undefined,
      report_ts: latestEvent.report_ts,
      latest: (latestEvent.latest ?? latestFromTopics ?? {}) as Summary['latest'],
      rollups: latestEvent.rollups,
      control,
      sample_count: latestEvent.sample_count,
      dt_sec: latestEvent.dt_sec,
    };
  }
  return {
    ts: new Date().toISOString(),
    topic: firstTopic,
    latest: (latestFromTopics ?? {}) as Summary['latest'],
  };
}

/** Ensure latest is an object (parse JSON string if needed). */
function _normalizeLatest(latest: unknown): Record<string, unknown> {
  if (latest != null && typeof latest === 'object' && !Array.isArray(latest)) {
    return latest as Record<string, unknown>;
  }
  if (typeof latest === 'string') {
    try {
      const parsed = JSON.parse(latest) as unknown;
      if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }
  return {};
}

/** Get numeric value from latest; accepts both 'temperature' and 'temp', etc. */
function _getLatestNumber(latest: Summary['latest'], keys: string[]): number | undefined {
  const raw = _normalizeLatest(latest) as Record<string, unknown>;
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

function _eventTimeMs(event: SummaryEvent): number {
  const sec = _getEventTimestamp(event);
  if (sec > 0) return sec * 1000;
  if (event.ts) return new Date(event.ts).getTime();
  return 0;
}

function _extractChartSeries(
  events: SummaryEvent[],
  getValue: (latest: Summary['latest']) => number | undefined
): ChartPoint[] {
  return events
    .map((event) => {
      const value = getValue(event.latest ?? {});
      if (value == null || typeof value !== 'number') return null;
      const timeMs = _eventTimeMs(event);
      const timestamp =
        event.ts != null && String(event.ts).length > 0
          ? _formatChartTime(event.ts)
          : _formatChartTime(_getEventTimestamp(event));
      return {
        timestamp,
        time: timeMs,
        value: Math.round(value * 10) / 10,
      };
    })
    .filter((p): p is ChartPoint => p != null);
}

function _extractScalarFromSensorEvents(
  events: Array<Record<string, unknown>>,
  seriesKey: string
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    if (obj.kind !== 'sensor_reading') continue;
    const sensorType = obj.sensor_type;
    const sensorId = obj.sensor_id;
    if (sensorType !== 'DHT22' && sensorId !== 'DHT22') continue;

    const series = obj.series;
    if (!series || typeof series !== 'object') continue;
    const seriesObj = series as Record<string, unknown>;
    const v = seriesObj[seriesKey];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;

    const tsValue = obj.timestamp;
    let tsSec: number | undefined;
    if (typeof tsValue === 'number' && Number.isFinite(tsValue)) {
      tsSec = tsValue;
    } else if (typeof tsValue === 'string') {
      const n = Number(tsValue);
      if (Number.isFinite(n)) tsSec = n;
    }
    if (tsSec == null) continue;

    const timeMs = tsSec * 1000;
    points.push({
      timestamp: _formatChartTime(tsSec),
      time: timeMs,
      value: Math.round(v * 10) / 10,
    });
  }
  return points.sort((a, b) => a.time - b.time);
}

const LIGHT_CHANNEL_KEYS = [
  'clear',
  'near_ir',
  'red_680',
  'blue_480',
  'cyan_515',
  'green_555',
  'indigo_445',
  'orange_630',
  'violet_451',
  'yellow_590',
] as const;

type LightChannelKey = (typeof LIGHT_CHANNEL_KEYS)[number];

function _extractLightChartFromEventFeed(
  eventFeed: Array<Record<string, unknown>>
): LightChartPoint[] {
  const points: LightChartPoint[] = [];
  for (const raw of eventFeed) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const kind = obj.kind;
    if (kind !== 'sensor_reading') continue;
    const sensorType = obj.sensor_type;
    const sensorId = obj.sensor_id;
    if (sensorType !== 'AS7341Module' && sensorId !== 'light') continue;

    const series = obj.series;
    if (!series || typeof series !== 'object') continue;

    const tsValue = obj.timestamp;
    let tsSec: number | undefined;
    if (typeof tsValue === 'number' && Number.isFinite(tsValue)) {
      tsSec = tsValue;
    } else if (typeof tsValue === 'string') {
      const n = Number(tsValue);
      if (Number.isFinite(n)) tsSec = n;
    }
    if (tsSec == null) continue;

    const timeMs = tsSec * 1000;
    const point: LightChartPoint = {
      timestamp: _formatChartTime(tsSec),
      time: timeMs,
    };

    const seriesObj = series as Record<string, unknown>;
    for (const key of LIGHT_CHANNEL_KEYS) {
      const v = seriesObj[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        point[key as LightChannelKey] = v;
      }
    }

    points.push(point);
  }

  return points.sort((a, b) => a.time - b.time);
}

/**
 * Derives dashboard summary, chart series, and zones from the garden WebSocket stream.
 */
export function useGardenData() {
  const stream = useGardenStreamContext();

  const {
    summary,
    temperaturePoints,
    humidityPoints,
    lightSpectrumPoints,
  } = useMemo(() => {
    const summaryEvents = _getSummaryEvents(stream.eventFeed);
    const latestEvent = summaryEvents[0];
    const topics = Object.keys(stream.sensorReadings);
    const firstTopic = topics[0];
    const latestFromTopics = firstTopic
      ? (stream.sensorReadings[firstTopic] as Summary['latest'] | undefined)
      : undefined;

    const control = _normalizeControl(latestEvent?.control as Record<string, boolean> | undefined);

    const summary = _buildSummary(latestEvent, firstTopic, latestFromTopics, control);

    if (summary.latest && Object.keys(summary.latest).length === 0 && latestFromTopics) {
      summary.latest = latestFromTopics;
    }

    // Prefer 24h chart data from backend; fall back to event feed.
    // Normalize so each row has latest as object and report_ts as number (handles JSON/API quirks).
    const rawChart = stream.chart24h ?? [];
    const normalizedChart = rawChart.map((row: Record<string, unknown>) => {
      const latest = _normalizeLatest(row.latest);
      const report_ts = row.report_ts;
      let reportTsNum: number | undefined;
      if (typeof report_ts === 'number' && Number.isFinite(report_ts)) reportTsNum = report_ts;
      else if (typeof report_ts === 'string') {
        const n = Number(report_ts);
        if (Number.isFinite(n)) reportTsNum = n;
      }
      return {
        ...row,
        latest,
        report_ts: reportTsNum ?? row.report_ts,
      };
    });
    const chartSummaryEvents =
      normalizedChart.length > 0
        ? _getSummaryEvents(normalizedChart)
        : summaryEvents;
    const sortedEvents = [...chartSummaryEvents]
      .slice(-CHART_POINTS)
      .sort((a, b) => _getEventTimestamp(a) - _getEventTimestamp(b));

    let temperaturePoints: ChartPoint[];
    let humidityPoints: ChartPoint[];

    if ((stream.scalarPoints24h?.length ?? 0) > 0) {
      temperaturePoints = _extractScalarFromSensorEvents(stream.scalarPoints24h, 'temp');
      humidityPoints = _extractScalarFromSensorEvents(stream.scalarPoints24h, 'humidity');
    } else {
      temperaturePoints = _extractChartSeries(
        sortedEvents,
        (latest) => _getLatestNumber(latest as Summary['latest'], ['temperature', 'temp'])
      );
      humidityPoints = _extractChartSeries(
        sortedEvents,
        (latest) => _getLatestNumber(latest as Summary['latest'], ['humidity'])
      );
    }
    const lightSource = (stream.lightPoints24h?.length ?? 0) > 0 ? stream.lightPoints24h : stream.eventFeed;
    const lightSpectrumPoints = _extractLightChartFromEventFeed(lightSource);

    return {
      summary,
      temperaturePoints,
      humidityPoints,
      lightSpectrumPoints,
    };
  }, [
    stream.sensorReadings,
    stream.eventFeed,
    stream.chart24h,
    stream.scalarPoints24h,
    stream.lightPoints24h,
    stream.connected,
    stream.connectionStatus?.database_ok,
  ]);

  return {
    ...stream,
    summary,
    temperaturePoints,
    humidityPoints,
    lightSpectrumPoints,
  };
}

/// <reference types="vite/client" />
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_WS_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000/ws`
    : 'ws://localhost:8000/ws';

export type ConnectionStatus = {
  connected: boolean;
  database_ok?: boolean;
  stream?: string;
};

export type GardenStreamState = {
  connected: boolean;
  connectionStatus: ConnectionStatus | null;
  sensorReadings: Record<string, Record<string, unknown>>;
  actuatorChanges: Array<Record<string, unknown>>;
  eventFeed: Array<Record<string, unknown>>;
  /** Summary rows from last 24h for charts (from backend chart_24h). */
  chart24h: Array<Record<string, unknown>>;
  /** Light spectrum point events from last 24h (from backend light_points_24h). */
  lightPoints24h: Array<Record<string, unknown>>;
  /** Scalar sensor point events (e.g. DHT22 temp/humidity) from last 24h. */
  scalarPoints24h: Array<Record<string, unknown>>;
  error: string | null;
};

const initialState: GardenStreamState = {
  connected: false,
  connectionStatus: null,
  sensorReadings: {},
  actuatorChanges: [],
  eventFeed: [],
  chart24h: [],
  lightPoints24h: [],
  scalarPoints24h: [],
  error: null,
};

function getWsUrl(): string {
  const url = import.meta.env.VITE_WS_URL;
  if (url && typeof url === 'string') return url;
  return DEFAULT_WS_URL;
}

/** Base URL for REST API (same host as WebSocket). */
function getApiBaseUrl(): string {
  const ws = getWsUrl();
  const u = ws.replace(/^wss?:\/\//, '').replace(/\/ws\/?$/, '');
  return `${typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'https:' : 'http:'}//${u}`;
}

export function useGardenStream() {
  const [state, setState] = useState<GardenStreamState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    const url = getWsUrl();
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true, error: null }));
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; payload: unknown };
        switch (msg.type) {
          case 'connection_status':
            setState((s) => ({
              ...s,
              connectionStatus: msg.payload as ConnectionStatus,
            }));
            break;
          case 'sensor_readings':
            setState((s) => ({
              ...s,
              sensorReadings: (msg.payload as Record<string, Record<string, unknown>>) ?? {},
            }));
            break;
          case 'actuator_change':
            setState((s) => ({
              ...s,
              actuatorChanges: (msg.payload as Array<Record<string, unknown>>) ?? [],
            }));
            break;
          case 'event_feed':
            setState((s) => ({
              ...s,
              eventFeed: (msg.payload as Array<Record<string, unknown>>) ?? [],
            }));
            break;
          case 'chart_24h':
            setState((s) => ({
              ...s,
              chart24h: (msg.payload as Array<Record<string, unknown>>) ?? [],
            }));
            break;
          case 'light_points_24h':
            setState((s) => ({
              ...s,
              lightPoints24h: (msg.payload as Array<Record<string, unknown>>) ?? [],
            }));
            break;
          case 'scalar_points_24h':
            setState((s) => ({
              ...s,
              scalarPoints24h: (msg.payload as Array<Record<string, unknown>>) ?? [],
            }));
            break;
          case 'pong':
            break;
          default:
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
      wsRef.current = null;
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      setState((s) => ({ ...s, error: 'WebSocket error' }));
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(initialState);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Fallback: fetch chart-24h via REST when connected and chart24h not yet from WS
  useEffect(() => {
    if (!state.connected || (state.chart24h?.length ?? 0) > 0) return;
    const base = getApiBaseUrl();
    let cancelled = false;
    fetch(`${base}/chart-24h`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setState((s) => ({ ...s, chart24h: data }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.connected, state.chart24h?.length]);

  // Fallback: fetch light-points-24h via REST when connected and lightPoints24h not yet from WS
  useEffect(() => {
    if (!state.connected || (state.lightPoints24h?.length ?? 0) > 0) return;
    const base = getApiBaseUrl();
    let cancelled = false;
    fetch(`${base}/light-points-24h`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setState((s) => ({ ...s, lightPoints24h: data }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.connected, state.lightPoints24h?.length]);

  // Fallback: fetch scalar-points-24h via REST when connected and scalarPoints24h not yet from WS
  useEffect(() => {
    if (!state.connected || (state.scalarPoints24h?.length ?? 0) > 0) return;
    const base = getApiBaseUrl();
    let cancelled = false;
    fetch(`${base}/scalar-points-24h`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setState((s) => ({ ...s, scalarPoints24h: data }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.connected, state.scalarPoints24h?.length]);

  return { ...state, connect, disconnect };
}

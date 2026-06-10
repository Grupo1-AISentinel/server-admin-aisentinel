'use strict';

import axios from 'axios';

const DEFAULT_INTERVAL_MS = 30 * 1000;
const DEFAULT_TIMEOUT_MS = 5 * 1000;
const MIN_INTERVAL_MS = 5 * 1000;

const logInfo = (...args) => console.log('[pyimage-health]', ...args);
const logWarn = (...args) => console.warn('[pyimage-health]', ...args);

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Vigila periodicamente la salud del servicio pyimage (FastAPI).
 * El pyimage es HTTP puro (no usa Socket.IO), por lo que no podemos
 * saber su estado por eventos de conexion. Un health-check HTTP
 * es la unica senal fiable de que la IA esta disponible.
 *
 * Emite `pyimage:status` por Socket.IO cuando el estado cambia
 * para que el frontend muestre el chip "IA Conectada/Desconectada".
 */
export const startPyimageHealthMonitor = (io, options = {}) => {
  const url = `${process.env.PYTHON_SERVER_URL || 'http://127.0.0.1:8000'}/health`;
  const intervalMs = Math.max(
    MIN_INTERVAL_MS,
    parsePositiveInt(options.intervalMs, DEFAULT_INTERVAL_MS)
  );
  const timeoutMs = parsePositiveInt(options.timeoutMs, DEFAULT_TIMEOUT_MS);

  let lastState = null;
  let lastCheckedAt = null;
  let lastLatencyMs = null;
  let lastError = null;
  let inFlight = null;
  let intervalId = null;
  let stopped = false;

  const buildPayload = (connected, extra = {}) => ({
    connected,
    latencyMs: connected ? lastLatencyMs : null,
    lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
    error: connected ? null : lastError,
    ...extra,
  });

  const probe = async () => {
    if (stopped) return;
    if (inFlight) {
      // Cancela la peticion anterior si sigue viva (ej. el server cuelga).
      inFlight.abort();
    }
    const controller = new AbortController();
    inFlight = controller;
    const startedAt = Date.now();
    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
        signal: controller.signal,
        validateStatus: () => true,
        headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY || '' },
      });
      const elapsed = Date.now() - startedAt;
      lastCheckedAt = Date.now();
      const ok = response.status >= 200 && response.status < 300;
      if (ok) {
        lastLatencyMs = elapsed;
        lastError = null;
        if (lastState !== true) {
          lastState = true;
          logInfo(`pyimage OK (${elapsed}ms) url=${url}`);
          io.emit('pyimage:status', buildPayload(true));
        }
      } else {
        lastError = `HTTP ${response.status}`;
        if (lastState !== false) {
          lastState = false;
          logWarn(`pyimage respondio con ${response.status} url=${url}`);
          io.emit('pyimage:status', buildPayload(false));
        }
      }
    } catch (err) {
      if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') {
        return; // fue reemplazado por otro probe
      }
      lastCheckedAt = Date.now();
      lastError = err?.code === 'ECONNABORTED'
        ? 'timeout'
        : err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED'
          ? err.code
          : err?.message || 'error';
      if (lastState !== false) {
        lastState = false;
        logWarn(`pyimage inalcanzable (${lastError}) url=${url}`);
        io.emit('pyimage:status', buildPayload(false));
      }
    } finally {
      if (inFlight === controller) inFlight = null;
    }
  };

  const start = () => {
    if (intervalId) return;
    stopped = false;
    // Primer check inmediato para que el frontend reciba el estado real
    // en cuanto se conecte al socket, en vez de esperar 30s.
    probe();
    intervalId = setInterval(probe, intervalMs);
    logInfo(`monitor activo url=${url} intervalMs=${intervalMs} timeoutMs=${timeoutMs}`);
  };

  const stop = () => {
    stopped = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (inFlight) inFlight.abort();
  };

  const getStatus = () => buildPayload(lastState === true);

  return { start, stop, getStatus, probe };
};

export default startPyimageHealthMonitor;

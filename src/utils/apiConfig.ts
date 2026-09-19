import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Current Wi-Fi IPv4 address of this machine
export const DEV_MACHINE_IP = '192.168.8.100';
export const DEV_PORT = 3001;

// Preset server options for quick switching
export const SERVER_PRESETS = [
  {
    id: 'vercel_cloud',
    name: '▲ Vercel Cloud Backend',
    url: 'https://screaner-saham-ihsg.vercel.app',
    desc: 'Server cloud gratis Vercel online 24 jam',
  },
  {
    id: 'local_wifi',
    name: '💻 Laptop / Wi-Fi Lokal',
    url: `http://${DEV_MACHINE_IP}:${DEV_PORT}`,
    desc: 'Langsung terhubung ke server proxy di laptop (Port 3001)',
  },
  {
    id: 'localhost',
    name: '🖥️ Localhost (Browser PC)',
    url: `http://localhost:${DEV_PORT}`,
    desc: 'Untuk browser di laptop yang sama (Port 3001)',
  },
  {
    id: 'render_cloud',
    name: '☁️ Render Cloud Backend',
    url: 'https://screaner-saham-ihsg.onrender.com',
    desc: 'Server cloud gratis online 24 jam',
  },
];

export const PRODUCTION_API_URL = 'https://screaner-saham-ihsg.vercel.app';

let customApiUrl: string | null = null;
export let isLiveMarketConnected = false;
export let lastLiveUpdateTime: Date | null = null;
export let lastLatencyMs: number | null = null;
export let lastErrorMsg: string | null = null;

// Subscribers for live status updates
type StatusListener = (status: {
  connected: boolean;
  lastUpdate: Date | null;
  latency: number | null;
  serverUrl: string;
  error: string | null;
}) => void;

const listeners: Set<StatusListener> = new Set();

export const subscribeLiveStatus = (listener: StatusListener) => {
  listeners.add(listener);
  // Send current state immediately
  listener({
    connected: isLiveMarketConnected,
    lastUpdate: lastLiveUpdateTime,
    latency: lastLatencyMs,
    serverUrl: getApiBaseUrl(),
    error: lastErrorMsg,
  });
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  const payload = {
    connected: isLiveMarketConnected,
    lastUpdate: lastLiveUpdateTime,
    latency: lastLatencyMs,
    serverUrl: getApiBaseUrl(),
    error: lastErrorMsg,
  };
  listeners.forEach(cb => {
    try {
      cb(payload);
    } catch (e) {}
  });
};

AsyncStorage.getItem('@custom_api_url').then(val => {
  if (val) {
    customApiUrl = val;
    notifyListeners();
  }
}).catch(() => {});

export const setCustomApiUrl = async (url: string | null) => {
  if (!url) {
    customApiUrl = null;
    try {
      await AsyncStorage.removeItem('@custom_api_url');
    } catch (e) {}
  } else {
    customApiUrl = url.trim().replace(/\/+$/, '');
    try {
      await AsyncStorage.setItem('@custom_api_url', customApiUrl);
    } catch (e) {}
  }
  notifyListeners();
};

export const setLiveMarketConnected = (status: boolean, latency?: number, error?: string | null) => {
  isLiveMarketConnected = status;
  if (status) {
    lastLiveUpdateTime = new Date();
    lastErrorMsg = null;
  }
  if (latency !== undefined) {
    lastLatencyMs = latency;
  }
  if (error !== undefined) {
    lastErrorMsg = error;
  }
  notifyListeners();
};

/**
 * Test connectivity against a target server URL by querying BBCA and IHSG.
 */
export const testServerConnection = async (targetUrl: string): Promise<{
  success: boolean;
  latency: number;
  sampleQuotes?: Record<string, { price: number; change: number }>;
  error?: string;
}> => {
  const cleanUrl = targetUrl.trim().replace(/\/+$/, '');
  const testEndpoint = `${cleanUrl}/v7/finance/quote?symbols=BBCA.JK,%5EJKSE`;
  const startTime = Date.now();

  try {
    const res = await axios.get(testEndpoint, { timeout: 7000 });
    const elapsed = Date.now() - startTime;
    const quotes = res.data?.quoteResponse?.result;

    if (Array.isArray(quotes) && quotes.length > 0) {
      const sampleQuotes: Record<string, { price: number; change: number }> = {};
      quotes.forEach((q: any) => {
        if (q && q.symbol) {
          sampleQuotes[q.symbol] = {
            price: q.regularMarketPrice || 0,
            change: q.regularMarketChangePercent || 0,
          };
        }
      });
      return {
        success: true,
        latency: elapsed,
        sampleQuotes,
      };
    } else {
      return {
        success: false,
        latency: elapsed,
        error: 'Server merespons tetapi tidak ada data bursa.',
      };
    }
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    let msg = err.message || 'Gagal terhubung ke server.';
    if (err.response?.status === 404) {
      msg = 'Server ditemukan (404), tetapi endpoint /v7/finance/quote belum tersedia.';
    } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      msg = 'Waktu koneksi habis (Timeout 7s).';
    }
    return {
      success: false,
      latency: elapsed,
      error: msg,
    };
  }
};

/**
 * Returns the correct backend API base URL depending on platform:
 * - Custom URL if configured by user
 * - On GitHub Pages (static): uses custom URL or production cloud backend
 * - On local web / self-hosted: uses origin
 * - On Native Android/iOS: uses Wi-Fi IP (192.168.8.100:3000) or Custom URL
 */
export const getApiBaseUrl = (): string => {
  if (customApiUrl) {
    return customApiUrl;
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      // If hosted on GitHub Pages, fallback to Wi-Fi IP or production cloud
      if (window.location.hostname.includes('github.io')) {
        return PRODUCTION_API_URL;
      }
      const port = window.location.port;
      if (!port || port === '80' || port === '443' || port === `${DEV_PORT}`) {
        return window.location.origin;
      }
      const protocol = window.location.protocol || 'http:';
      return `${protocol}//${window.location.hostname}:${DEV_PORT}`;
    }
    return `http://localhost:${DEV_PORT}`;
  }
  // Native mobile device (Android/iOS)
  return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
};



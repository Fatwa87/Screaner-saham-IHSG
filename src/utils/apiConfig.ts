import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Current Wi-Fi IPv4 address of this machine
export const DEV_MACHINE_IP = '192.168.8.100';
export const DEV_PORT = 3000;

// Production Cloud URL (fallback if deployed)
export const PRODUCTION_API_URL = 'https://screaner-saham-ihsg.onrender.com';

let customApiUrl: string | null = null;

AsyncStorage.getItem('@custom_api_url').then(val => {
  if (val) customApiUrl = val;
}).catch(() => {});

export const setCustomApiUrl = async (url: string) => {
  customApiUrl = url.trim().replace(/\/+$/, '');
  try {
    await AsyncStorage.setItem('@custom_api_url', customApiUrl);
  } catch (e) {}
};

/**
 * Returns the correct backend API base URL depending on platform:
 * - Custom URL if configured by user
 * - On Web: uses the current browser hostname/origin
 * - On Native Android/iOS: uses Wi-Fi IP (192.168.8.100:3000) or Cloud URL
 */
export const getApiBaseUrl = (): string => {
  if (customApiUrl) {
    return customApiUrl;
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
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


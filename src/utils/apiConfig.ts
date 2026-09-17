import { Platform } from 'react-native';

// Local Wi-Fi IP address of this machine so Android devices on the same Wi-Fi can access the backend proxy
export const DEV_MACHINE_IP = '192.168.100.76';
export const DEV_PORT = 3000;

/**
 * Returns the correct backend API base URL depending on platform:
 * - On Web: uses the current browser hostname (e.g. localhost or 192.168.x.x)
 * - On Native Android / iOS: uses the machine's Wi-Fi IP so the phone can reach the proxy server
 */
export const getApiBaseUrl = (): string => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const port = window.location.port;
      // If deployed on web (standard port 80/443 or running directly on backend port)
      if (!port || port === '80' || port === '443' || port === `${DEV_PORT}`) {
        return window.location.origin;
      }
      // Running on Expo/Metro dev server (e.g. port 8081) while backend is on DEV_PORT
      const protocol = window.location.protocol || 'http:';
      return `${protocol}//${window.location.hostname}:${DEV_PORT}`;
    }
    return `http://localhost:${DEV_PORT}`;
  }
  // Native mobile device (Android/iOS) connecting over local Wi-Fi
  return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
};

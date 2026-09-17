import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // 1. Injeksi Google Fonts (Plus Jakarta Sans & JetBrains Mono)
      if (!document.getElementById('stock-master-fonts')) {
        const link = document.createElement('link');
        link.id = 'stock-master-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(link);
      }

      // 2. Custom Sleek Obsidian Scrollbars & Font Styling
      if (!document.getElementById('stock-master-styles')) {
        const style = document.createElement('style');
        style.id = 'stock-master-styles';
        style.innerHTML = `
          * {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-sizing: border-box;
          }
          /* Sleek Obsidian Scrollbars */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: #080C15;
          }
          ::-webkit-scrollbar-thumb {
            background: #1E293B;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #334155;
          }
          body {
            background-color: #080C15 !important;
            color: #F8FAFC;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

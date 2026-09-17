import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import ScannersScreen from '../screens/Scanners/ScannersScreen';
import AnalysisScreen from '../screens/Analysis/AnalysisScreen';
import PortfolioScreen from '../screens/Portfolio/PortfolioScreen';
import LiveMarketStatusBar from '../components/LiveMarketStatusBar';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.primary,
  },
};

// Custom Tab Bar Icon Component
const TabIcon = ({ icon, label, focused }: { icon: string; label: string; focused: boolean }) => (
  <View style={[styles.tabItem, focused && styles.tabItemActive]}>
    <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{icon}</Text>
    <Text style={[styles.tabLabelText, focused && styles.tabLabelTextActive]}>{label}</Text>
  </View>
);

export default function AppNavigator() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Live Market & Crumb Status Ribbon */}
      <LiveMarketStatusBar />
      
      <View style={styles.appShell}>
        <NavigationContainer theme={MyTheme}>
          <Tab.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: COLORS.surface,
                borderBottomColor: COLORS.borderGlass,
                borderBottomWidth: 1,
                elevation: 0,
                shadowOpacity: 0,
                height: Platform.OS === 'web' ? 64 : 56,
              },
              headerTitleAlign: 'left',
              headerTitle: () => (
                <View style={styles.headerBrand}>
                  <View style={styles.logoBadge}>
                    <Text style={styles.logoIcon}>📈</Text>
                  </View>
                  <View>
                    <View style={styles.brandRow}>
                      <Text style={styles.brandTitle}>STOCK MASTER</Text>
                      <View style={styles.proPill}>
                        <Text style={styles.proPillText}>AI QUANT</Text>
                      </View>
                    </View>
                    <Text style={styles.brandSubtitle}>Bursa Efek Indonesia • Real-Time IHSG Screener</Text>
                  </View>
                </View>
              ),
              tabBarStyle: {
                backgroundColor: COLORS.surface,
                borderTopColor: COLORS.borderGlass,
                borderTopWidth: 1,
                height: Platform.OS === 'web' ? 68 : 62,
                paddingBottom: Platform.OS === 'web' ? 8 : 6,
                paddingTop: 6,
              },
              tabBarShowLabel: false,
            }}
          >
            <Tab.Screen 
              name="Dashboard" 
              component={DashboardScreen} 
              options={{ 
                tabBarIcon: ({ focused }) => <TabIcon icon="🌐" label="Makro" focused={focused} />,
              }} 
            />
            <Tab.Screen 
              name="Scanners" 
              component={ScannersScreen} 
              options={{ 
                tabBarIcon: ({ focused }) => <TabIcon icon="⚡" label="Screener" focused={focused} />,
              }} 
            />
            <Tab.Screen 
              name="Analysis" 
              component={AnalysisScreen} 
              options={{ 
                tabBarIcon: ({ focused }) => <TabIcon icon="🎯" label="Analisa" focused={focused} />,
              }} 
            />
            <Tab.Screen 
              name="Portfolio" 
              component={PortfolioScreen} 
              options={{ 
                tabBarIcon: ({ focused }) => <TabIcon icon="💼" label="Portofolio" focused={focused} />,
              }} 
            />
          </Tab.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  appShell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1440 : undefined,
    alignSelf: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: Platform.OS === 'web' ? 8 : 0,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  proPillText: {
    color: '#C084FC',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 64,
  },
  tabItemActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  tabIconText: {
    fontSize: 18,
    opacity: 0.7,
  },
  tabIconTextActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  tabLabelText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
});

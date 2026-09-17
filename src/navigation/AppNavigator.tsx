import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import KrakenFlowScreen from '../screens/KrakenFlow/KrakenFlowScreen';
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

export default function AppNavigator() {
  return (
    <SafeAreaView style={styles.container}>
      <LiveMarketStatusBar />
      <NavigationContainer theme={MyTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.surface,
              borderBottomColor: COLORS.border,
              borderBottomWidth: 1,
            },
            headerTintColor: COLORS.text,
            tabBarStyle: {
              backgroundColor: COLORS.surface,
              borderTopColor: COLORS.border,
            },
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textMuted,
          }}
        >
          <Tab.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{ title: 'Makro & IHSG' }} 
          />
          <Tab.Screen 
            name="KrakenFlow" 
            component={KrakenFlowScreen} 
            options={{ title: 'Kraken Flow 🐙' }} 
          />
          <Tab.Screen 
            name="Scanners" 
            component={ScannersScreen} 
            options={{ title: 'Scanners' }} 
          />
          <Tab.Screen 
            name="Analysis" 
            component={AnalysisScreen} 
            options={{ title: 'Analisa Saham' }} 
          />
          <Tab.Screen 
            name="Portfolio" 
            component={PortfolioScreen} 
            options={{ title: 'Portfolio' }} 
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});


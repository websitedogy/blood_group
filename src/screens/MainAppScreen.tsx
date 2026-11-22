import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import EmergencySosScreen from './emergency/EmergencySosScreen';
import DonorDashboardScreen from './donor/DonorDashboardScreen';
import ChatRoomScreen from './chat/ChatRoomScreen';
import HospitalInventoryScreen from './hospital/HospitalInventoryScreen';
import ImpactCommunityScreen from './impact/ImpactCommunityScreen';

export type MainTab = 'emergency' | 'donor' | 'chat' | 'hospitals' | 'impact';

interface MainAppScreenProps {
  userId: string;
  phone?: string;
  onLogout: () => void;
}

export default function MainAppScreen({
  userId,
  phone,
  onLogout,
}: MainAppScreenProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<MainTab>('emergency');

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.content}>
        {activeTab === 'emergency' && (
          <EmergencySosScreen userId={userId} defaultPhone={phone} />
        )}
        {activeTab === 'donor' && (
          <DonorDashboardScreen userId={userId} phone={phone} onLogout={onLogout} />
        )}
        {activeTab === 'chat' && (
          <ChatRoomScreen
            roomId="sample-room-101"
            currentUserId={userId}
            recipientLabel="Emergency Donor Coordination"
            onBack={() => setActiveTab('emergency')}
          />
        )}
        {activeTab === 'hospitals' && <HospitalInventoryScreen />}
        {activeTab === 'impact' && <ImpactCommunityScreen />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('emergency')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Emergency SOS Tab"
        >
          <Text style={[styles.tabIcon, activeTab === 'emergency' && styles.tabActiveIcon]}>🚨</Text>
          <Text style={[styles.tabLabel, activeTab === 'emergency' && styles.tabActiveLabel]}>
            SOS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('donor')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Donor Dashboard Tab"
        >
          <Text style={[styles.tabIcon, activeTab === 'donor' && styles.tabActiveIcon]}>🩸</Text>
          <Text style={[styles.tabLabel, activeTab === 'donor' && styles.tabActiveLabel]}>
            Donor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('chat')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Donor Chat Tab"
        >
          <Text style={[styles.tabIcon, activeTab === 'chat' && styles.tabActiveIcon]}>💬</Text>
          <Text style={[styles.tabLabel, activeTab === 'chat' && styles.tabActiveLabel]}>
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('hospitals')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Hospital Inventory Tab"
        >
          <Text style={[styles.tabIcon, activeTab === 'hospitals' && styles.tabActiveIcon]}>🏥</Text>
          <Text style={[styles.tabLabel, activeTab === 'hospitals' && styles.tabActiveLabel]}>
            Banks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('impact')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Impact and Heroes Tab"
        >
          <Text style={[styles.tabIcon, activeTab === 'impact' && styles.tabActiveIcon]}>🌟</Text>
          <Text style={[styles.tabLabel, activeTab === 'impact' && styles.tabActiveLabel]}>
            Impact
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingBottom: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabActiveIcon: {
    transform: [{ scale: 1.15 }],
  },
  tabLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  tabActiveLabel: {
    color: '#dc2626',
    fontWeight: '700',
  },
});

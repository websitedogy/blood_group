import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LIFELOOP AI</Text>
      <Text style={styles.subtitle}>Emergency Blood Donation Platform</Text>
      <Text style={styles.status}>Gate 1: Foundation Active</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 16,
    textAlign: 'center',
  },
  status: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
});

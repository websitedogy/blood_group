import React from 'react';
import { StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './screens/auth/AuthScreen';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <AuthScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

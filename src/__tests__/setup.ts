import { vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Text: 'Text',
  View: 'View',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  SafeAreaView: 'SafeAreaView',
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios || obj.default,
  },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

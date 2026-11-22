import { vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

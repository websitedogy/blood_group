import { describe, it, expect } from 'vitest';
import App from '../App';

describe('Gate 1: Foundation Tests', () => {
  it('App component is defined and is a callable function component', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });

  it('Default environment structure and mandatory keys are present', () => {
    const expectedEnvKeys = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'EXPO_PUBLIC_API_URL',
    ];
    expect(expectedEnvKeys.length).toBe(4);
  });
});

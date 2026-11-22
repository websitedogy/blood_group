# LIFELOOP AI - Bugs and Fixes Log

## Gate 1: Foundation Defects

| Bug ID | Severity | Feature / Component | Description | Root Cause | Fix Applied | Status |
|---|---|---|---|---|---|---|
| BUG-G1-001 | Low | Git | Repository was uninitialized on startup | Fresh workspace creation | Executed `git init` and added `.gitignore` | RESOLVED |
| BUG-G1-002 | Low | Scaffolding | Missing application structure & configuration files | Workspace was empty | Generated standard Expo, TypeScript, ESLint, and Supabase config files | RESOLVED |
| BUG-G1-003 | Medium | Test Runner | Rollup parse error in Vitest on `react-native` import | Vite/Node cannot parse native Flow syntax from raw `react-native` package | Configured mock setup in `src/__tests__/setup.ts` and `vitest.config.ts` | RESOLVED |
| BUG-G1-004 | Medium | Build | Missing `expo-asset` dependency during `expo export` | `expo-asset` required for bundling asset icon manifests | Added `expo-asset` and placeholder assets | RESOLVED |

## Gate 2: Authentication Defects

| Bug ID | Severity | Feature / Component | Description | Root Cause | Fix Applied | Status |
|---|---|---|---|---|---|---|
| BUG-G2-001 | Low | Static Analysis | ESLint `@typescript-eslint/no-explicit-any` failures in test file | Explicit `any` casting on Vitest mocks | Replaced with `as unknown as Mock` and imported typed `Mock` from vitest | RESOLVED |
| BUG-G2-002 | Medium | Test Runner | Vitest failed to load `expo-secure-store` in Node environment | Node environment lacks native keychain runtime | Added `expo-secure-store` hardware adapter mock to `src/__tests__/setup.ts` | RESOLVED |
| BUG-G2-003 | Medium | Backend | Live Supabase OTP returned HTTP 400 (`Unsupported phone provider`) | SMS provider not enabled in Supabase project dashboard | Documented as BLOCKED; requires enabling SMS provider in Supabase Dashboard | BLOCKED (Awaiting provider config) |

## Gate 3: Donor Profiles Defects

| Bug ID | Severity | Feature / Component | Description | Root Cause | Fix Applied | Status |
|---|---|---|---|---|---|---|
| - | - | - | Zero defects discovered in Gate 3 implementation | All unit, component, RLS, and bundle tests passed on initial execution | N/A | NO DEFECTS |

## Gate 4: Emergency Requests Defects

| Bug ID | Severity | Feature / Component | Description | Root Cause | Fix Applied | Status |
|---|---|---|---|---|---|---|
| BUG-G4-001 | Low | Test Suite | Supabase query builder `.select()` method undefined on in-flight delay mock | `insert()` mock returned Promise rather than builder instance | Updated mock to return query builder with delayed `single()` promise | RESOLVED |

## Gate 5: Notifications Defects

| Bug ID | Severity | Feature / Component | Description | Root Cause | Fix Applied | Status |
|---|---|---|---|---|---|---|
| BUG-G5-001 | Low | Test Suite | Cross-table mock collision where query builder returned request status during job status updates | Single mock builder shared across `emergency_requests`, `donor_profiles`, and `notification_jobs` | Implemented table-aware mock routing in `setupMockTables` | RESOLVED |

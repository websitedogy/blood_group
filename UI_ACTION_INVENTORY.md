# LIFELOOP AI - UI Action Inventory

## Gate 2: Authentication Action Inventory

| Field | Action 1: Send OTP | Action 2: Consent Checkbox | Action 3: Verify OTP | Action 4: Resend OTP | Action 5: Change Phone | Action 6: Logout |
|---|---|---|---|---|---|---|
| **Screen Name** | `AuthScreen` | `AuthScreen` | `AuthScreen` | `AuthScreen` | `AuthScreen` | `AuthScreen` (Dashboard view) |
| **Component Name** | `TouchableOpacity` (Primary) | `TouchableOpacity` (Checkbox) | `TouchableOpacity` (Primary) | `TouchableOpacity` (Secondary) | `TouchableOpacity` (Link) | `TouchableOpacity` (Logout) |
| **Visible Label** | "Send Verification OTP" | Checkbox toggle | "Verify OTP & Login" | "Resend OTP" / "Resend in Xs" | "Change Phone Number" | "Log Out" |
| **Expected Action** | Request SMS OTP | Toggle consent boolean | Submit OTP for verification | Resend OTP via SMS | Reset form back to phone input | Terminate session & clear storage |
| **Navigation Destination** | Transitions to OTP input state | None (Form state) | Transitions to Dashboard view | None (Refreshes cooldown) | Reverts to phone input state | Reverts to unauthenticated login view |
| **API / DB Operation** | `supabase.auth.signInWithOtp` | Local state -> Profile upsert | `supabase.auth.verifyOtp` + `profiles.select` | `supabase.auth.signInWithOtp` | None | `supabase.auth.signOut` |
| **Required Role / Permission** | Public / Unauthenticated | Public / Unauthenticated | Public / Unauthenticated | Public / Unauthenticated | Public / Unauthenticated | Authenticated User |
| **Loading State** | Shows `ActivityIndicator`, disables button | Instantaneous toggle | Shows `ActivityIndicator`, disables button | Shows `ActivityIndicator`, disables button | N/A | Shows `ActivityIndicator`, disables button |
| **Success Result** | Displays success banner, starts 60s cooldown | Checkmark visible, button enabled if phone valid | Transitions to dashboard, displays user details | Cooldown reset to 60s, displays success banner | OTP input cleared, phone input unlocked | Session cleared, returns to login form |
| **Error Result** | Displays error alert banner | Cannot proceed without consent | Displays error alert banner, user can re-type | Displays cooldown warning or provider error | N/A | Displays error alert |
| **Disabled State** | Disabled if phone empty or consent unchecked | Always interactive | Disabled if OTP length != 6 or loading | Disabled during 60s cooldown or loading | Disabled during loading | Disabled during loading |
| **Duplicate-Tap Behavior** | Debounced & disabled while loading | Toggle debounced | Debounced & disabled while loading | In-memory 60s rate limiter prevents duplicate API calls | Immediate transition | Debounced & disabled while loading |
| **Offline Behavior** | Catches network exception, displays error message | Toggles locally | Catches network exception, displays error message | Catches network exception, displays error message | Operates locally | Clears local hardware tokens, warns on API failure |
| **Accessibility Label** | "Send OTP via SMS" | "I consent to receive emergency blood requests and alerts" | "Verify OTP and Authenticate" | "Resend Verification OTP" | "Change entered phone number" | "Log out of LIFELOOP" |
| **Automated Test ID** | `TC-G2-005`, `TC-G2-006` | `TC-G2-004` | `TC-G2-009`, `TC-G2-010` | `TC-G2-007` | `TC-G2-012` | `TC-G2-013` |
| **Test Result** | PASSED (Unit/Mock) / BLOCKED (Live SMS Provider Config) | PASSED | PASSED (Unit/Mock) | PASSED | PASSED | PASSED |

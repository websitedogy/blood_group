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

---

## Gate 3: Donor Dashboard Action Inventory

| Field | Action 7: Blood Group Chip | Action 8: Toggle Availability | Action 9: Toggle Pause Notifications | Action 10: Adjust Radius Stepper | Action 11: Toggle Channel Chip | Action 12: Withdraw Consent |
|---|---|---|---|---|---|---|
| **Screen Name** | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` |
| **Component Name** | `TouchableOpacity` (Chip) | `TouchableOpacity` (Button) | `TouchableOpacity` (Button) | `TouchableOpacity` (Stepper) | `TouchableOpacity` (Chip) | `TouchableOpacity` (Danger Button) |
| **Visible Label** | Blood Group (e.g. "O+", "A-") | "Switch to UNAVAILABLE" / "AVAILABLE" | "Pause Notifications" / "Resume" | "- 5 km" / "+ 5 km" | Channel (e.g. "PUSH", "SMS") | "Withdraw Consent" |
| **Expected Action** | Select & register clinical blood group | Toggle emergency readiness | Toggle alert silencing | Adjust radius by 5 km (bounds: 1–50 km) | Add/remove notification channel | Revoke emergency consent & deactivate |
| **Navigation Destination** | Stays on Dashboard | Stays on Dashboard | Stays on Dashboard | Stays on Dashboard | Stays on Dashboard | Stays on Dashboard (State updated) |
| **API / DB Operation** | `donor_profiles.upsert` | `donor_profiles.update(is_available)` | `donor_profiles.update(notifications_paused)` | `donor_profiles.update(notification_radius_km)` | `donor_profiles.update(preferred_channels)` | `profiles.update(consent=false)` + `donor_profiles.update` |
| **Required Role / Permission** | Authenticated Donor | Authenticated Donor | Authenticated Donor | Authenticated Donor | Authenticated Donor | Authenticated Donor |
| **Loading State** | Disables chips during action | Disables button during action | Disables button during action | Disables stepper during action | Disables chips during action | Disables button during action |
| **Success Result** | Chip highlighted, success banner displayed | Badge toggles, success feedback | Status toggles, feedback banner | Radius text updates, success banner | Chip toggles, success feedback | Profile marked unavailable & paused |
| **Error Result** | Displays validation error banner | Displays database error banner | Displays database error banner | Rejects out of bound adjustments | Rejects if 0 channels selected | Displays database error banner |
| **Disabled State** | Disabled while action loading | Disabled while action loading | Disabled while action loading | Disabled at limits (1 km / 50 km) | Disabled while action loading | Disabled while action loading |
| **Duplicate-Tap Behavior** | Debounced & ignored while loading | Debounced & ignored while loading | Debounced & ignored while loading | Debounced & ignored while loading | Debounced & ignored while loading | Debounced & ignored while loading |
| **Offline Behavior** | Catches error, shows network warning | Catches error, shows network warning | Catches error, shows network warning | Catches error, shows network warning | Catches error, shows network warning | Catches error, shows network warning |
| **Accessibility Label** | "Select blood group [BG]" | "Mark yourself [un]available" | "[Pause/Resume] notifications" | "[Decrease/Increase] alert radius" | "Toggle notification channel [CH]" | "Withdraw emergency communication consent" |
| **Automated Test ID** | `TC-G3-001` - `TC-G3-005` | `TC-G3-008` | `TC-G3-009` | `TC-G3-006`, `TC-G3-007` | `TC-G3-010` | `TC-G3-011` |
| **Test Result** | PASSED | PASSED | PASSED | PASSED | PASSED | PASSED |

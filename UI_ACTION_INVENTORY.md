# LIFELOOP AI - UI Action Inventory (Complete Release)

## Gate 2: Authentication Action Inventory
| Field | Action 1: Send OTP | Action 2: Consent Checkbox | Action 3: Verify OTP | Action 4: Resend OTP | Action 5: Change Phone | Action 6: Logout |
|---|---|---|---|---|---|---|
| **Screen Name** | `AuthScreen` | `AuthScreen` | `AuthScreen` | `AuthScreen` | `AuthScreen` | `AuthScreen` (Dashboard view) |
| **Visible Label** | "Send Verification OTP" | Checkbox toggle | "Verify OTP & Login" | "Resend OTP" / "Resend in Xs" | "Change Phone Number" | "Log Out" |
| **API / DB Operation** | `supabase.auth.signInWithOtp` | Profile upsert | `supabase.auth.verifyOtp` + `profiles.select` | `supabase.auth.signInWithOtp` | None | `supabase.auth.signOut` |
| **Test Result** | PASSED (Unit/Mock) / BLOCKED (Live SMS Provider Config) | PASSED | PASSED | PASSED | PASSED | PASSED |

## Gate 3: Donor Dashboard Action Inventory
| Field | Action 7: Blood Group Chip | Action 8: Toggle Availability | Action 9: Toggle Pause Notifications | Action 10: Adjust Radius Stepper | Action 11: Toggle Channel Chip | Action 12: Withdraw Consent |
|---|---|---|---|---|---|---|
| **Screen Name** | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` | `DonorDashboardScreen` |
| **Visible Label** | Blood Group (e.g. "O+", "A-") | "Switch to UNAVAILABLE" / "AVAILABLE" | "Pause Notifications" / "Resume" | "- 5 km" / "+ 5 km" | Channel (e.g. "PUSH", "SMS") | "Withdraw Consent" |
| **API / DB Operation** | `donor_profiles.upsert` | `donor_profiles.update(is_available)` | `donor_profiles.update(notifications_paused)` | `donor_profiles.update(notification_radius_km)` | `donor_profiles.update(preferred_channels)` | `profiles.update(consent=false)` |
| **Test Result** | PASSED | PASSED | PASSED | PASSED | PASSED | PASSED |

## Gate 4: Emergency SOS & Matching Action Inventory
| Field | Action 13: SOS Blood Group Chip | Action 14: Adjust Units Needed | Action 15: Urgency Selector | Action 16: Genuine Need Confirmation | Action 17: Broadcast SOS Button | Action 18: Cancel SOS Button |
|---|---|---|---|---|---|---|
| **Screen Name** | `EmergencySosScreen` | `EmergencySosScreen` | `EmergencySosScreen` | `EmergencySosScreen` | `EmergencySosScreen` | `EmergencySosScreen` |
| **Visible Label** | Blood Group (e.g. "B+", "O-") | "- 1 Unit" / "+ 1 Unit" | "CRITICAL", "URGENT", "STANDARD" | Checkbox toggle | "🚨 BROADCAST EMERGENCY SOS" | "Cancel Request" |
| **API / DB Operation** | Form state | Form state | Form state | Form state | `emergency_requests.insert` | `emergency_requests.update(status='cancelled')` |
| **Test Result** | PASSED | PASSED | PASSED | PASSED | PASSED | PASSED |

## Gate 5: Four-Channel Notifications Action Inventory
| Field | Action 19: View 4-Channel Status Button | Action 20: Close Dispatch Monitor Modal |
|---|---|---|
| **Screen Name** | `EmergencySosScreen` (Request List Item) | `NotificationDispatchModal` |
| **Visible Label** | "📡 4-Channel Status" | "Close" |
| **API / DB Operation** | `notification_jobs.select` (aggregated by channel/status) | Local modal visibility state (`visible = false`) |
| **Test Result** | PASSED | PASSED |

## Gate 6: Responses, Chat & Contact Consent Action Inventory
| Field | Action 21: Send Chat Message | Action 22: Mutual Phone Share Toggle | Action 23: Back from Chat |
|---|---|---|
| **Screen Name** | `ChatRoomScreen` | `ChatRoomScreen` | `ChatRoomScreen` |
| **Visible Label** | "Send" | "Approve sharing my phone number" | "← Back" |
| **API / DB Operation** | `chat_messages.insert` | `contact_share_consents.upsert` + `get_mutual_contact_info` | Stays on Main Navigation |
| **Test Result** | PASSED | PASSED | PASSED |

## Gate 7: Hospital Inventory Action Inventory
| Field | Action 24: District Filter Chips | Action 25: Call Hospital Helpline |
|---|---|---|
| **Screen Name** | `HospitalInventoryScreen` | `HospitalInventoryScreen` |
| **Visible Label** | "All", "Hyderabad", "Warangal", etc. | Helpline phone link |
| **API / DB Operation** | `organizations.select(district)` + `blood_inventory.select` | Device dialer intent |
| **Test Result** | PASSED | PASSED |

## Gate 8: Voice SOS Action Inventory
| Field | Action 26: Telugu/English Voice SOS Trigger | Action 27: Confirm AI Extracted SOS Data |
|---|---|---|
| **Screen Name** | `EmergencySosScreen` | `EmergencySosScreen` |
| **Visible Label** | "Voice SOS" | "Confirm Extracted Data" |
| **API / DB Operation** | `aiVoiceService.processVoiceInput` | Form confirmation state |
| **Test Result** | PASSED | PASSED |

## Gate 9: Impact & Community Action Inventory
| Field | Action 28: Heroes Honor Cards | Action 29: District Analytics Selector |
|---|---|---|
| **Screen Name** | `ImpactCommunityScreen` | `ImpactCommunityScreen` |
| **Visible Label** | Donor Recognition Badges | District Chips ("Hyderabad", "Warangal") |
| **API / DB Operation** | `lifeloop_heroes.select` | `impactService.getDistrictStats` |
| **Test Result** | PASSED | PASSED |

## Gate 10: Master Tab Navigation Action Inventory
| Field | Action 30: Bottom Navigation Tabs |
|---|---|
| **Screen Name** | `MainAppScreen` |
| **Visible Label** | "SOS", "Donor", "Chat", "Banks", "Impact" |
| **API / DB Operation** | Tab routing state (`emergency`, `donor`, `chat`, `hospitals`, `impact`) |
| **Test Result** | PASSED |

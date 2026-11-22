# LIFELOOP AI - Master Test Cases

## Gate 1: Foundation Test Cases

| Test ID | Test Category | Description | Expected Result | Execution Type | Status |
|---|---|---|---|---|---|
| TC-G1-001 | Environment | Node.js runtime compatibility check | Node.js >= 18 installed and active | Automated / CLI | PASSED |
| TC-G1-002 | Environment | Package manager configuration check | npm CLI available and functional | Automated / CLI | PASSED |
| TC-G1-003 | Environment | Version control initialization | Git repository initialized with valid `.gitignore` | Automated / CLI | PASSED |
| TC-G1-004 | Configuration | Environment variables template | `.env.example` documents all required keys | Manual Inspection | PASSED |
| TC-G1-005 | Configuration | Expo manifest valid | `app.json` contains valid package, slug, and settings | Automated / Schema | PASSED |
| TC-G1-006 | Database | Migration strategy documentation | `supabase/README.md` documents migration and rollback | Manual Inspection | PASSED |
| TC-G1-007 | Database | Initial migration SQL syntax | `20261122000000_gate1_foundation_postgis.sql` syntax valid | Automated / SQL | PASSED |
| TC-G1-008 | Build | Dependency installation | `npm install` installs pinned dependencies cleanly | Automated / CLI | PASSED |
| TC-G1-009 | Static Analysis | TypeScript compilation check | `npm run typecheck` (`tsc --noEmit`) passes with zero errors | Automated / CLI | PASSED |
| TC-G1-010 | Static Analysis | ESLint verification | `npm run lint` passes with zero warnings/errors | Automated / CLI | PASSED |
| TC-G1-011 | Build | Project bundle export | `npx expo export` produces valid Android & iOS Hermes bundles | Automated / CLI | PASSED |
| TC-G1-012 | Testing | Vitest unit test suite | Foundation component & config assertions pass | Automated / CLI | PASSED |

## Gate 2: Authentication Test Cases

| Test ID | Test Category | Description | Expected Result | Execution Type | Status |
|---|---|---|---|---|---|
| TC-G2-001 | Validation | E.164 phone formatting (+91 standard) | Normalizes domestic 10-digit number to +91XXXXXXXXXX | Automated / Vitest | PASSED |
| TC-G2-002 | Validation | Invalid / short phone number | Rejects number < 10 digits with descriptive error | Automated / Vitest | PASSED |
| TC-G2-003 | Validation | Invalid mobile prefix | Rejects numbers not starting with 6, 7, 8, or 9 | Automated / Vitest | PASSED |
| TC-G2-004 | Compliance | Explicit consent mandatory capture | Rejects OTP dispatch if consent checkbox is unchecked | Automated / Vitest | PASSED |
| TC-G2-005 | Authentication | Supabase OTP dispatch logic | Invokes GoTrue `signInWithOtp` with normalized phone and channel SMS | Automated / Vitest | PASSED |
| TC-G2-006 | Security | OTP resend cooldown & rate limiting | Blocks duplicate OTP dispatch within 60-second window | Automated / Vitest | PASSED |
| TC-G2-007 | Reliability | SMS provider gateway error handling | Gracefully catches provider failure and surfaces message | Automated / Vitest | PASSED |
| TC-G2-008 | Validation | 6-digit numeric OTP format check | Rejects non-numeric, short, or long tokens | Automated / Vitest | PASSED |
| TC-G2-009 | Authentication | Successful OTP verification & session | Verifies token, creates session, and upserts donor profile | Automated / Vitest | PASSED |
| TC-G2-010 | Authentication | Invalid or expired OTP verification | Rejects invalid OTP and displays clear error banner | Automated / Vitest | PASSED |
| TC-G2-011 | Security | Suspended account access revocation | Suspended account denied access and forced to sign out | Automated / Vitest | PASSED |
| TC-G2-012 | Session | Session restoration on app restart | Restores user session from hardware secure storage | Automated / Vitest | PASSED |
| TC-G2-013 | Session | Logout and secure storage clearance | Terminates session and clears hardware-backed keys | Automated / Vitest | PASSED |
| TC-G2-014 | Security | Role escalation defense | New registrations default strictly to 'donor' role | Automated / Vitest | PASSED |
| TC-G2-015 | Security | Database RLS profile isolation | Users cannot read other users' private profiles | Automated / Vitest | PASSED |
| TC-G2-016 | Build | Production Hermes bundle export | `npx expo export` bundles AuthScreen cleanly on Android & iOS | Automated / CLI | PASSED |
| TC-G2-017 | Integration | Real Supabase Auth GoTrue endpoint | `https://aqvqhgpcjomrpzvzwreg.supabase.co/auth/v1/health` returns 200 OK | Automated / Live API | PASSED |
| TC-G2-018 | Integration | Live SMS OTP dispatch | Live SMS dispatch to real phone number via Supabase | Automated / Live API | BLOCKED (Phone provider not configured in Supabase Dashboard) |

## Gate 3: Donor Profiles Test Cases

| Test ID | Test Category | Description | Expected Result | Execution Type | Status |
|---|---|---|---|---|---|
| TC-G3-001 | Validation | Clinical blood group valid types | Accepts 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-' | Automated / Vitest | PASSED |
| TC-G3-002 | Validation | Blood group normalization | Normalizes case ('o+' -> 'O+') cleanly | Automated / Vitest | PASSED |
| TC-G3-003 | Validation | Invalid blood group rejection | Rejects non-existent blood types (e.g. 'C+', 'Rh+') | Automated / Vitest | PASSED |
| TC-G3-004 | Validation | Empty blood group rejection | Rejects empty blood group with descriptive error | Automated / Vitest | PASSED |
| TC-G3-005 | Profile | Register donor profile with blood group | Upserts profile in `donor_profiles` with defaults | Automated / Vitest | PASSED |
| TC-G3-006 | Radius | Radius boundary validation | Accepts values between 1 and 50 km; rounds decimals | Automated / Vitest | PASSED |
| TC-G3-007 | Radius | Out-of-bounds radius rejection | Rejects radius < 1 km or > 50 km | Automated / Vitest | PASSED |
| TC-G3-008 | Availability | Toggle donor availability | Switches `is_available` between true and false | Automated / Vitest | PASSED |
| TC-G3-009 | Preferences | Pause / resume notifications | Switches `notifications_paused` between true and false | Automated / Vitest | PASSED |
| TC-G3-010 | Channels | Update notification channels | Saves valid channel array; rejects empty array | Automated / Vitest | PASSED |
| TC-G3-011 | Consent | Consent withdrawal flow | Revokes consent, deactivates donor, pauses notifications | Automated / Vitest | PASSED |
| TC-G3-012 | History | Empty response history state | Returns clean empty array when no responses exist | Automated / Vitest | PASSED |
| TC-G3-013 | History | Retrieve response records | Returns chronological response history for donor | Automated / Vitest | PASSED |
| TC-G3-014 | Response | Record emergency SOS response | Inserts accepted/declined response into `donor_responses` | Automated / Vitest | PASSED |
| TC-G3-015 | Security | RLS donor profile isolation | Rejects unauthorized cross-donor profile queries | Automated / Vitest | PASSED |
| TC-G3-016 | Security | PostGIS location coordinate privacy | Coordinates never returned to unauthorized users | Automated / Vitest | PASSED |
| TC-G3-017 | Database | PostGIS geometry sync trigger | Point geometry automatically generated from lat/lng | Automated / SQL | PASSED |
| TC-G3-018 | Build | Hermes production bundle with donor center | `npx expo export` bundles DonorDashboardScreen cleanly | Automated / CLI | PASSED |

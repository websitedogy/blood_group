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

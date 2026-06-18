---
status: partial
phase: 03-minimal-start-tourprovider-wiring
source:
  - .planning/phases/03-minimal-start-tourprovider-wiring/03-01-SUMMARY.md
  - .planning/phases/03-minimal-start-tourprovider-wiring/03-02-SUMMARY.md
  - .planning/phases/03-minimal-start-tourprovider-wiring/03-03-SUMMARY.md
started: 2026-06-18T00:00:00Z
updated: 2026-06-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Auth gate preserved on tab pages
expected: Open the app in an incognito/logged-out browser window and navigate to /dashboard. You should be immediately redirected to /login. No tab page content should render for unauthenticated users.
result: skipped

### 2. Username layout gate — auto-username redirects to onboarding
expected: Log in with an account whose username matches the auto-generated pattern (user_XXXXXXXX, 8 hex chars). Navigate to /dashboard. You should be redirected to /onboarding/username — the username setup page — rather than seeing dashboard content.
result: skipped

### 3. No onboarding_complete bounce — set-username user lands in app
expected: Log in with an account that has a real (non-auto) username set. Navigate to /dashboard. You should land directly on the dashboard — no redirect to /onboarding/schedule or any other onboarding page. Users are no longer bounced based on onboarding_complete flag.
result: skipped

### 4. TourProvider active — no context errors
expected: Log in with a normal account and open the browser console. Navigate between tab pages (dashboard, groups, notifications, settings). There should be no "useTour must be used within TourProvider" error in the console. The app renders normally with no tour-related runtime errors.
result: skipped

### 5. u/me page redirects to u/{username}
expected: While logged in, navigate to /u/me. You should be immediately redirected to /u/{your-username} — the full profile URL. You should NOT land on /u/null or get a 404.
result: skipped

### 6. Cycle page gender gate preserved
expected: If you have a test account with gender set to anything other than "female", navigate to /cycle. You should be redirected to /dashboard. If you have a female-gendered account, /cycle should render the cycle page normally.
result: skipped

### 7. Groups membership gate preserved
expected: Navigate to /groups/{id} for a group you are NOT a member of (or construct any group URL with a random ID you're not in). You should be redirected to /groups rather than seeing group content.
result: skipped

## Summary

total: 7
passed: 0
issues: 0
skipped: 7
pending: 0

## Gaps

[none]

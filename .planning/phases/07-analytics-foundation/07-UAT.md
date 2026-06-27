---
status: testing
phase: 07-analytics-foundation
source: [07-VERIFICATION.md]
started: 2026-06-27T12:22:00Z
updated: 2026-06-27T12:22:00Z
---

## Current Test

number: 1
name: PostHog $pageview receipt in Network tab
expected: |
  POST /ingest/e/ appears in browser Network tab on route changes with real API key + npm run dev
awaiting: user response

## Tests

### 1. PostHog $pageview receipt
expected: POST /ingest/e/ appears in Network tab on route changes (real API key + npm run dev)
result: [pending]

### 2. User attribution in PostHog dashboard
expected: Events after login show Supabase UUID as distinct_id in PostHog dashboard
result: [pending]

### 3. End-to-end /ingest proxy chain
expected: /ingest/decide/ proxies correctly without 404 (validates skipTrailingSlashRedirect)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

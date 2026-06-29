---
slug: admin-users-list
status: complete
completed: 2026-06-29
---

# Admin Users List — Complete

Added `/admin/users` page showing all registered users with per-row stats.

## Changes

- `src/app/admin/layout.tsx` — added Dashboard | Users nav links in header
- `src/app/admin/users/page.tsx` — new RSC: queries profiles + group_members, derives has_gym / in_pact flags, renders UsersTable
- `src/components/admin/users-table.tsx` — new presentational table with Badge flags (onboarded / gym / pact)
- `src/components/admin/user-overview.tsx` — "Registered" count now links to /admin/users

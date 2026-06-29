---
slug: admin-users-list
created: 2026-06-29
status: in-progress
---

# Admin: Users List Page

Add a `/admin/users` route that lets the owner browse all registered users.

## Goal

Owner can navigate from the admin dashboard to a paginated/scrollable list of all profiles with key stats per user.

## Tasks

1. Add nav links to admin layout header (Dashboard | Users)
2. Create `src/app/admin/users/page.tsx` — RSC, queries profiles via admin client
3. Create `src/components/admin/users-table.tsx` — presentational table component
4. Make "Registered" count in UserOverview card link to `/admin/users`

## Data fetched (admin client, no RLS)

From `profiles`: id, name, username, email, timezone, weekly_goal, onboarding_complete, created_at, gym_lat (to derive has_gym)
From `group_members`: user_id (to derive has_pact)

## Display columns

| Column | Source |
|---|---|
| Name / Username | profiles |
| Email | profiles |
| Registered | profiles.created_at |
| Onboarded | profiles.onboarding_complete |
| Weekly goal | profiles.weekly_goal |
| Has gym | profiles.gym_lat IS NOT NULL |
| In pact | group_members join |

## Files changed

- `src/app/admin/layout.tsx` — add nav
- `src/app/admin/users/page.tsx` — new RSC page
- `src/components/admin/users-table.tsx` — new presentational component
- `src/components/admin/user-overview.tsx` — make Registered count linkable

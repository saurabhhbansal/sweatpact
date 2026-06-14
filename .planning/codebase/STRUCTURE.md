# Directory Structure

**Analysis Date:** 2026-06-14

## Top Level

```
.
├── src/                  Application source
├── supabase/             Postgres migrations (and config)
├── public/               Static assets (PWA icons, manifest)
├── package.json          Scripts and dependencies
├── next.config.mjs       Next.js config (React strict mode)
├── tailwind.config.ts    Tailwind theme
├── tsconfig.json         TS config (ES2022, strict, "@/*" alias)
├── vitest.config.ts      Vitest config
├── vercel.json           Vercel cron schedule + deploy config
├── middleware.ts         (re-exported) — actual file at src/middleware.ts
├── DESIGN.md             Design notes
├── PRODUCT.md            Product spec
└── README.md
```

## `src/` Layout

```
src/
├── middleware.ts                 Session-refresh middleware
├── app/                          Next.js App Router
│   ├── layout.tsx                Root layout / app shell
│   ├── page.tsx                  Landing
│   ├── globals.css
│   ├── error.tsx / global-error.tsx / not-found.tsx
│   ├── (tabs)/                   Authenticated tab group
│   │   ├── dashboard/            Main check-in dashboard
│   │   ├── groups/               Group management
│   │   ├── cycle/                Current period / cycle view
│   │   ├── notifications/
│   │   ├── settings/
│   │   ├── shortcut/             iOS Shortcut setup
│   │   └── u/                    User profile pages
│   ├── onboarding/               username / gym / schedule / shortcut steps
│   ├── auth/callback/            Supabase auth callback
│   ├── login/ · signup/ · join/ · group/
│   └── api/                      Route Handlers (see below)
├── components/                   React components
│   └── ui/                       shadcn/ui primitives
└── lib/                          Domain logic + clients
    └── supabase/                 Client factories
```

## API Routes (`src/app/api/`)

One folder per resource; each leaf has a `route.ts`. 32 handlers total:

```
account/delete          auth/signout
challenges/{cancel,invite,invite-to-group,respond}
checkin                 cron/enforce
cycle/sharing           dispute · dispute/resolve
groups/{create,invite,join,leave,settings,remove-member,
        member-penalty,members/role,checkins/reverse}
gyms · gyms/[id]        health/period
notifications           period-records
places/{search,details} profile
push/subscribe          settlements
status                  username/check
users/search
```

## Domain Library (`src/lib/`)

| File | Purpose |
|------|---------|
| `checkin-reconciliation.ts` | Idempotent day/week check-in reconciliation (core) |
| `derived-status.ts` | Member status derivation, `EXCUSED_STATUSES` |
| `enforcement.ts` | Period close + penalty enforcement |
| `period-stats.ts` / `stats.ts` | Period and aggregate statistics |
| `money.ts` | Penalty / settlement money math |
| `time.ts` | IANA timezone-aware day math |
| `geo.ts` | Haversine distance for gym geo-verification |
| `groups.ts` | Group membership queries |
| `challenge-view.ts` | 1v1 challenge view model |
| `checkin-notify.ts` / `period-notify.ts` / `push.ts` | Notifications (web-push/VAPID) |
| `rate-limit.ts` | Postgres-backed rate limiting |
| `secure-compare.ts` | Constant-time secret comparison |
| `types.ts` / `utils.ts` | Shared types and helpers |
| `supabase/{browser,server,rsc,admin}.ts` | Supabase client factories by privilege |

## `supabase/migrations/`

Sequentially numbered SQL migrations (`0001_init.sql` … `0010_username_and_challenges.sql`+): schema, RLS policies, defaults, cleanup triggers, weekly-goal/rest-day features, usernames + challenges.

## Naming Conventions

- **Files:** kebab-case (`check-in-button.tsx`, `checkin-reconciliation.ts`)
- **Routes:** lowercase resource folders + `route.ts`; dynamic segments `[id]`; route groups `(tabs)`
- **Tests:** co-located `*.test.ts` beside the module (`time.test.ts` next to `time.ts`)
- **Components:** kebab-case file, PascalCase exports; UI primitives under `components/ui/`
- **Migrations:** zero-padded `NNNN_snake_case.sql`
- **Path alias:** `@/*` → `src/*` (tsconfig + vitest mirror)

## Where Things Live

| Need to… | Look in |
|----------|---------|
| Add an endpoint | `src/app/api/<resource>/route.ts` |
| Change a business rule | `src/lib/*.ts` (then add `*.test.ts`) |
| Adjust DB schema / RLS | new `supabase/migrations/NNNN_*.sql` |
| Add UI | `src/app/(tabs)/...` + `src/components/` |
| Touch auth/session | `src/middleware.ts`, `src/lib/supabase/*.ts` |

---

*Structure analysis: 2026-06-14*

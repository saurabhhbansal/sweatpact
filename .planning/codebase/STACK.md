# Technology Stack

**Analysis Date:** 2026-06-14

## Languages

**Primary:**
- TypeScript 5.6.2 - All application and library code in `src/`
- TSX - React components with JSX syntax

**Secondary:**
- JavaScript - Configuration files (Next.js, Tailwind, PostCSS, Vitest config)
- SQL - Postgres database migrations in `supabase/migrations/`

## Runtime

**Environment:**
- Node.js (via Next.js runtime)
- Browser (React 18.3.1)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 14.2.35 - Full-stack React framework with App Router, API routes, SSR/RSC
- React 18.3.1 - UI component library

**UI:**
- Radix UI - Headless component library (react-dialog, react-dropdown-menu)
- Tailwind CSS 3.4.13 - Utility-first CSS framework
- shadcn/ui - Pre-built component system (imported via Radix UI primitives)
- Lucide React 0.468.0 - SVG icon library

**Utilities:**
- Zod 3.23.8 - TypeScript-first schema validation and data parsing
- Class Variance Authority 0.7.0 - Component class composition
- clsx 2.1.1 - Conditional className utility
- Tailwind Merge 2.5.4 - Smart Tailwind class merging
- Tailwindcss-Animate 1.0.7 - Tailwind animation utilities
- react-easy-crop 5.5.7 - Image cropping component
- @vvo/tzdb 6.198.0 - Timezone database
- web-push 3.6.7 - Web Push Notifications (VAPID)

**Testing:**
- Vitest 4.1.7 - Unit test runner with Vite integration
- Configuration: `vitest.config.ts`
- Test files: `src/**/*.test.ts` pattern

**Build/Dev:**
- Tailwind CSS 3.4.13 - CSS generation and compilation
- PostCSS 8.4.47 - CSS transformations
- Autoprefixer 10.4.20 - Vendor prefix automation
- ESLint 8.57.1 - Linting with Next.js preset
- TypeScript 5.6.2 - Type checking and compilation

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.45.4 - Supabase client SDK (auth, database, real-time)
- @supabase/ssr 0.5.2 - Supabase server-side rendering helpers for Next.js
- web-push 3.6.7 - VAPID-based Web Push notifications

**Infrastructure:**
- zod 3.23.8 - Runtime schema validation (all API routes)

## Configuration

**Environment:**
- `.env.local` (development) - Local development configuration
- `.env.example` - Example template with all required variables
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (safe for browser)
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase server-only role key (never exposed to client)
  - `NEXT_PUBLIC_SITE_URL` - Application base URL
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Web Push public VAPID key (browser)
  - `VAPID_PRIVATE_KEY` - Web Push private VAPID key (server-only)
  - `VAPID_SUBJECT` - Web Push subject email (default: mailto:support@sweatpact.app)
  - `GOOGLE_MAPS_API_KEY` - Google Places API key (server-side only)
  - `CRON_SECRET` - Bearer token for Vercel Cron authorization

**Build:**
- `tsconfig.json` - TypeScript configuration (ES2022 target, strict mode, path aliases `@/*`)
- `next.config.mjs` - Next.js config with React strict mode enabled
- `postcss.config.mjs` - PostCSS plugins (Tailwind CSS, Autoprefixer)
- `tailwind.config.ts` - Tailwind theming (dark mode class-based, custom color scheme with CSS variables)
- `.eslintrc.json` - ESLint extends `next/core-web-vitals`
- `vitest.config.ts` - Vitest config with path alias mirror, threads pool, test file pattern

## Platform Requirements

**Development:**
- Node.js (v18+, per Next.js 14 support matrix)
- npm (v9+)
- Supabase account (local or cloud)
- Google Maps API credentials (for gym search feature)
- VAPID keypair generation via `npx web-push generate-vapid-keys`

**Production:**
- Deployment target: Vercel (optimized for Next.js)
- Vercel Cron for scheduled enforcement job (`/api/cron/enforce` at 19:00 UTC daily)
- Supabase cloud project (database, auth, storage)
- Vercel environment variables for all secrets

---

*Stack analysis: 2026-06-14*

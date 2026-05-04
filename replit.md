# CaliCoach

## Overview

A calisthenics motion capture coaching app. Uses the device camera with MediaPipe Pose for real-time body tracking, counts reps automatically based on joint angles, speaks audio coaching cues via Web Speech API, and tracks workout history and form scores over time.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/cali-coach), served at `/`
- **API framework**: Express 5 (artifacts/api-server), served at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Pose detection**: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
- **Charts**: Recharts
- **Styling**: Tailwind CSS v4, dark athletic theme (neon green `#00FF00` primary)

## Authentication

- **Provider**: Clerk (whitelabel, dev keys in `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`)
- Sign-in/sign-up pages at `/sign-in` and `/sign-up` with dark Clerk theme
- `ProfileSync` component auto-creates a DB profile on first sign-in
- Server-side: `@clerk/express` middleware via `clerkMiddleware()` in `app.ts`

## Key Features

- Real-time pose detection via MediaPipe Pose Landmarker
- Rep counting from joint angle analysis (elbow, knee, hip angles)
- Live form score (0-100) with exponential moving average smoothing
- Audio coaching cues via Web Speech API, throttled to 4s intervals
- Session tracking: create, log reps, complete sessions
- Progress dashboard: form score timeline, per-exercise progress, streaks
- **Social layer**: friends (search by username, send/accept/reject requests), shared profiles (skill tree + form mastery), privacy controls (Public / Friends Only / Private)
- **Leaderboard**: Global top-100, National (country auto-detected via CF-IPCountry or Accept-Language), Friends-only — mastery points computed from skill tree (L1=100 pts … L5=500 pts, max 6,000). Sticky "Your Rank" bar always visible at bottom of the page.
- **Level Up Celebration**: When a user masters an Elite (level 5) skill → full-screen gold confetti animation (canvas-confetti), a Mastery Badge on their profile, and a shoutout auto-posted to the Social Feed visible to friends.

## Exercises & Skill Tree

**24 skills across 4 branches** (previously 20). Each skill has a `type`: `standard | static | explosive`.

### PUSH (6 skills)
Wall Push-Up → Incline → Knee → Push-Up → Diamond Push-Up → **Handstand Push-Up** (satellite, parallel L5)

### PULL (8 skills — forked after L2)
Scapular Shrugs → Australian Rows → Negative Pull-Ups → Pull-Up, then forks into:
- **Front Lever Path** (static): Tuck Front Lever → Straddle Front Lever → Full Front Lever
- **Muscle-Up Path** (explosive): Explosive Pull-Up → Muscle-Up (x2 nodes)

### CORE (5 skills)
Plank (static) → Burpee Basics → Burpee Conditioning → **Dragon Flag** (static) → **Human Flag** (static)

### LEGS (5 skills)
Assisted Squat → Squat → Archer Squat → **Nordic Curls** → Pistol Squat

### Static Hold Timer
Static exercises (`isStatic: true` in `ExerciseConfig`) use a Hold Timer instead of a rep counter:
- `processFrame` returns `isHoldActive: boolean` — true when all joints are within ±10° of target
- Timer only ticks while `isHoldActive === true` ("Active Zone")
- Green glow border + "Zone Active" badge when in zone; red border + "Adjust Position" when not
- TTS milestone coaching every 5 seconds held
- `totalReps` saved to DB = seconds held (integer)
- Session Results shows formatted hold time (e.g. "45s" or "1m 30s") instead of "reps"

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema

- `exercises` — exercise definitions with coaching cues
- `sessions` — workout sessions (exerciseId, userId FK, reps, form score, timestamps)
- `reps` — individual rep logs (formScore, durationMs, feedbackGiven)
- `users` — Clerk-linked profiles (clerkId, username, displayName, avatarUrl, privacyLevel, country varchar(2))
- `friendRequests` — friendship edges (fromUserId, toUserId, status: pending/accepted/rejected)
- `shoutouts` — elite skill mastery announcements (userId FK, skillId, skillTitle, branch, createdAt). Unique constraint on (userId, skillId) prevents duplicates.

## API Routes

- `GET /api/exercises` — list exercises
- `GET /api/exercises/:id` — exercise detail
- `GET /api/sessions` — list sessions (paginated)
- `POST /api/sessions` — create session
- `GET /api/sessions/:id` — session detail with reps
- `PATCH /api/sessions/:id` — complete/update session
- `GET /api/sessions/:sessionId/reps` — list reps
- `POST /api/sessions/:sessionId/reps` — log a rep
- `GET /api/progress/summary` — overall stats
- `GET /api/progress/by-exercise` — per-exercise breakdown
- `GET /api/progress/timeline` — form score over time
- `GET /api/progress/recent-sessions` — recent sessions summary

### Social API Routes

- `GET /api/users/me` — current user's profile
- `POST /api/users/me` — create/upsert profile (username, displayName, avatarUrl)
- `PUT /api/users/me` — update username/displayName
- `PUT /api/users/me/privacy` — update privacy level (public/friends/private)
- `GET /api/users/search?q=` — search users by username or display name
- `GET /api/users/:username` — public profile (privacy-aware; includes skill tree sessions)
- `GET /api/friends` — list accepted friends
- `GET /api/friends/requests` — incoming + outgoing pending requests
- `POST /api/friends/requests` — send friend request (body: { username })
- `PUT /api/friends/requests/:id` — accept or reject a request
- `DELETE /api/friends/:friendId` — remove a friend

### Frontend Pages

- `/` — landing (signed-out) or dashboard (signed-in)
- `/sign-in`, `/sign-up` — Clerk auth pages (no sidebar)
- `/friends` — search athletes, manage requests, friend list
- `/profile/:username` — public profile with skill tree + form mastery ring
- `/settings` — edit display name/username, privacy toggle, sign out
- `/leaderboard` — Global / National / Friends tabs; sticky rank footer
- `/` (dashboard) — includes Friends Activity feed showing Elite shoutouts from self + friends

### Level Up System

**Detection** (`SkillWatcher` component, mounted in Layout):
- Polls `GET /api/skills/mastered` on window focus + 15s stale time
- First load: marks ALL mastered skills as "seen" in `localStorage['celebrated:${userId}']` — no false celebrations
- Subsequent loads: new elite (level 5) skills not in localStorage → enqueues celebration

**Celebration** (`CelebrationOverlay` component):
- `canvas-confetti` fired in three waves (0s, 1.6s, 3.2s) — gold/amber palette
- React portal renders modal over entire viewport (z-9999)
- Branch-colored badge circle, skill title, countdown bar (7s auto-close)
- On close → POSTs shoutout to `/api/shoutouts` (idempotent)

**Social Feed** (`SocialFeed` component on Dashboard):
- `GET /api/feed` returns last 30 shoutouts from self + friends
- Each entry: avatar, "[Name] just mastered [SkillTitle] 🏆", time-ago
- Refetches on window focus

**Profile Mastery Badges**:
- Elite skills (level 5) with `status === "mastered"` shown as gold-bordered pills on profile page
- Branch-colored (orange/blue/violet/emerald) with star ★ indicator

### Feed API

- `GET /api/skills/mastered` — auth required; returns mastered skills with full metadata (id, level, levelName, title, branch)
- `POST /api/shoutouts` — auth required; idempotent (ON CONFLICT DO NOTHING)
- `GET /api/feed` — returns shoutouts from self + friends; empty array for unauthenticated users

### Leaderboard API

- `GET /api/leaderboard/global` — top-100 by mastery points (all users)
- `GET /api/leaderboard/national` — top-100 in detected country (CF-IPCountry → Accept-Language fallback)
- `GET /api/leaderboard/friends` — friends-only ranking (auth required)
- Each response: `{ entries[], myRank, myPoints, myMasteredSkills, country }`

### Mastery Points

Computed in `artifacts/api-server/src/lib/skillTree.ts` — mirrors frontend `evaluateSkillTree`:
- A skill is mastered when qualifying sessions ≥ minQualifyingSessions (no prerequisite check, same as frontend)
- Points: level × 100 per mastered skill (L1=100, L2=200, L3=300, L4=400, L5=500)
- 24 skills across 4 branches → max 6,000 pts

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

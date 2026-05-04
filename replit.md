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

## Exercises

Push-Up, Squat, Pull-Up, Dip, Lunge, Burpee — each with coaching cues and target joints.

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
- `users` — Clerk-linked profiles (clerkId, username, displayName, avatarUrl, privacyLevel)
- `friendRequests` — friendship edges (fromUserId, toUserId, status: pending/accepted/rejected)

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

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

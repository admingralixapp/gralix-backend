# CaliCoach

CaliCoach is a calisthenics motion capture coaching app that provides real-time feedback, rep counting, and workout tracking to help users improve their form and achieve their fitness goals.

## Run & Operate

- `pnpm run typecheck`: Typecheck all packages.
- `pnpm run build`: Typecheck and build all packages.
- `pnpm --filter @workspace/api-spec run codegen`: Regenerate API hooks and Zod schemas from OpenAPI spec.
- `pnpm --filter @workspace/db run push`: Push database schema changes (development only).
- `pnpm --filter @workspace/api-server run dev`: Run the API server locally.

Required Environment Variables:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval
- **Build**: esbuild
- **Pose detection**: MediaPipe Tasks Vision
- **Charts**: Recharts
- **Styling**: Tailwind CSS v4, dark athletic theme (neon green primary)
- **Auth**: Clerk

## Where things live

- `artifacts/cali-coach`: Frontend application (React + Vite).
- `artifacts/api-server`: Backend API (Express 5).
- `artifacts/api-spec`: OpenAPI specification for API codegen.
- `artifacts/cali-coach/src/lib/ghost-poses.ts`: Ghost Mode AR Overlay configurations.
- `artifacts/api-server/src/lib/skillTree.ts`: Logic for skill tree evaluation and mastery points.
- `artifacts/cali-coach/src/lib/skill-tree.ts`: All 32 skill node definitions, `evaluateSkillTree()`, `ALL_SKILL_NODES`.
- `artifacts/cali-coach/src/components/skill-map.tsx`: Dashboard Dynamic Window (3 nodes/branch).
- `artifacts/cali-coach/src/pages/skill-tree.tsx`: SVG pan/zoom tech-tree (NODE_POS, EDGES, TreeCanvas, SkillOverlay).
- `exercise-registry.ts`: AI coaching configurations and exercise definitions.
- Database Schema: Defined in Drizzle ORM, consult the `artifacts/db` package for the schema.
- API Routes: Detailed within `artifacts/api-server/src/routes`.
- Frontend Pages: Organized in `artifacts/cali-coach/src/pages`.

## Architecture decisions

- **Monorepo with pnpm workspaces**: Enables shared code and consistent dependency management across frontend and backend.
- **MediaPipe for real-time pose detection**: Chosen for its on-device processing capabilities, ensuring low latency and privacy.
- **Drizzle ORM**: Provides a type-safe interface for database interactions, leveraging TypeScript benefits.
- **Clerk for authentication**: Offloads authentication complexities, providing a robust and customizable user management system.
- **Blended form score**: Combines joint angle form score with Ghost Sync percentage to ensure comprehensive form evaluation, encouraging both correct movement and adherence to the visual guide.

## Product

- Real-time calisthenics coaching with rep counting and form scoring.
- Audio coaching cues.
- Workout history and progress tracking with a dashboard.
- Manual logging option for sessions without camera use.
- Anti-cheat/verification system for AI-coached sessions.
- Social features: friend management, shared profiles with skill trees and mastery.
- Daily Mobility System with guided routines and streak tracking.
- Global, national, and friends leaderboards based on mastery points.
- Level-up celebration with confetti and social shoutouts for elite skill mastery.
- Community video feed for sharing and interacting with workout posts.

## User preferences

_Populate as you build_

## Gotchas

- **DB Schema Changes**: Always run `pnpm --filter @workspace/db run push` after making changes to the Drizzle schema.
- **API Spec Regeneration**: If the OpenAPI spec changes, regenerate client hooks and Zod schemas with `pnpm --filter @workspace/api-spec run codegen`.
- **Verified Sessions**: Only `isVerified: true` sessions contribute to leaderboard mastery points. Manual logs are always unverified.
- **Ghost Sync Gating**: Rep counting and hold timers are gated by Ghost Sync; ensure you are within 85% sync for progress to register.

## Pointers

- **MediaPipe Pose**: Refer to the official MediaPipe documentation for pose detection details.
- **Clerk**: Consult Clerk documentation for advanced authentication features and customization.
- **Drizzle ORM**: See Drizzle ORM documentation for database query patterns and schema migrations.
- **Tailwind CSS**: For styling customizations, refer to the Tailwind CSS v4 documentation.
- **Orval**: Documentation for API client generation from OpenAPI specifications.
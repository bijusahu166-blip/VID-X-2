# Overview

**LITLink (VID-X)** — a mobile-first dark-themed social media platform built with React + Express + PostgreSQL. Features: Home feed, Search, Reels, Reading, full-featured Messages (with 1-to-1 chat, voice notes, media sharing, AI translation, smart replies, polls, location, disappearing messages, reactions, pinning, chat themes), Video Calling with 4K HD + 81 AR filters + screen sharing + recording, and AI assistant. Uses Replit Auth (OIDC) for authentication.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend (React SPA)
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter (lightweight alternative to React Router) with client-side routes: `/`, `/search`, `/reels`, `/messages`, `/profile`
- **State Management**: TanStack React Query for server state (caching, mutations, refetching)
- **UI Components**: shadcn/ui (New York style) with Radix UI primitives, Tailwind CSS for styling
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Design**: Mobile-first Instagram-like aesthetic with bottom navigation bar (Home, Reels, DMs, Explore, Profile) and a sticky header with create button (top-left) and notifications (top-right)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

## Backend (Express API)
- **Framework**: Express.js running on Node with TypeScript (via tsx)
- **Port**: Runs on port 5001 (mapped to external port 80 in .replit). Workflow command: `PORT=5001 npm run dev`
- **Body Limit**: express.json and express.urlencoded both set to 50MB (for base64 image/photo uploads)
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **Build**: Vite for client, esbuild for server bundling (output to `dist/`)
- **Dev Server**: Vite dev middleware with HMR in development; static file serving in production
- **Logging**: Custom request logger for all `/api` routes with timing

## Database
- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (re-exports from `shared/models/auth.ts` and `shared/models/chat.ts`)
- **Migrations**: Drizzle Kit with `drizzle-kit push` command (`npm run db:push`)
- **Tables**:
  - `users` - User profiles (id, email, firstName, lastName, profileImageUrl, timestamps)
  - `sessions` - Express session storage for Replit Auth (sid, sess JSON, expire)
  - `posts` - Feed posts (id, userId, imageUrl, caption, type, createdAt)
  - `comments` - Post comments (id, postId, userId, content, createdAt)
  - `likes` - Post likes (id, postId, userId)
  - `conversations` - AI chat conversations (id, title, createdAt)
  - `messages` - AI chat messages (id, conversationId, role, content, createdAt)
- **Relations**: Drizzle relations defined between posts↔users, posts↔comments, posts↔likes, comments↔users

## Authentication
- **Method**: Custom email/password auth (bcryptjs password hashing)
- **Flow**: `POST /api/auth/register` → creates user; `POST /api/auth/login` → sets session; `POST /api/auth/logout` → destroys session
- **Session**: Express sessions stored in PostgreSQL via `connect-pg-simple`, session userId stored as `req.session.userId`
- **Middleware**: `isAuthenticated` checks `req.session.userId`
- **Client Hook**: `useAuth()` fetches current user from `GET /api/auth/user`; logout uses POST (no Replit redirect)
- **Login Page**: Custom dark VID-X branded login/signup page (`client/src/pages/Login.tsx`) with animated tabs
- **Test accounts**: alice@example.com / password123, bob@example.com / password123

## Key API Routes
- `GET/POST /api/posts` - List and create posts
- `GET /api/posts/:id` - Get single post with relations
- `POST /api/posts/:id/like` - Toggle like on a post
- `POST /api/posts/:id/comments` - Add comment to a post
- `GET/POST /api/conversations` - AI chat conversations (CRUD)
- `POST /api/conversations/:id/messages` - Send message with SSE streaming response
- `POST /api/generate-image` - AI image generation
- `GET /api/auth/user` - Get authenticated user

## Replit Integrations (server/replit_integrations/)
These are modular integration packages:
- **auth/** - Replit Auth with OIDC, session management, user storage
- **chat/** - AI chat with OpenAI-compatible API, SSE streaming responses
- **image/** - AI image generation using `gpt-image-1` model
- **audio/** - Voice chat with speech-to-text, text-to-speech, audio format detection
- **batch/** - Batch processing utility with rate limiting and retries

## Shared Code (shared/)
- `schema.ts` - Central Drizzle schema definitions and Zod validation schemas
- `routes.ts` - API route definitions with Zod response schemas (typed API contract)
- `models/auth.ts` - User and session table definitions
- `models/chat.ts` - Conversation and message table definitions

# External Dependencies

## Required Services
- **PostgreSQL Database** - Primary data store (must be provisioned, `DATABASE_URL` env var required)
- **Replit Auth (OIDC)** - Authentication provider (`ISSUER_URL`, `REPL_ID` env vars)
- **OpenAI-compatible API** - Powers AI chat, image generation, and audio features (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars)
- **Session Secret** - Required for express-session (`SESSION_SECRET` env var)

## Key NPM Packages
- **Frontend**: React, Wouter, TanStack React Query, Framer Motion, shadcn/ui, Radix UI, Tailwind CSS, date-fns, embla-carousel-react
- **Backend**: Express, Drizzle ORM, Passport (OIDC), connect-pg-simple, OpenAI SDK, nanoid
- **Shared**: Zod (validation), drizzle-zod (schema-to-zod conversion)
- **Build**: Vite, esbuild, tsx (TypeScript execution)
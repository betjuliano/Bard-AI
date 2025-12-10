# IA Transcreve - Transcription & Qualitative Analysis SaaS

## Overview

IA Transcreve is a SaaS platform designed for researchers to transcribe audio interviews and perform qualitative content analysis using AI. The application provides automatic audio transcription via OpenAI's Whisper model and content analysis based on Laurence Bardin's methodology. Users get one free transcription (up to 10MB), then purchase credits for additional transcriptions and analyses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens defined in CSS variables
- **Theme Support**: Light/dark mode with system preference detection

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints prefixed with `/api/`
- **File Uploads**: Multer middleware for handling audio file uploads (max 100MB)
- **Authentication**: Replit Auth via OpenID Connect with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL using connect-pg-simple

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Tables**: users, sessions, transcriptions, analyses, payments
- **Migrations**: Managed via drizzle-kit with output to `./migrations`

### AI Integration
- **Transcription**: OpenAI Whisper API (`whisper-1` model) for Portuguese language audio
- **Analysis**: OpenAI GPT for qualitative content analysis following Bardin's methodology
- **Service Location**: `server/openai.ts`

### Build System
- **Development**: Vite dev server with HMR for frontend, tsx for backend
- **Production**: esbuild bundles server code, Vite builds client to `dist/public`
- **Bundling Strategy**: Server deps allowlisted for bundling to optimize cold starts

### Key Design Patterns
- **Shared Types**: Zod schemas generated from Drizzle for validation across stack
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Query Client**: Centralized fetch wrapper with automatic JSON handling and auth error detection
- **Path Aliases**: `@/` for client, `@shared/` for shared code

## External Dependencies

### Third-Party Services
- **OpenAI API**: Audio transcription (Whisper) and text analysis (GPT)
- **Replit Auth**: User authentication via OIDC
- **Stripe**: Payment processing for credit purchases (referenced in schema)

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `SESSION_SECRET`: Express session encryption key
- `REPL_ID`: Replit environment identifier (for auth)
- `ISSUER_URL`: OIDC issuer (defaults to Replit)
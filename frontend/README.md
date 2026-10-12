# Veriqo — Frontend Telemetry Dashboard & AI QA Console

The **Veriqo** frontend is a high-performance Next.js 16 dashboard and QA console designed with a neo-brutalist Stitch design identity. It connects to the Veriqo FastAPI backend for autonomous browser journey execution, live defect tracking, Show Me Mode diagnostics, BlindReplay verification, and cryptographic QA certificate auditing.

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router, React 19)
- **Styling**: Tailwind CSS & Neo-Brutalist Stitch UI (cream background, ink borders, offset shadows)
- **Typography**: Space Grotesk, Inter, JetBrains Mono
- **Data Layer**: Centralized typed API client (`lib/api-client.ts`) and Gateway Bridge (`lib/backend-bridge.ts`)
- **Icons**: Inline SVG vector icons (no external webfont dependency)

## Directory Structure

```text
frontend/
├── app/
│   ├── layout.tsx                     # Root layout with sidebar & Veriqo theme
│   ├── page.tsx                       # Dashboard / Command Center redirect
│   ├── command-center/page.tsx        # Command Center live telemetry & swarm health
│   ├── projects/page.tsx              # Target apps, creation modal & QA certificates
│   ├── test-runs/page.tsx             # Test run execution, active logs & screenshots
│   ├── bug-reports/page.tsx           # Defects, Show Me Mode & BlindReplay triggers
│   ├── test-library/page.tsx          # Saved regression baselines & execution
│   ├── analytics/page.tsx             # Quantitative QA metrics & defect distributions
│   ├── integrations/page.tsx          # CI/CD, GitHub, Slack webhooks configuration
│   ├── settings/page.tsx              # System environment & engine settings
│   └── api/v1/                        # Next.js API Gateway / BFF route handlers
│       ├── health/route.ts            # Probes FastAPI /health & /ready
│       ├── projects/route.ts          # TargetApp queries & registration
│       ├── test-runs/                 # Playwright journey dispatch & log streaming
│       ├── bug-reports/               # Defect CRUD, Show Me, Fix Prompt & BlindReplay
│       ├── certificates/              # Scoring & dual-mode tamper verification
│       ├── test-library/              # Regression journeys bridge
│       ├── analytics/                 # Aggregated metrics bridge
│       └── evidence/[...path]/        # Secure screenshot streaming proxy
├── components/
│   ├── Navigation.tsx                 # Neo-brutalist navigation sidebar
│   ├── TopHeader.tsx                  # Engine status badge & global controls
│   ├── certificates/                  # Deterministic QA Certificate Modal & Verifier
│   ├── evidence/                      # Critical defect cards & evidence preview
│   └── agents/                        # Swarm activity, terminal logs & live preview
├── lib/
│   ├── api-client.ts                  # Client-side typed API interface
│   ├── backend-bridge.ts              # Server-side Next.js -> FastAPI gateway client
│   └── types.ts                       # Shared TypeScript data models
└── public/                            # Static assets
```

## Setup & Running (Windows PowerShell)

### 1. Install Dependencies

```powershell
cd frontend
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

Default variables in `.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws
```

### 3. Run Development Server

```powershell
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

### 4. Build for Production

```powershell
npm run build
npm run start
```

## Verification & Quality Checks

Run the linter and type-checker:

```powershell
npm run lint
npx tsc --noEmit
```

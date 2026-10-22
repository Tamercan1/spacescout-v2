# SpaceScout — Project Context

## Overview

SpaceScout is an AI-powered space exploration application originally built as a CS50 Web Programming with Python and JavaScript final project.

The application allows users to ask questions about space in natural language. An AI planner interprets the request, dynamically coordinates NASA data sources, retrieves observational data through NASA APIs, and returns structured discoveries and contextual synthesis to the user.

SpaceScout V2 is the production-ready evolution of the project. It features an additive multi-turn exploration model, Bring Your Own Key (BYOK) credential encryption, navigation-safe state preservation, borderless error UX, and a responsive modern design system deployed to live cloud infrastructure.

---

## Current Technology Stack

### Frontend

* React 19
* TypeScript
* Vite
* React Router
* Axios (with centralized JWT token refresh interceptor)
* Lucide React (icons)
* React Markdown
* Testing: Vitest, React Testing Library, @testing-library/jest-dom, @testing-library/user-event, jsdom
* Production Hosting: Vercel ([https://spacescout.vercel.app](https://spacescout.vercel.app)) with SPA rewrites (`vercel.json`)

### Backend

* Python 3.12
* Django 6
* Django REST Framework
* SimpleJWT
* Pydantic
* Cryptography (Fernet symmetric encryption for BYOK credentials)
* OpenAI SDK (for LLM communication via OpenRouter)
* httpx & requests (for NASA API requests and validation)
* Database: Aiven PostgreSQL in production (`dj-database-url`, `psycopg` with SSL connection pooling); SQLite for local development and automated testing
* Production Web Server: Gunicorn (2 workers, 4 threads, 120s timeout) + WhiteNoise for compressed static asset serving
* Production Hosting: Render Web Service ([https://spacescout.onrender.com](https://spacescout.onrender.com))
* uv (fast package management and dependency locking)

### External Services

* OpenRouter for LLM access (with user BYOK or shared fallback)
* NASA APIs for space-related data (APOD, NeoWs, DONKI, NASA Images, EPIC)
* Aiven Cloud PostgreSQL

---

## Production Deployment & Hosting

SpaceScout V2 is deployed across live cloud services:

* **Frontend**: Hosted on Vercel at [https://spacescout.vercel.app](https://spacescout.vercel.app).
  * Build command: `npm run build` (`tsc -b && vite build`).
  * Output directory: `dist`.
  * Single-Page Application (SPA) routing is handled by `frontend/vercel.json` rewrites redirecting all client routes to `/index.html`.
  * Environment configuration: `VITE_API_URL` points to the production Render backend.

* **Backend**: Hosted on Render as a Web Service at [https://spacescout.onrender.com](https://spacescout.onrender.com).
  * WSGI Server: Gunicorn running with 2 worker processes, 4 threads per worker, and a 120-second timeout to accommodate multi-turn LLM and NASA API tool loops.
  * Static Assets: Collected and compressed via WhiteNoise (`CompressedStaticFilesStorage`).
  * Proxy SSL: Render terminates TLS at the edge and forwards HTTP traffic with `HTTP_X_FORWARDED_PROTO = 'https'`. Configured via `SECURE_PROXY_SSL_HEADER`.
  * Health Endpoint: Dedicated unauthenticated health check probe at `/api/health/` (and `/health/`) returning database connectivity status, exempt from SSL redirection (`SECURE_REDIRECT_EXEMPT`).

* **Database**: Hosted on Aiven Cloud PostgreSQL.
  * Connected via `DATABASE_URL` with SSL connection pooling (`sslmode=require`, `conn_max_age=600`, `conn_health_checks=True`).

---

## Current Architecture

The current high-level request flow is:

```text
User
  ↓
React + TypeScript (Vite)
  ↓
Django REST API (/api/plans/<id>/interactions/)
  ↓
Interaction Execution Service
  ↓
Generic AI Orchestrator (Multi-Turn Tool Loop)
  ↓
LLM Provider (OpenRouter via BaseLLMProvider)
  ↓
V2 Tool Registry (BaseTool subclasses)
  ↓
NASA Service Layer (APOD, NeoWs, DONKI)
  ↓
NASA APIs
  ↓
Structured Tool Results
  ↓
Post-Tool LLM Enrichment (Contextual 'why_interesting' Analysis)
  ↓
Result Persistence Service (Deduplication & Atomicity)
  ↓
Database Persistence (SpacePlan, Discovery, DiscoveryMedia, Interaction)
  ↓
React UI (InteractionStream & Dynamic Result Cards)
```

The backend uses a modular tool registry (`api/engine/tool_registry_v2.py`) mapping registered `BaseTool` instances to descriptions, schemas, and execution handlers with credential injection.

Current NASA capabilities include:

* Astronomy Picture of the Day (`apod`)
* Near Earth Object Web Service (`neows`)
* DONKI Solar Flare data (`donki`)
* NASA Image and Video Library search (`nasa_images`)
* NASA EPIC Deep-Space Earth Imagery (`epic`)


---

## Current Planner & Orchestrator

The AI execution engine (`GenericOrchestrator`) is responsible for:

* interpreting natural-language prompts in the context of previous exploration discoveries
* dynamically selecting and invoking relevant NASA tools via OpenAI function schemas
* validating tool call arguments against declared schemas before execution
* suppressing duplicate failed tool invocations (`failed_tool_signatures`)
* executing up to 5 tool-call rounds per interaction
* synthesizing NASA data into concise summaries without repeating raw card contents
* running an LLM enrichment pass to generate contextual, creative `why_interesting` insights
* normalizing results into `OrchestratorResult` for frontend rendering and database storage
* enforcing model selection from `UserProfile.preferred_model` with application fallbacks

The orchestrator remains independent of presentation concerns and communicates through provider abstractions.

---

## Current Data Model

The V2 data model is fully implemented:

```text
User
 │
 ├── UserProfile
 │     ├── preferred_model
 │     ├── theme (dark | light)
 │     └── onboarding_completed_at
 │
 ├── ProviderCredential
 │     ├── provider (openrouter | nasa)
 │     ├── encrypted_key (Fernet encrypted)
 │     ├── key_hint (masked preview)
 │     ├── is_valid
 │     └── last_validated_at
 │
 └── SpacePlan (one per exploration)
       ├── title
       ├── prompt
       ├── summary
       ├── status (pending | processing | completed | failed)
       ├── is_archived
       │
       ├── Discovery[]
       │     ├── source (apod | neows | donki)
       │     ├── external_id (for deduplication)
       │     ├── source_url
       │     ├── type, title, date
       │     ├── summary, why_interesting
       │     ├── facts, tags, details (JSON)
       │     ├── sort_order
       │     │
       │     └── DiscoveryMedia[]
       │           ├── media_type (image | video | other)
       │           ├── url, thumbnail_url
       │           ├── caption
       │           ├── is_primary
       │           └── order
       │
       └── Interaction[]
             ├── user_prompt
             ├── interaction_type (find_more | enrich | compare | related | other)
             ├── status (pending | processing | completed | failed)
             ├── response (JSON)
             ├── error_code
             ├── target_discoveries (M2M → Discovery)
             ├── added_discoveries (M2M → Discovery)
             └── completed_at
```

### V2 domain decisions

* One `SpacePlan` represents one continuous exploration.
* Follow-up interactions belong to the same `SpacePlan` via the `Interaction` model.
* New explorations create independent `SpacePlan` records.
* There is no parent-child `SpacePlan` relationship.
* Follow-ups are additive: discoveries are not silently deleted.
* Filtering is a view operation, not a database deletion.
* `Discovery` uses `external_id` with a unique constraint per plan and source to prevent duplicate discoveries within the same exploration.
* `DiscoveryMedia` is separated from `Discovery` with a primary-media constraint.
* `Interaction` tracks which discoveries were targeted and which were added as a result.

---

## Current API

The backend exposes REST endpoints for:

```text
# Health & Status Probes
GET    /api/health/                          — Unauthenticated health check returning database connectivity
GET    /health/                              — Dual-routed root unauthenticated health probe

# Authentication & User Profile
POST   /api/register/                        — User registration
POST   /api/auth/token/                      — Obtain JWT access/refresh token pair
POST   /api/auth/token/refresh/              — Refresh access token
GET    /api/auth/me/                         — Retrieve current user profile & preferences
PATCH  /api/auth/me/                         — Update user profile (theme, model preference)
POST   /api/auth/onboarding/complete/        — Complete first-time user onboarding tour

# Explorations (SpacePlans)
GET    /api/plans/                           — List user explorations (?archived=true/false, ?status=..., search, ordering)
POST   /api/plans/create/                    — Create new exploration from initial prompt
GET    /api/plans/<id>/                      — Retrieve full exploration with discoveries & interactions
PATCH  /api/plans/<id>/                      — Update exploration (title, is_archived)
DELETE /api/plans/<id>/                      — Delete exploration

# Interactions (Follow-up execution)
GET    /api/plans/<id>/interactions/         — List interactions for an exploration
POST   /api/plans/<id>/interactions/         — Execute follow-up prompt with AI orchestrator

# BYOK Credentials
GET    /api/credentials/                     — List configured credentials (masked hints)
POST   /api/credentials/                     — Save/update encrypted credential
DELETE /api/credentials/<provider>/          — Delete credential
POST   /api/credentials/<provider>/validate/ — Validate credential with external provider
```

> **Note**: Backend endpoints are dual-routed to support both `/api/` prefix and legacy root paths (e.g. `/api/auth/me/` and `/auth/me/`).

---

## Current Frontend Structure

The frontend is built on the approved design system with React 19, TypeScript, and Vite.

### Pages

* `Home` — Search input, prompt inspiration chips, quick launch into new explorations
* `Explore` — Active exploration view featuring exploration header, dynamic discovery grid, follow-up prompt dock, and chronological `InteractionStream`
* `Explorations` — Exploration library with search, archive filters, sort controls, and direct resume actions
* `Settings` — Tabbed settings interface for Profile, Theme selection, Model preference, and BYOK credential configuration
* `Onboarding` — First-time user welcome and orientation
* `Login` / `Register` — Authentication with JWT persistence
* `NotFound` — 404 handler

### Layout & Exploration Components

* `layout/AppShell` — Responsive application shell with desktop sidebar and mobile navigation
* `layout/AppNavbar` — Top navigation bar with branding, navigation links, and user menu
* `layout/AppSidebar` — Exploration history sidebar with collapsible drawers and quick actions
* `explore/InteractionStream` — Additive timeline rendering each interaction turn, user prompts, status badges, and synthesized responses
* `explore/InteractionResult` — Dynamic result switcher selecting the appropriate card renderer:
  * `ApodResultCard` — Media view with explanation and date
  * `NeowsResultCard` — Asteroid metrics, hazardous status indicator, miss distance
  * `DonkiResultCard` — Solar flare classification and timing data
  * `NasaImagesResultCard` — Media archive search preview grid, NASA center, and capture dates
  * `EpicResultCard` — DSCOVR Earth observations, L1 satellite coordinates, and timestamps
  * `GeneralResultCard` — Markdown-rendered synthesis sections and analysis

---

## Current Backend Structure

```text
backend/
  config/                  — Django project configuration (settings.py, urls.py, wsgi/asgi)
  api/
    models.py              — User, UserProfile, ProviderCredential, SpacePlan, Discovery, DiscoveryMedia, Interaction
    views.py               — API views (auth, plans, interactions, credentials)
    serializers.py         — DRF serializers with data validation
    urls.py                — URL routing table
    engine/
      contracts.py         — Core AI contracts (BaseOrchestrator, BaseLLMProvider, BaseTool, ToolResult)
      tool_registry_v2.py  — V2 ToolRegistry implementation
      orchestrator/        — GenericOrchestrator multi-turn execution engine
      providers/           — OpenRouterProvider with OpenAI client integration
      tools/nasa/          — APODTool, NeoWsTool, DONKITool BaseTool subclasses
    services/
      credentials.py       — Fernet encryption, BYOK resolution, key validation
      interaction_execution.py — Orchestrator invocation, idempotency, lifecycle management
      result_persistence.py    — Atomic discovery persistence and deduplication
      nasa/                — NASA API service clients (APOD, NeoWs, DONKI)
  manage.py
  pyproject.toml
```

---

## Authentication

The application currently uses:

* JWT access tokens
* JWT refresh tokens
* Protected frontend routes (`ProtectedRoute`, `PublicRoute`)
* Axios request interceptor with bearer token injection
* Automatic access-token refresh on 401 response

---

## Current Provider Configuration & BYOK

The application supports both system-level environment fallback credentials and user-level Bring Your Own Key (BYOK):

* **Resolution Precedence**: User BYOK key (if configured and valid) → System default fallback (`backend/.env`) → Missing-credential guidance.
* **Encryption at Rest**: Implemented in `api/services/credentials.py`. When a user saves an API key, it is encrypted with AES-128-CBC using Fernet symmetric encryption.
* **Production Key Requirement**: In production (`DEBUG=False`), a dedicated 32-url-safe base64-encoded `CREDENTIAL_ENCRYPTION_KEY` environment variable is strictly enforced at application startup.
* **Key Hinting & Zero Plaintext Leaks**: Keys are masked upon storage (`key_hint`, e.g., `sk-or-v1-••••••••••••abcd`). Plaintext API keys are never returned across API responses or logged.
* **Provider Validation**: Dedicated endpoints (`POST /api/credentials/<provider>/validate/`) validate keys against upstream OpenRouter and NASA APIs before saving.

---

## Exploration Lifecycle Handling & Error UX

Exploration creation and follow-up interaction execution are designed for resilience and user clarity:

* **Navigation-Safe State Preservation**: Active exploration creation lifecycle (`activeCreation`) and follow-up interaction state (`activeInteractionPlanId`) are managed centrally in `PlansContext`. In-flight generation progress, animated step status indicators, user prompts, and failure notices persist seamlessly when users navigate between `/explore`, `/`, `/settings`, and `/explorations`.
* **Concurrency & Deduplication Guards**: Concurrent duplicate creation requests return the existing in-flight promise rather than spawning duplicate backend runs. Follow-up interaction submissions are locked per-plan ID while active.
* **Safe Unmounting & Component Lifecycle**: Ref guards in `Explore.tsx` prevent state corruption and stale state updates when components unmount and remount during in-flight operations.
* **Stable Error Contracts**: `SpacePlanCreateView` returns HTTP 502 with structured error details and stable error codes (`error_code: "missing_credential"`). Internal exceptions, stack traces, IP addresses, and database credentials are strictly redacted.
* **Atmospheric, Borderless Error UX**: Replaced generic boxed alert cards with an atmospheric, borderless error presentation featuring a soft radial glow icon and contextual action buttons.
* **Actionable BYOK Guidance**: When an operation fails due to missing or invalid credentials, the error UI routes the user directly to `/settings?tab=credentials`, automatically activating the Credentials tab on both client navigation and direct page reload.

---

## Production Security Hardening

All production security requirements have been addressed and verified:

* **Secret Isolation**: `DJANGO_SECRET_KEY` is strictly required in production via environment variables; the application refuses to start if `DEBUG=False` and no secret key is provided.
* **Credential Encryption Key**: `CREDENTIAL_ENCRYPTION_KEY` is required in production and validated as a 32-url-safe base64 Fernet key at startup.
* **Host & Origin Whitelisting**: `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` are restricted to the production frontend (`https://spacescout.vercel.app`), local development hosts, and explicitly declared environment origins.
* **Secure Cookies & Transport**: `SESSION_COOKIE_SECURE = True` and `CSRF_COOKIE_SECURE = True` ensure session and CSRF tokens are only transmitted over HTTPS.
* **Browser Security Headers**: `X_FRAME_OPTIONS = 'DENY'` (clickjacking prevention) and `SECURE_CONTENT_TYPE_NOSNIFF = True` (MIME-type sniffing defense) are active.
* **Reverse Proxy TLS Handling**: `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` correctly handles Render edge proxy TLS termination.
* **Narrow SSL Redirect Exemption**: `SECURE_REDIRECT_EXEMPT` permits internal container probes to reach `/api/health/` without HTTP 301 redirection cycles.

---

## Operational Limitations & Known Constraints

* **Render Free-Tier Cold Starts**: The backend Web Service on Render automatically spins down after periods of inactivity. An initial request after an idle period may experience cold-start latency (~50s) while the container boots. The unauthenticated `/api/health/` probe can be utilized by external uptime monitors to minimize cold starts.
* **Client-Side In-Flight Durability**: In-flight creation and follow-up interaction states are managed in-memory within React `PlansContext`. This survives client-side route changes within the SPA, but does not survive a hard browser refresh (`F5`), tab closure, or backend container restart before the synchronous backend transaction completes and commits to PostgreSQL. Once completed, all explorations, discoveries, and interactions are durably stored in PostgreSQL.
* **Upstream AI Provider Quotas**: Free-tier or shared OpenRouter models are subject to upstream rate limits and capacity constraints. When shared capacity is exhausted, the application gracefully advises users to configure their own OpenRouter key in Settings.
* **HSTS Initial State**: `SECURE_HSTS_SECONDS` defaults to 0 to prevent browser lockouts on default provider-assigned subdomains (`*.onrender.com`). Strict HSTS should be enabled once a permanent custom domain is attached.

---

## Outstanding Configuration & Release Tasks

The core release is functional and verified in production. The following operational items remain for ongoing maintenance:

* **Custom Domain Mapping**: Attaching a custom domain (e.g., `spacescout.app` or similar) to both Vercel and Render.
* **HSTS Preload Activation**: Enabling `SECURE_HSTS_SECONDS = 31536000`, `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`, and `SECURE_HSTS_PRELOAD = True` following custom domain verification.
* **Automated External Uptime Ping**: Setting up a free periodic uptime probe (e.g. Better Uptime or Cron-Job.org) pinging `https://spacescout.onrender.com/api/health/` every 10 minutes to mitigate cold starts.
* **Streaming / Asynchronous Execution (Post-V2)**: Transitioning from long-running synchronous HTTP requests to Server-Sent Events (SSE) or WebSockets with background Celery/Redis workers.

---

## V1 → V2 Direction

The original V1 model was:

```text
Prompt → Generate → SpacePlan → Done
```

V2 operates as:

```text
Prompt
  ↓
Exploration (SpacePlan)
  ↓
Initial Discoveries
  ↓
Follow-up / Deep-dive / Compare (Interaction)
  ↓
AI Orchestrator + NASA Tools + Enrichment
  ↓
Additional discoveries + Contextual synthesis
  ↓
Exploration expands additively
  ↓
Resume anytime from Explorations library
```

---

## Development Status

SpaceScout V2 has completed all phases through Phase 7.5 (Release Finalization). The application is deployed and verified in production across Vercel (frontend), Render (backend), and Aiven PostgreSQL (database).

Verified by:
- 178 passing automated backend tests (`uv run python manage.py test api`), including end-to-end production readiness, error redaction, BYOK precedence, and health probe tests (`api.test_production_readiness`).
- 62 passing automated frontend tests across 11 test suites (`npm test` with Vitest and React Testing Library).
- Zero ESLint warnings or errors (`npm run lint`).
- Clean strict TypeScript production build (`npm run build`).
- Zero unapplied or missing Django database migrations.

The application is in Release v2.0.0 state. Current operational focus is post-release monitoring and user feedback collection.

---

## Guiding Principle

SpaceScout should evolve from a successful project prototype into a coherent, maintainable space exploration product without losing the underlying learning value and architectural clarity of the original project.

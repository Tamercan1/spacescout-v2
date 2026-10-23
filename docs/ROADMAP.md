# SpaceScout V2 — Roadmap

## Goal

Transform SpaceScout from the V1 project prototype into a polished, persistent, discovery-first space exploration application.

V2 should build on the existing system rather than rewrite it unnecessarily.

---

## Phase 1 — Product & Architecture Definition

**Status: Completed**

* Define the V2 product direction
* Define the Exploration concept
* Establish additive discovery behavior
* Define major V2 feature scope
* Define BYOK direction
* Identify additional NASA capabilities
* Define the high-level application structure
* Establish AI-assisted development rules
* Create project context documentation

---

## Phase 2 — Design Exploration

**Status: Completed**

Create standalone HTML mockups before changing the production React UI.

Explore:

* Home
* Explore / active Exploration
* Explorations list
* Exploration detail
* Settings
* BYOK configuration
* Authentication
* Discovery cards and detail views
* Responsive layouts
* Navigation

The initial mockup (`design/mockups/explore-professional-refined.html`) serves as the approved design reference. See `docs/DESIGN.md` for documentation.

---

## Phase 3 — V2 Architecture Preparation

**Status: Completed**

Review the existing codebase against the approved product and design direction.

Accomplished:

* Exploration domain model (`SpacePlan`, `Discovery`, `DiscoveryMedia`, `Interaction`)
* API structure (`api/urls.py`, viewsets, serializers)
* Credential resolution (`CredentialResolver`)
* BYOK architecture with Fernet symmetric encryption
* Discovery identity and deduplication (`external_id` constraint)
* Provider abstraction (`BaseLLMProvider`, `BaseTool`)
* NASA tool architecture and contracts (`ToolRegistry`, `ToolExecutionContext`)
* Authentication/authorization with JWT
* Structured error handling (`OrchestratorErrorCode`)
* Comprehensive test strategy across domain services

---

## Phase 4 — BYOK (Bring Your Own Key)

**Status: Completed**

Implement secure user-configurable credentials for:

* OpenRouter
* NASA API

Implemented pipeline:

```text
User Request
     ↓
Credential Resolver
     ↓
User credential?
 ├── Yes → User credential
 └── No  → Application default
     ↓
Provider
```

Delivered:

* Fernet symmetric encryption for stored keys (`backend/api/services/credentials.py`)
* Provider credential validation endpoints (`POST /api/credentials/<provider>/validate/`)
* Key masking (`key_hint`) and secure retrieval
* Credential management UI in Settings tab (`frontend/src/pages/Settings.tsx`)
* Authorization rules: users can only view/modify their own keys
* Error mapping for missing, invalid, or expired credentials

---

## Phase 5 — AI & Exploration Execution

**Status: Completed**

Evolve the V1 `SpacePlan` interaction model into the full V2 AI-powered exploration experience.

### Phase 5.1 — Architecture & Contracts (Completed)

Define the orchestration architecture and contracts:

* Orchestrator boundary and responsibility
* LLM provider abstraction (`BaseLLMProvider`)
* Tool contract (`BaseTool`)
* V2 Tool registry (`ToolRegistry`)
* Tool call and result contracts (`ToolCall`, `ToolResult`, `DiscoveryData`)
* Interaction response schema
* Error contract (`OrchestratorErrorCode`)
* Execution lifecycle
* Orchestrator context (`OrchestratorContext`)
* Security boundaries

Contracts defined in `api/engine/contracts.py` and `api/engine/tool_registry_v2.py`.
Architecture documented in `docs/ARCHITECTURE.md`.

### Phase 5.2 — OpenRouter Provider (Completed)

Implement `OpenRouterProvider` as a `BaseLLMProvider`:

* Credential resolution (user BYOK → app default)
* OpenRouter HTTP client with `openai` SDK
* Translation to/from `LLMMessage`/`LLMResponse`
* Error handling, rate limit management, and `OrchestratorErrorCode` translation
* Model selection and validation (`UserProfile.preferred_model`)

### Phase 5.3 — NASA Tool Migration (Completed)

Migrate existing NASA tools to `BaseTool` subclasses:

* `APODTool` (`api/engine/tools/nasa/apod.py`)
* `NeoWsTool` (`api/engine/tools/nasa/neows.py`)
* `DONKITool` (`api/engine/tools/nasa/donki.py`)
* Register tools with V2 `ToolRegistry`
* Credential injection via `ToolExecutionContext`

### Phase 5.4 — Orchestrator Implementation (Completed)

Implement `GenericOrchestrator` (`api/engine/orchestrator/generic_orchestrator.py`):

* Multi-turn tool-call loop with safety limit (`max_rounds=5`)
* Tool schema validation and argument sanitization
* Duplicate failure suppression (`failed_tool_signatures`)
* Prompt defense against silent tool swaps
* Result normalization into `OrchestratorResult`
* Post-tool LLM enrichment pass for contextual `why_interesting` insights
* Deduplication and persistence via `ResultPersistenceService`

### Phase 5.5 — Interaction API Integration (Completed)

Connect the orchestrator to the Interaction API:

* Wire `POST /api/plans/<id>/interactions/` to orchestrator execution
* Orchestrator context assembly from `SpacePlan` and past `Interaction` records
* Guaranteed terminal state transition (`pending` → `processing` → `completed` | `failed`)
* Error persistence with `error_code`

### Phase 5.6 — Dynamic Result Cards (Completed)

Implement specialized frontend result cards based on `result_type`:

* `ApodResultCard` — high-resolution media, date, explanation
* `NeowsResultCard` — asteroid metrics, hazardous badges, diameter, miss distance
* `DonkiResultCard` — solar flare classifications, active region, peak time
* `GeneralResultCard` — structured analysis, multi-section markdown synthesis
* Card registry and dynamic renderer switcher in `InteractionResult.tsx`

### Phase 5.7 — Interaction Execution Engine (Completed)

Harden backend execution service (`api/services/interaction_execution.py`):

* Idempotent interaction execution guards
* Clean error handling for provider timeouts, missing keys, or validation issues
* Atomic transaction safety for discovery and interaction updates

### Phase 5.8 — Follow-up Discoveries Intelligence & Post-tool LLM Enrichment (Completed)

Enhance discovery UX and synthesis clarity:

* Clear UI distinction between newly added discoveries and targeted reference discoveries
* Dedicated discovery confirmation pill badges
* Post-tool LLM enrichment pass generating vivid, contextual `why_interesting` insights
* Clean separation between synthesis text and structured discovery cards

### Phase 5.9 — Additional NASA Tools (Completed)

Expand available NASA capabilities in `BaseTool` and `ToolRegistry`:

* Integrated NASA Image and Video Library (`nasa_images` / `NASAImagesTool`) for broad exploration across missions (JWST, Hubble, Apollo) and celestial targets.
* Integrated NASA Earth Polychromatic Imaging Camera (`epic` / `EPICTool`) for full-disc Earth imagery from the DSCOVR satellite at Lagrange Point 1 with robust date gap handling and zero-key media security.
* Registered tools in `ToolRegistry` with OpenAI function schema generation.
* Added specialized React cards (`NasaImagesResultCard`, `EpicResultCard`) in `CardRegistry`.
* Added comprehensive mocked unit and integration test suite with 100% test coverage.

### Phase 5.10 — End-to-End Hardening & Reliability (Completed)

Harden exploration workflow, tool execution, persistence, and pipeline parity:

* **APOD and EPIC Date Fallback Hardening**: Preserved automatic date fallback for APOD and EPIC using structured API error classification (`APIError`). Fallback is only triggered for confirmed date-related unavailability or out-of-range dates. Authentication (401/403), rate limits (429), network failures, and timeouts are never masked. Tool results accurately record `fallback_applied`, `requested_date`, `actual_date`, and user notices in metadata, explanations, and facts.
* **NASA Images Pagination & Honest Results**: Enforced pagination clamping (`1 <= page <= 100`). When a requested page yields only items already discovered in the plan, returns an honest empty result with user guidance rather than reinjecting duplicate discoveries.
* **Discovery Badge & Reference Accuracy**: Fixed `added_discoveries` tracking in `ResultPersistenceService` so only genuinely newly created discoveries (`created == True`) are recorded as added. Re-referenced existing discoveries are correctly linked without falsely inflating newly-added counts.
* **Canonical External Identifiers**: Standardized external IDs across APOD, NeoWs, DONKI, NASA Images (`nasa_id`), and EPIC (`identifier`). When canonical IDs are absent, external ID safely defaults to `None` to prevent accidental deduplication collisions.
* **Execution Pipeline Parity**: Brought initial exploration creation (`SpacePlanCreateView`, `save_space_plan`, `run_space_planner`) and follow-up interaction execution (`execute_interaction`) into full parity regarding user-level BYOK OpenRouter and NASA keys, profile `preferred_model` selection, tool availability (registered `search_nasa_images` and `get_epic_earth_imagery` in legacy registry), and canonical external ID extraction.
* **Data Model & Schema Alignment**: Updated `Discovery.SOURCE_CHOICES` to include `nasa_images` and `epic`. Changed `Discovery.facts` default from empty list to dictionary. Applied Django migration `0007_alter_discovery_facts_alter_discovery_source`. Aligned frontend TypeScript definitions and added defensive rendering in `DiscoveryModal` and `EpicResultCard`.
* **Test Suite Expansion**: Reconciled test suite baseline and expanded to 139 passing automated tests covering all fallback scenarios, pagination limits, deduplication edge cases, and cross-pipeline execution.
* **Targeted Reliability Fixes**: Hardened APOD fallback classification to eliminate catch-all retry on server/unrelated errors, refined NASA Images empty page messaging (`page == 1` vs `page > 1`), propagated `total_hits` collection metadata, and dropped synthetic index-based fallback IDs in EPIC in favor of canonical identifiers or `None`.

---

## Phase 6 — System Resilience, Execution Hardening & Frontend Testing

**Status: Completed**

Harden backend and frontend execution pipelines, auth workflows, API client resilience, code quality, and automated testing infrastructure:

### Phase 6.1 — Navigation & Auth Flow (Completed)
* Login and register redirection to `/` when already authenticated.
* Registration awaits `loginUser` before redirecting.
* `NotFound` page uses React Router client navigation.
* Onboarding flow routing guards: redirects un-onboarded users from protected root to `/onboarding`, prevents onboarded users from accessing `/onboarding`, and adds `POST /api/auth/onboarding/complete/` endpoint.

### Phase 6.2 — API Client & Resilience (Completed)
* Axios interceptor with token refresh queueing to prevent duplicate refresh calls.
* Follow-up interaction error feedback with friendly user notices for timeouts and network failures.
* Settings theme persistence wired to `PATCH /api/auth/me/`.

### Phase 6.3 — Code Quality & Lint Remediation (Completed)
* Resolved all ESLint warnings and errors across the frontend codebase.
* Clean hook dependency arrays, safe timer cleanup, and full React 19 compatibility.

### Phase 6.4 — Backend Execution Hardening & Parity (Completed)
* Targeted exception boundary in `SpacePlanCreateView` returning HTTP 502 without leaking secrets, credentials, or stack traces.
* Preserved `client_override` and `model_list_override` during schema validation retry in `space_planner.py`.
* Query parameter validation for `SpacePlan` list filtering (`?archived=true/false` and `?status=...`).
* Dual routing support (`/api/` prefix alongside root endpoints).

### Phase 6.5 — Frontend Automated Testing Infrastructure (Completed)
* Installed minimal, compatible test stack: Vitest, React Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
* Configured `frontend/vitest.config.ts` and `frontend/src/test/setup.ts`.
* Implemented comprehensive test suites covering auth flows, onboarding routing, error handling, and settings theme persistence.

### Theme Persistence Optimization (Completed)
* Instant local caching in `localStorage` and DOM class switching with 0ms latency.
* 400ms trailing debounce on `PATCH /api/auth/me/` API calls to prevent flooding during rapid toggling.
* Zero-API-call cancellation when toggled back and forth to the current persisted theme.
* Serialized queue worker (`processThemeQueue`) to eliminate backend write races.
* Unmount flush ensuring pending preference changes are persisted if the user navigates away before debounce expires.

---

## Phase 7 — Production Deployment, UI Polish & Release Readiness

**Status: Completed**

Implement the approved V2 design, harden production infrastructure, deploy to live cloud services, resolve end-to-end UX edge cases, and finalize the V2 release.

### Phase 7.1 — Application Redesign & Design System (Completed)

Implement the approved V2 design from `design/mockups/explore-professional-refined.html`:

* Full application shell (`AppShell`, `AppNavbar`, `AppSidebar`)
* Multi-page routing (`Home`, `Explore`, `Explorations`, `Settings`, `Onboarding`, `Login`, `Register`)
* Additive exploration stream (`InteractionStream`)
* Resizable panes and responsive drawer navigation
* Dark and light theme support via CSS custom properties and theme-specific SVG logo assets
* Full BYOK management in Settings tab
* Clean dark-mode contrast styling for action buttons and navigation controls

### Phase 7.2 — Production Readiness, Security Hardening & Deployment Configuration (Completed)

Harden backend and frontend infrastructure for production cloud hosting:

* **Production Cloud Services Deployed**:
  * **Frontend**: Vercel (`https://spacescout-app.vercel.app`) with SPA routing rewrites (`vercel.json`) and build-time `VITE_API_URL` validation.
  * **Backend**: Render Web Service (`https://spacescout.onrender.com`) running Gunicorn WSGI (2 workers, 4 threads, 120s timeout) and WhiteNoise static asset compression.
  * **Database**: Aiven PostgreSQL with SSL enforced connection pooling via `dj-database-url` and `psycopg`.
* **Security & Environment Hardening**:
  * Enforced `CREDENTIAL_ENCRYPTION_KEY` requirement in production for Fernet encryption of BYOK keys.
  * Configured `SECURE_PROXY_SSL_HEADER` for Render proxy TLS termination.
  * Enabled `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_CONTENT_TYPE_NOSNIFF`, and `X_FRAME_OPTIONS = 'DENY'`.
  * Restricted CORS and CSRF trusted origins to Vercel production and preview domains.
  * Configured conservative initial HSTS settings (`SECURE_HSTS_SECONDS=0`) to avoid domain lockouts prior to permanent custom domain verification.
  * Created unauthenticated database health check endpoint (`/api/health/` and `/health/`) with narrow SSL-redirect exemption for container probes and uptime monitoring.

### Phase 7.3 — Exploration Lifecycle, Error UX & BYOK Guidance (Completed)

Harden in-flight exploration state, follow-up interactions, and user guidance:

* **Navigation-Safe State Preservation**:
  * Lifted active exploration creation lifecycle and follow-up interaction state into `PlansContext` (`activeCreation`, `activeInteractionPlanId`).
  * In-flight generation progress, step animation timers, prompts, and failure states survive client-side SPA navigation between `/explore`, `/`, `/settings`, and `/explorations`.
  * Handled component unmounting, remounting, and stale responses safely via ref guards.
* **Concurrency & Deduplication Guards**:
  * Deduplicated concurrent duplicate creation requests while active, returning the shared in-flight promise without blocking subsequent legitimate requests.
  * Locked follow-up interaction requests per plan ID to prevent duplicate executions.
* **Backward-Compatible Error Contract**:
  * Preserved stable error code contract reusing `OrchestratorErrorCode.MISSING_CREDENTIAL` (`"missing_credential"`).
  * `SpacePlanCreateView` returns `{"detail": detail, "error_code": "missing_credential"}` on HTTP 502, maintaining compatibility with existing consumers.
* **Credential Precedence & Onboarding Guidance**:
  * Preserved strict credential resolution precedence: User BYOK credentials → shared environment fallback → missing-credential guidance.
  * Replaced generic boxed error cards with an atmospheric, borderless error presentation featuring a soft radial glowing icon.
  * Routed missing/invalid credential errors directly to `/settings?tab=credentials`, with auto-tab activation on direct navigation and refresh.

### Phase 7.4 — Production Regression & Quality Verification (Completed)

Verify full-stack correctness across automated test suites, linting, and build validation:

* **Backend Test Suite**: 178 tests passing with 100% success (`uv run python manage.py test api`), including dedicated production readiness and credential regression tests (`api.test_production_readiness`).
* **Frontend Test Suite**: 62 tests passing across 11 test suites (`npm test` with Vitest and React Testing Library).
* **Code Quality**: Zero ESLint warnings or errors (`npm run lint`).
* **Production Build**: Clean TypeScript compilation and Vite production bundle generation (`npm run build`).
* **Database Migrations**: Zero unapplied or missing migrations (`uv run python manage.py makemigrations --check --dry-run`).

### Phase 7.5 — Release Finalization & Operational Documentation (Completed)

* Reconciled roadmap and context documentation with live production state.
* Documented production hosting architecture, service endpoints, operational limitations, and release metadata.
* Verified repository working tree cleanliness and release readiness.

---

## Phase 8 — Hardening & Ongoing Verification

**Status: Core Requirements Completed; Standing Operational Maintenance**

Core hardening tasks defined for V2 release readiness have been completed and verified across Phases 5.10, 6.4, 7.2, 7.3, and 7.4:

* Core functionality tested (exploration creation, additive follow-ups, discovery modals)
* Authentication and authorization tested (JWT login, register, token refresh, route protection)
* BYOK encryption, key masking, and provider validation tested
* Provider failures and rate limits tested with actionable user guidance
* NASA date fallbacks and canonical external ID deduplication tested
* Responsive drawer and desktop navigation tested
* Production security headers, secure cookies, and secret isolation verified
* Unnecessary technical debt and ESLint warnings eliminated

Standing operational tasks for post-release monitoring:
* Periodic review of production error logs and uptime
* Continuous dependency vulnerability scanning

---

## Phase 9 — Deployment & Portfolio Readiness

**Status: Core Deployment Completed; Presentation & Portfolio Refinement Ongoing**

Production deployment and hosting readiness have been completed:

* Production deployment live on Vercel (frontend), Render (backend), and Aiven (PostgreSQL)
* Production environment variables, health checks, and database pooling configured
* Technical architecture and project context documentation updated
* Operational limitations and future improvements documented

Ongoing portfolio tasks:
* Capturing high-resolution product demo screenshots and video walkthroughs
* Preparing portfolio case-study writeup highlighting architectural and security decisions

---

## Phase 10 — Standalone Landing Application & Discovery Bridge

**Status: Completed Locally**

Delivered a dedicated public marketing and discovery entry point under `landing/`:

* **Next.js 15 SSR Architecture**:
  * Request-time server rendering with `export const dynamic = 'force-dynamic'`.
  * Server-side NASA APOD integration with 1-hour ISR revalidation.
  * Multi-source resilience: Official NASA Science REST API (`science.nasa.gov`) → Legacy API endpoint (`api.nasa.gov`) → Bundled offline fallback (`/carina-nebula.jpg` and `FALLBACK_ASTRONOMY`).
  * Historical date browser (`?date=YYYY-MM-DD`) with dismissible active filter badge.
* **APOD-to-Exploration Prompt Bridge**:
  * Interactive CTA ("Explore in SpaceScout") linking to `${appUrl}/explore?prompt=...`.
  * Frontend query parameter prefill contract (`?prompt=` and `?query=`) in `Explore.tsx`.
  * Full query preservation through unauthenticated redirects to `/login` and return to `/explore`.
* **Mobile Navigation & Accessibility**:
  * Slide-in mobile navigation drawer with backdrop overlay.
  * Focus trapping, scroll locking (`overflow: hidden`), and `preventScroll: true` focus restoration to eliminate mobile viewport displacement.
  * Sticky navbar context preserved across mobile and desktop breakpoints.
* **Resilient URL Resolution & Hydration**:
  * Auto-prefixing `https://` on protocol-less URLs in `lib/config.ts`.
  * `suppressHydrationWarning` on `<html>` and `<body>` to ignore browser extension attribute modifications (e.g. Grammarly).

---

## Phase 11 — Landing Deployment Readiness & Pre-Release Verification

**Status: Completed Locally; Pending Production Deployment**

Audited and verified the `landing/` application for independent Vercel hosting:

* **Vercel Build Isolation**:
  * Standalone `package.json`, `package-lock.json` (lockfile v3), and `next.config.ts`.
  * Zero repository imports escaping the `landing/` directory.
  * Verified independent build settings (`next build`, `.next` output directory).
* **Metadata & SEO Hygiene**:
  * Resolved Next.js build-time metadataBase warning by conditioning social images on `siteUrl`.
  * Guaranteed zero localhost URL leaks in production HTML, canonical tags, or dynamic sitemaps when `NEXT_PUBLIC_SITE_URL` is unset.
  * Validated 1200×630 Open Graph card asset (`public/og-image.png`).
* **Deployment Impact Check**:
  * Audited 9 unpushed local commits for dependencies and impact on existing Vercel frontend and Render backend.
  * Confirmed zero database migrations and zero required environment variable changes.
  * Verified full regression test suites: 25/25 landing tests passing, 70/70 frontend tests passing.

---

## Known Operational Limitations & Future Improvements

### Operational Limitations
* **Render Free-Tier Cold Starts**: The backend Web Service on Render spins down after inactivity. The first request after an idle period may experience cold-start latency (~50s). The `/api/health/` endpoint can be pinged periodically by uptime monitors to keep the service warm.
* **Client-Side In-Flight Durability**: Active exploration creation and follow-up interaction progress are held in-memory within `PlansContext`. This survives client-side route navigation within the SPA, but does not survive a hard page refresh (`F5`) or server restart before the synchronous backend transaction commits to the database. (Completed explorations and discoveries are durably stored in PostgreSQL).
* **Upstream AI Provider Quotas**: When using free or shared OpenRouter models, upstream capacity limits or rate limits may be encountered. The application detects these gracefully and guides users to configure their own API keys in Settings.
* **HSTS Gradual Rollout**: `SECURE_HSTS_SECONDS` defaults to 0 to prevent browser lockouts while on default provider-assigned subdomains (`*.onrender.com`). Once a custom domain is permanently attached, HSTS should be enabled.

### Future Improvements
* **Streaming Progress (SSE / WebSockets)**: Implement Server-Sent Events or WebSockets for real-time planner telemetry, eliminating long-running synchronous HTTP requests and improving resilience against proxy timeouts.
* **Asynchronous Task Queue (Celery/Redis)**: Decouple multi-step planner execution into background worker tasks with job status polling or event-driven completion.
* **Custom Domain Routing**: Attach a branded custom domain with 1-year HSTS preload registration across both the landing site and application.

---

## Out of Scope Unless Later Justified

Do not add these merely because they are technically interesting:

* generic chatbot functionality
* unnecessary AI frameworks
* social features
* unrelated NASA APIs (e.g. Mars Rover Photos)
* complex real-time infrastructure
* excessive animations
* unnecessary microservices
* premature infrastructure complexity

New scope should be evaluated against the core exploration experience.

---

## Current Priority

> **Pre-release documentation and verification complete. Next step is pushing the 10 verified local commits to GitHub `main` and creating the new `landing/` project on Vercel.**


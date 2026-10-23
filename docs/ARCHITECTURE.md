# SpaceScout — Architecture

## Architectural Goal

SpaceScout V2 should evolve the existing V1 architecture rather than replace it.

The architecture should remain:

* modular
* understandable
* testable
* provider-agnostic where practical
* easy to extend with new NASA tools
* secure with respect to user credentials

Prefer incremental architectural improvements that solve real V2 requirements.

---

## High-Level Architecture

```text
Public Visitors                          Authenticated Users
       │                                          │
       ▼                                          ▼
Next.js 15 Landing App (SSR)             React 19 + TypeScript (Vite SPA)
       │                                          │
       ├─ Server-side NASA APOD                   ├─ Shared Contexts (Plans, Auth, Credentials)
       │                                          │
       └─ "Explore in SpaceScout" CTA ───────────>┴─ Query Parameter Bridge (?prompt=... / ?query=...)
                                                  │
                                                  ▼ REST / JWT
                                         Django REST Framework (Render)
                                                  │
                                                  ├── Authentication & Onboarding
                                                  ├── Exploration & Interaction APIs
                                                  ├── Fernet BYOK Credential Persistence
                                                  │
                                                  ▼
                                         Generic AI Orchestrator (Multi-Turn Tool Loop)
                                                  │
                                                  ├── OpenRouter Provider (BaseLLMProvider)
                                                  │
                                                  └── Tool Registry (BaseTool subclasses)
                                                         │
                                        ┌────────────────┼────────────────┐
                                        ▼                ▼                ▼
                                      NASA             NASA             NASA
                                     Service          Service          Service
                                 (APOD, NeoWs,    (NASA Images)         (EPIC)
                                    DONKI)               │                │
                                        │                │                │
                                        └────────────────┼────────────────┘
                                                         ▼
                                                     NASA APIs
                                                         │
                                                         ▼
                                            Aiven PostgreSQL Database
                                    (Encrypted Credentials, Plans, Discoveries)
```

The monorepo separates public discovery, authenticated exploration, and domain orchestration into distinct layers.

---

## Standalone Landing Application (`landing/`)

The marketing and public discovery site is implemented as an independent Next.js 15 application under `landing/`.

Key architectural characteristics:
* **Server-Side Rendering (SSR)**: Uses `export const dynamic = 'force-dynamic'` for request-time rendering of today's astronomy discovery and historical date selection (`?date=YYYY-MM-DD`).
* **Server-Side NASA APOD Integration**: `landing/lib/nasa.ts` fetches data server-side using Next.js data caching with 1-hour ISR revalidation (`revalidate: 3600`). It features a dual-source resilience strategy:
  1. Primary: Official NASA Science REST API (`https://science.nasa.gov/wp-json/wp/v2/apod-basic`) for high-resolution images, clean HTML explanations, and author credits.
  2. Secondary: Legacy API endpoint (`https://api.nasa.gov/planetary/apod`) using the server-only `NASA_API_KEY`.
  3. Curated Fallback: Bundled offline fallback (`/carina-nebula.jpg` and `FALLBACK_ASTRONOMY`) if upstream rate limits (HTTP 429), timeouts, or network errors occur.
* **Prompt Parameter Bridge**: The "Explore in SpaceScout" CTA links directly to the authenticated React SPA:
  `${appUrl}/explore?prompt=${encodeURIComponent('Tell me about ' + item.title + ' discovered on ' + item.date)}`
* **Isolated Deployment**: Deploys as an independent Vercel project with Root Directory `landing/`. Does not import or depend on repository files outside `landing/`.
* **Zero Localhost Leaks**: Dynamic sitemap (`sitemap.ts`) and Open Graph social cards (`layout.tsx`) conditionally emit URLs only when `NEXT_PUBLIC_SITE_URL` is set, completely suppressing fallback localhost links in production.

---

## Frontend SPA (`frontend/`)

The core exploration experience uses React 19 + TypeScript with Vite.

Responsibilities include:
* rendering exploration workspaces, additive timeline streams, and discovery cards
* handling user interaction and multi-turn follow-up prompts
* managing UI state and shared contexts (`PlansContext`, `AuthContext`, `CredentialsContext`)
* in-memory caching and request deduplication via synchronous ref synchronization (`plansRef.current`, `interactionsCacheRef.current`)
* consuming incoming exploration prompts from `?prompt=` or `?query=` URL parameters without auto-submitting
* preserving destination URLs across unauthenticated login redirects (`ProtectedRoutes.tsx` and `Login.tsx`)
* debounced preference persistence (local-first theme caching with serialized backend sync)
* authentication token management and automatic refresh queueing via Axios interceptors
* presenting explorations and discoveries
* automated component and integration testing via Vitest + React Testing Library (70 passing tests)

The frontend does not contain provider secrets or directly execute protected AI/NASA operations.

Major business decisions should remain on the backend.

---

## Backend

Django + Django REST Framework provides the application/API layer.

Responsibilities include:

* authentication and onboarding completion verification
* authorization (user-scoped ownership of plans, discoveries, credentials)
* request validation and query parameter validation (e.g. `SpacePlan` list filtering)
* dual-routing support (`/api/` prefix alongside root endpoints)
* targeted error boundaries protecting planner execution (returning HTTP 502 without leaking secrets or stack traces)
* exploration persistence
* API responses
* provider credential resolution with Fernet encryption
* preservation of BYOK overrides during schema retry loops
* orchestration between domain logic and external services

Keep API/view logic separate from the planner and external provider implementations.

---

## Exploration Domain

V2 uses `SpacePlan` as the primary exploration model. One `SpacePlan` represents one continuous exploration.

```text
User
 │
 └── SpacePlan (Exploration)
       ├── original prompt
       ├── context / summary
       ├── discoveries (Discovery[])
       └── interactions (Interaction[])
```

The domain supports:

* creating an exploration
* adding discoveries
* continuing an exploration via interactions
* retrieving an exploration
* filtering or viewing subsets of discoveries
* preserving previous discoveries
* resuming an exploration later

Follow-up interactions are additive rather than destructive. There is no parent-child SpacePlan relationship; new explorations create independent SpacePlans.

---

## Planner

The planner is responsible for turning natural-language intent into structured discovery retrieval.

```text
User Prompt
    ↓
Planner
    ↓
LLM
    ↓
Tool Selection
    ↓
Tool Execution
    ↓
NASA Services
    ↓
Retrieved Data
    ↓
Structured Output
    ↓
Validation
```

The planner should remain independent from the HTTP/API layer where practical.

It should not directly depend on React-specific concepts or database presentation concerns.

---

## Tool Registry

The existing tool registry is an important extension point.

It maps tool definitions to concepts such as:

* tool name
* handler
* description
* parameters
* OpenAI-compatible tool schema

New NASA capabilities should normally be added through this registry.

Do not replace the registry with a larger framework unless there is a concrete architectural requirement.

Adding a new NASA tool should ideally require:

```text
NASA service
    ↓
Tool handler
    ↓
Tool registry
    ↓
Planner can use it
```

without modifying unrelated planner logic.

---

## NASA Service Layer

NASA API communication should remain isolated behind service functions/classes.

```text
Planner
   ↓
Tool Handler
   ↓
NASA Service
   ↓
NASA API
```

The service layer should handle:

* API requests
* authentication
* parameter construction
* response parsing
* provider/API errors
* normalization where necessary

The planner should not contain raw NASA HTTP requests.

---

## NASA Tool Expansion

V2 should add approximately three additional NASA capabilities.

Current NASA capabilities:

```text
APOD (Astronomy Picture of the Day)
NeoWs (Near-Earth Asteroid Tracking)
DONKI (Solar Flares / Space Weather)
NASA Images (Image & Video Archive Search)
EPIC (Deep-Space Earth Polychromatic Imaging Camera)
```

These are candidates rather than irreversible architectural commitments.

Each integration should be evaluated for:

* current API availability
* usefulness
* query capability
* response complexity
* rate limits
* tool-schema suitability
* discovery normalization
* UI requirements

Replace a candidate if it does not provide meaningful value.

---

## Provider Abstraction

V1 used application-level environment credentials.

V2 introduces user-level credentials through Bring Your Own Key (BYOK) with application fallbacks.

The `ProviderCredential` model stores encrypted keys per user and provider. Provider access uses a centralized credential resolution service (`backend/api/services/credentials.py`):

```text
Request
   ↓
Credential Resolver (resolve_openrouter_key / resolve_nasa_key)
   ↓
User credential available & active?
   ├── Yes → Decrypt and use user credential
   └── No  → Application default (.env)
   ↓
Provider Service / BaseTool Execution Context
```

This ensures provider-specific credential resolution remains completely decoupled from the rest of the application.

---

## BYOK Security Model

The credential system adheres strictly to the following security guarantees:

* **Symmetric Encryption**: Keys are encrypted at rest using Fernet symmetric cryptography with keys derived deterministically from Django's `SECRET_KEY`.
* **Zero Plaintext Leakage**: Raw API keys are never exposed in GET responses, API serializers, application logs, or LLM system prompts.
* **Masked Hints**: The UI displays only a masked hint (`key_hint`, e.g. `sk-...abcd`) so users can recognize which key is active without exposing secrets.
* **Pre-persistence Validation**: An explicit validation endpoint (`POST /api/credentials/<provider>/validate/`) tests credentials against the actual provider API (OpenRouter or NASA) prior to saving.
* **Strict Tenant Isolation**: Credential queries are strictly scoped to `request.user`.

---

## LLM Provider

OpenRouter is the primary LLM provider, wrapped by `OpenRouterProvider` (`BaseLLMProvider`).

* Implements OpenAI SDK integration with OpenRouter's base URL.
* Maps `UserProfile.preferred_model` with application default fallback (`openai/gpt-4o-mini`).
* Translates provider-level HTTP and rate-limit errors into `OrchestratorErrorCode`.
* Strips all internal credential headers from logs and responses.

---

## Persistence

The database persists the information required to resume an Exploration.

The current schema preserves:

* user ownership
* exploration identity (`SpacePlan`)
* original prompt
* exploration context (`summary`)
* discoveries with external IDs for deduplication (`Discovery`)
* discovery media (`DiscoveryMedia`) with primary image flags
* interaction history (`Interaction`) with target and added discovery tracking
* timestamps and terminal status flags

Redundant generated data is avoided; discoveries are referenced by ID rather than duplicated across interactions.

---

## Discovery Identity and Deduplication

Because explorations are additive, discoveries use `external_id` with a unique constraint per `SpacePlan` and source to determine whether two results represent the same underlying NASA resource:

```text
NeoWs      → NASA SPK object identifier (e.g., "3542519")
DONKI      → Event activity identifier (e.g., "2026-10-01T12:00:00-FLR-001")
APOD       → Observation date string (e.g., "2026-10-05")
```

Deduplication in `ResultPersistenceService` safely links existing discoveries to interactions if already retrieved, preventing duplicate records.

---

## API Design

The REST API exposes clean, domain-focused endpoints:

```text
# User & Profile
POST   /api/register/                        — Account creation
POST   /api/auth/token/                      — JWT token pair retrieval
POST   /api/auth/token/refresh/              — JWT token refresh
GET    /api/auth/me/                         — Current user profile & preferences
PATCH  /api/auth/me/                         — Update profile (theme, model)

# Explorations (SpacePlans)
GET    /api/plans/                           — List user explorations (?archived, search, order)
POST   /api/plans/create/                    — Initialize new exploration from prompt
GET    /api/plans/<id>/                      — Retrieve full exploration with discoveries
PATCH  /api/plans/<id>/                      — Update exploration (rename title, archive/unarchive)
DELETE /api/plans/<id>/                      — Delete exploration

# Interactions (Follow-ups)
GET    /api/plans/<id>/interactions/         — List interactions for exploration
POST   /api/plans/<id>/interactions/         — Execute follow-up prompt with AI orchestrator

# BYOK Credentials
GET    /api/credentials/                     — List credentials (masked key hints)
POST   /api/credentials/                     — Save encrypted credential
DELETE /api/credentials/<provider>/          — Delete credential
POST   /api/credentials/<provider>/validate/ — Validate key against external provider
```

---

## Authentication and Authorization

JWT authentication currently protects application resources.

Users must only be able to access their own:

* explorations
* discoveries
* provider credentials
* account configuration

Authorization should be enforced server-side rather than relying on frontend route protection alone.

---

## Error Handling

External APIs and AI providers are inherently failure-prone.

The architecture should distinguish between:

* invalid user input
* authentication errors
* authorization errors
* provider credential errors
* NASA API failures
* LLM/provider failures
* validation failures
* unexpected internal errors

Errors returned to users should be useful without exposing secrets, stack traces, or unnecessary internal details.

---

## Testing

V2 should gradually introduce stronger testing around high-value behavior.

Priority areas include:

* authentication/authorization
* credential resolution
* NASA service behavior
* tool registry
* planner behavior
* discovery validation
* exploration persistence
* deduplication
* API endpoints

Tests should focus on meaningful behavior rather than maximizing test count.

---

## Architectural Principle

The core architectural boundary should remain:

```text
User Experience
      ↓
Application API
      ↓
Domain / Planner
      ↓
Tools / Providers
      ↓
External Services
```

Each layer should have a clear responsibility.

When implementing V2 features, first determine which layer owns the new behavior before adding code.

---

## AI Orchestration Architecture (Phase 5)

Phase 5 introduces AI-powered exploration through an orchestration pipeline that connects user interactions to LLM reasoning, NASA tool execution, and result persistence.

The contracts are defined in `api/engine/contracts.py`. This section documents the architecture they establish.

### Orchestrator Boundary

The orchestrator coordinates the pipeline but does not contain provider-specific or NASA-specific implementation details.

```text
Interaction
     ↓
Orchestrator (api/engine/contracts.py → BaseOrchestrator)
     │
     ├── LLM Provider (BaseLLMProvider)
     │
     ├── Tool Registry (api/engine/tool_registry_v2.py → ToolRegistry)
     │
     ├── Tool Execution (BaseTool.execute)
     │
     └── Result Normalization (ToolResult → OrchestratorResult)
```

The orchestrator does not contain:

* NASA HTTP requests
* OpenRouter-specific HTTP code
* React component references
* Raw credential handling

Those responsibilities belong to their respective implementations.

---

### LLM Provider Contract

The orchestrator communicates with LLMs through `BaseLLMProvider`, not directly with any specific provider.

```text
Orchestrator
    ↓
BaseLLMProvider.generate(messages, tools, ...)
    ↓
LLMResponse (content, tool_calls, finish_reason, model, usage)
```

`LLMResponse` is provider-independent. It contains:

* `content` — text response from the model
* `tool_calls` — list of `ToolCall(tool_name, arguments)` — provider-independent
* `finish_reason` — why the model stopped
* `model` — actual model used
* `usage` — token statistics

Provider implementations (e.g. `OpenRouterProvider`) translate between their API format and this contract.

---

### Tool Contract

Every NASA tool implements `BaseTool`:

```text
BaseTool
    name          — unique identifier (e.g. "get_apod")
    description   — for LLM tool schema
    parameters    — list of ToolParameter definitions
    result_type   — ResultType value (e.g. "apod", "neows")
    execute()     — returns ToolResult
    get_openai_schema()   — generates OpenAI function-calling schema
    validate_arguments()  — validates model-generated arguments
```

Tools must not:

* Know about React or frontend rendering
* Access credentials directly (credentials are injected via `ToolExecutionContext`)
* Make HTTP calls to arbitrary URLs
* Return raw API responses without normalization

---

### Tool Registry

The V2 tool registry (`api/engine/tool_registry_v2.py`) allows the orchestrator to discover tools by name:

```python
registry.register(APODTool())
registry.get("get_apod")        # → APODTool instance
registry.get_openai_schemas()   # → all tool schemas for LLM
registry.list_tools()           # → all registered tools
```

Adding a new tool (e.g. `get_exoplanet_archive`) requires:

1. Create a `BaseTool` subclass
2. Register it with the registry

The orchestrator does not need modification.

The V1 dict-based registry (`api/engine/tool_registry.py`) is preserved during the transition.

---

### Tool Call Contract

The model communicates tool call requests through `ToolCall`:

```json
{
  "tool_name": "search_neows",
  "arguments": {
    "start_date": "2026-10-01",
    "end_date": "2026-10-04"
  }
}
```

Before execution, the orchestrator validates:

1. Tool exists in the registry
2. Arguments conform to the tool's declared schema
3. No unknown arguments are passed
4. Required arguments are present

Model-generated arguments are never trusted blindly.

---

### Tool Result Contract

Every tool returns a `ToolResult`:

```text
ToolResult
    tool_name     — which tool produced this
    result_type   — "apod", "neows", "donki", "analysis"
    data          — structured content for the result card
    discoveries   — list of DiscoveryData for persistence
    metadata      — additional context (query params, counts)
```

`DiscoveryData` normalizes a single discovery for persistence:

```text
DiscoveryData
    source, external_id, title, summary, why_interesting,
    date, source_url, facts, details, tags, media
```

---

### Result Types

```text
ResultType.APOD        → "apod"        — Astronomy Picture of the Day
ResultType.NEOWS       → "neows"       — Near-Earth Objects
ResultType.DONKI       → "donki"       — Space Weather Events
ResultType.NASA_IMAGES → "nasa_images" — NASA Media Archive Search
ResultType.EPIC        → "epic"        — Deep-Space Earth Imagery
ResultType.ANALYSIS    → "analysis"    — Comparisons, explanations, synthesis
```

The frontend uses `result_type` to route to the appropriate result card.

---

### Discovery vs Analysis

#### Discovery result

A NASA tool returns factual data that becomes one or more `Discovery` records.

```text
Tool execution → ToolResult.discoveries → Discovery records
```

#### Analysis result

The model synthesizes existing information without necessarily creating new discoveries.

```text
"Compare Discovery A and B" → result_type="analysis" → GeneralResultCard
```

An interaction may contain both: a result and new discoveries.

---

### Interaction Response Contract

The structure stored in `Interaction.response` (JSONField):

```json
{
  "result_type": "apod | neows | donki | analysis",
  "content": { },
  "discoveries": [ ],
  "metadata": { }
}
```

Content schema varies by result type:

**apod:**
```json
{
  "title": "...",
  "date": "2026-10-04",
  "explanation": "...",
  "media_url": "...",
  "media_type": "image"
}
```

**neows:**
```json
{
  "title": "...",
  "summary": "...",
  "object_count": 5,
  "date_range": { "start": "...", "end": "..." }
}
```

**donki:**
```json
{
  "title": "...",
  "summary": "...",
  "event_count": 3,
  "date_range": { "start": "...", "end": "..." }
}
```

**analysis:**
```json
{
  "title": "...",
  "summary": "...",
  "sections": [
    { "heading": "...", "content": "..." }
  ]
}
```

This contract never contains:

* Raw OpenRouter or NASA API responses
* Credentials
* Frontend-specific fields (component names, CSS classes)

---

### Error Contract

Provider-independent error categories (`OrchestratorErrorCode`):

```text
missing_credential         — no credential available for required provider
invalid_credential         — credential rejected by provider
provider_unavailable       — provider API is unreachable or returning errors
provider_rate_limited      — provider rate limit exceeded
tool_not_found             — model requested a tool that doesn't exist
tool_execution_failed      — tool encountered an error during execution
invalid_tool_arguments     — model-generated arguments failed validation
model_error                — LLM produced invalid or unparseable output
context_too_large          — input context exceeds model limits
max_tool_rounds_exceeded   — tool-call loop exceeded safety limit
unexpected_error           — catch-all for unclassified failures
```

These map to `Interaction.error_code`. The frontend renders user-facing messages from these codes without needing to understand provider internals.

Errors never expose: secrets, raw provider responses, request URLs, stack traces, or sensitive exception details.

---

### Execution Lifecycle

```text
POST /api/plans/<id>/interactions/
        ↓
    status = "pending"
        ↓
    Orchestrator invoked
        ↓
    status = "processing"
        ↓
    Build OrchestratorContext
        ↓
    Resolve credentials (user BYOK → app default)
        ↓
    Build LLM messages
        ↓
    LLM provider call
        ↓
    Parse tool calls → validate → execute → collect results
        ↓
    Multi-turn loop (max rounds enforced)
        ↓
    Final LLM response
        ↓
    Normalize to OrchestratorResult
        ↓
    ┌─────────────────────────────────────┐
    │ Success:                            │
    │   Persist discoveries               │
    │   Store response                    │
    │   Link added_discoveries            │
    │   status = "completed"              │
    │   completed_at = now()              │
    ├─────────────────────────────────────┤
    │ Failure:                            │
    │   error_code = OrchestratorErrorCode│
    │   status = "failed"                 │
    │   completed_at = now()              │
    └─────────────────────────────────────┘
```

Interactions never remain stuck in "processing". The architecture guarantees a terminal state even on unexpected errors.

---

### Concrete Engine Implementation (`GenericOrchestrator`)

The production implementation in `api/engine/orchestrator/generic_orchestrator.py` incorporates several safeguards:

1. **Safety Loop Limit**: Caps tool-calling iterations to `max_rounds=5` to prevent runaway recursive calls.
2. **Duplicate Failure Suppression (`failed_tool_signatures`)**: Records `(tool_name, arguments_json)` when a tool execution fails. If the LLM proposes an identical call in subsequent turns of the same turn, execution is suppressed immediately with an explanatory system message, preventing loops.
3. **Anti-Silent-Swap Guard**: Instructs the model never to silently swap to unrelated tools (e.g., substituting APOD when solar flare search fails). The model must report actual findings or absences honestly.
4. **Post-Tool LLM Enrichment**: When NASA tools retrieve factual records, the orchestrator triggers an enrichment pass where the LLM analyzes the specific discoveries to produce compelling, contextual `why_interesting` insights while preserving raw NASA factual fields, dates, and media unaltered.
5. **Clean Synthesis Normalization**: Synthesized output is kept concise in `Interaction.response` rather than dumping verbatim repetitive JSON discovery records into the markdown text.

---

### Backend Service Coordination

* **`InteractionExecutionService` (`api/services/interaction_execution.py`)**: Coordinates the orchestrator run lifecycle, enforces execution idempotency (skips duplicate triggers if not in `pending` status), handles timeouts, and guarantees database status transitions to `completed` or `failed`.
* **`ResultPersistenceService` (`api/services/result_persistence.py`)**: Wraps discovery insertion in atomic database transactions, enforces external ID uniqueness per SpacePlan and source, and associates newly discovered records with both the exploration and the triggering interaction (`added_discoveries`).

### Orchestrator Context

The `OrchestratorContext` defines what the orchestrator receives:

```text
user_id
space_plan_id, space_plan_title, space_plan_summary
interaction_id
user_prompt, interaction_type
target_discoveries         — serialized discoveries referenced by the user
existing_discoveries       — curated summary of plan's current discoveries
preferred_model            — from UserProfile
openrouter_api_key         — resolved credential (NEVER stored/logged)
nasa_api_key               — resolved credential (NEVER stored/logged)
```

The orchestrator has enough context to answer follow-up questions (e.g. "tell me more about the second discovery") without requiring frontend resolution.

Entire database contents are never sent to the model. Only curated, relevant summaries are included.

---

### Security Boundaries

#### Credentials

* The orchestrator may request decrypted credentials through the existing credential service
* Credentials are injected into `OrchestratorContext` and `ToolExecutionContext`
* They must NEVER be:
  * returned in any response
  * stored in `Interaction.response`
  * written to logs
  * included in LLM prompts
  * exposed to the frontend

#### Tool Arguments

* Model-generated arguments are validated against the tool's declared schema before execution
* Unknown arguments are rejected
* Required arguments are enforced

#### Tool Execution

* The model cannot directly provide arbitrary HTTP URLs for execution
* Tools determine which external APIs they contact
* Only registered tools can be executed

#### User Ownership

* Every interaction belongs to a SpacePlan owned by the authenticated user
* Every discovery created by an interaction belongs to the same SpacePlan
* Ownership is enforced server-side at the view layer

---

## Execution Model & Asynchronous Streaming Architecture

### Current Architecture (MVP)
The current MVP utilizes a synchronous request-response execution pattern:
* Initial plan creation (`POST /api/plans/create/`) and follow-up interaction execution (`POST /api/plans/<id>/interactions/`) run synchronously in the Django request thread.
* For web deployments on cloud platforms like Render:
  * WSGI worker timeouts must be configured to accommodate LLM generation and tool retrieval (e.g. `gunicorn config.wsgi:application --workers 2 --threads 4 --timeout 120`).
  * Multi-threaded workers (`--threads 4`) prevent worker starvation when multiple explorations run concurrently.
  * External network calls enforce bounded timeouts (e.g. 15s for NASA services) to prevent hanging requests.

### Future Architecture: Server-Sent Events (SSE) Progress Streaming
Because SpaceScout's output is a strictly validated relational data structure (`SpacePlan`) that drives specialized UI cards rather than conversational markdown text, token-by-token word streaming does not fit the UI card paradigm. However, **lifecycle event streaming** via Server-Sent Events (SSE) is the planned post-MVP evolution.

#### Benefits of Event-Driven Streaming:
1. **Immunity to Reverse Proxy Timeouts**: Immediately sends HTTP 200 headers with `Content-Type: text/event-stream`, eliminating 504 Gateway Timeouts on Render/Cloudflare/Nginx proxies.
2. **Elevated User Feedback**: Replaces static loading spinners with real-time status telemetry showing current planner and tool execution steps.
3. **Zero Heavy Infrastructure**: Can be implemented natively via Django `StreamingHttpResponse` or ASGI without requiring external message brokers (Redis/RabbitMQ) or separate worker clusters (Celery).
4. **Relational Data Integrity**: The client receives progress events as tools execute, and a final `complete` event containing the persisted `SpacePlan` payload.

#### Event Stream Protocol Specification:
```text
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked

event: step
data: {"step": "planning", "message": "Analyzing exploration intent with AI planner..."}

event: tool_start
data: {"tool": "search_nasa_images", "query": "James Webb Pillars of Creation"}

event: tool_result
data: {"tool": "search_nasa_images", "hits": 4, "status": "success"}

event: step
data: {"step": "synthesizing", "message": "Validating discoveries and building exploration plan..."}

event: complete
data: {"plan": { ... full saved SpacePlan JSON ... }}
```

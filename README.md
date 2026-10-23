# SpaceScout V2

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Django](https://img.shields.io/badge/Django-6.0-092e20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Aiven-336791?logo=postgresql&logoColor=white)](https://aiven.io/postgresql)

**SpaceScout V2** is an AI-powered space exploration platform that transforms natural-language queries into structured, observable discoveries backed by live NASA data. Rather than acting as a generic conversational chatbot, SpaceScout coordinates real astronomical instruments, archives, and telemetry—synthesizing raw observations into persistent, multi-turn exploration workspaces.

---

## Live Deployments

* **Landing Page**: [https://spacescout.vercel.app](https://spacescout.vercel.app)
* **Exploration Application (Authenticated SPA)**: [https://spacescout-app.vercel.app](https://spacescout-app.vercel.app)

---

## Key Features & Workflows

1. **Natural-Language Space Exploration**:
   Ask questions in plain English (e.g., *"What asteroids are approaching Earth this week?"*, *"Show me solar flares from the last 48 hours"*, or *"Find James Webb observations of the Carina Nebula"*).
2. **Autonomous Tool Orchestration**:
   A multi-turn AI planner interprets user intent, formulates tool arguments, and coordinates queries across 5 distinct NASA data sources.
3. **Additive Multi-Turn Explorations**:
   Each exploration is a persistent workspace (`SpacePlan`). Follow-up questions add new discoveries and contextual insights without destroying previous results.
4. **Interactive Discovery Timeline**:
   Discoveries are presented in rich cards featuring images, high-definition modals, interactive video embeds, orbital metrics, and contextual *"why it matters"* synthesis.
5. **BYOK (Bring Your Own Key) Security**:
   Users can configure their own OpenRouter and NASA API keys in Settings to bypass shared quotas, protected by Fernet symmetric encryption in PostgreSQL.
6. **Public Astronomy Discovery Bridge**:
   A dedicated Next.js SSR landing page showcases daily NASA Astronomy Pictures of the Day and provides a seamless prompt bridge into the main application.

---

## Screenshots

### 1. Mission Control & Exploration Hub
*Natural-language space exploration hub with quick-start discovery topics and persistent session history.*

![SpaceScout Mission Control & Exploration Hub](images/Screenshot%202026-10-23%20225311.png)

### 2. Multi-Source NASA Exploration Workspace
*Autonomous AI planner synthesizing live astronomical observations across NASA APOD, DONKI space weather, and NeoWs asteroid flybys.*

![Multi-Source NASA Exploration Workspace](images/Screenshot%202026-10-23%20225658.png)

### 3. Additive Follow-Up Discoveries & Astrophotography
*Persistent discovery timeline featuring high-resolution cosmic imagery, observational metadata, and continuous multi-turn follow-up querying.*

![Additive Follow-Up Discoveries](images/Screenshot%202026-10-22%20122350.png)

---

## High-Level Architecture

The repository is structured as a modular monorepo containing three specialized applications:

```text
                                  ┌──────────────────────────────┐
                                  │      Public Visitors         │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │   Next.js 15 Landing App     │  (landing/)
                                  │   - Request-time SSR         │
                                  │   - Server-side NASA APOD    │
                                  │   - SEO & Social Metadata    │
                                  └──────────────┬───────────────┘
                                                 │ "Explore in SpaceScout"
                                                 │ (?prompt=... handoff)
                                                 ▼
┌──────────────────────────────┐  REST / JWT     ┌──────────────────────────────┐
│       Authenticated User     │ ──────────────> │    React 19 + Vite SPA       │  (frontend/)
└──────────────────────────────┘                 │    - Exploration Workspaces  │
                                                 │    - Additive Timeline Feed  │
                                                 │    - In-Memory State Cache   │
                                                 └──────────────┬───────────────┘
                                                                │
                                                                │ HTTPS / JWT
                                                                ▼
                                                 ┌──────────────────────────────┐
                                                 │   Django 6 REST API Layer    │  (backend/)
                                                 │   - Session & Auth Guards    │
                                                 │   - Unauthenticated /health/ │
                                                 └──────────────┬───────────────┘
                                                                │
                                                                ▼
                                                 ┌──────────────────────────────┐
                                                 │   AI Orchestrator Engine     │
                                                 │   - Multi-Turn Tool Loop     │
                                                 │   - Parameter Validation     │
                                                 │   - Result Synthesis         │
                                                 └───────┬──────────────┬───────┘
                                                         │              │
                                    OpenRouter Function  │              │ Tool Execution
                                    Calling (BYOK/Shared)│              │ (APOD, NeoWs, DONKI,
                                                         ▼              │  Images, EPIC)
                                                 ┌───────────────┐      ▼
                                                 │  OpenRouter   │ ┌──────────────────┐
                                                 │  AI Provider  │ │    NASA APIs     │
                                                 └───────────────┘ └──────────────────┘
                                                         │                  │
                                                         └────────┬─────────┘
                                                                  ▼
                                                 ┌──────────────────────────────┐
                                                 │     Aiven PostgreSQL DB      │
                                                 │  - Encrypted BYOK Keys       │
                                                 │  - Plans & Discoveries       │
                                                 └──────────────────────────────┘
```

---

## Applications & Technology Stack

### 1. Landing Website (`landing/`)
* **Framework**: Next.js 15 (App Router), React 19, TypeScript
* **Rendering**: Request-time dynamic server rendering (`force-dynamic`) with 1-hour ISR revalidation for astronomy content
* **Integrations**: Direct server-side NASA Science REST API client with automatic fallback to `api.nasa.gov/planetary/apod` and offline assets
* **Design & SEO**: Custom responsive dark theme, dynamic Open Graph cards, auto-generated `robots.txt` and `sitemap.xml`
* **Hosting**: Configured for independent deployment on Vercel (Root Directory: `landing/`)

### 2. Exploration Application (`frontend/`)
* **Framework**: React 19, TypeScript, Vite
* **State & Caching**: Centralized React contexts (`PlansContext`, `AuthContext`, `CredentialsContext`) with in-memory request deduplication and optimistic UI updates
* **UI Components**: Lucide React, React Markdown, customized glassmorphic design system with full dark/light theme switching
* **Testing**: Vitest, React Testing Library, jsdom (70 automated unit & integration tests)
* **Hosting**: Vercel SPA ([https://spacescout-app.vercel.app](https://spacescout-app.vercel.app)) with client routing rewrites (`vercel.json`)

### 3. API & AI Engine (`backend/`)
* **Framework**: Python 3.12, Django 6, Django REST Framework, SimpleJWT
* **AI Orchestration**: Custom multi-turn function calling engine using the OpenAI Python SDK via OpenRouter
* **Data Validation**: Pydantic schemas for tool inputs, external API payloads, and normalized discovery records
* **Database & Hosting**: Aiven Cloud PostgreSQL with SSL pooling (`dj-database-url`, `psycopg`); Gunicorn + WhiteNoise on Render ([https://spacescout.onrender.com](https://spacescout.onrender.com))
* **Testing**: Django test runner with isolated test database (178 unit & integration tests)

---

## Supported NASA Integrations

SpaceScout coordinates 5 specialized NASA endpoints:

| Tool | Source | Data Provided |
|---|---|---|
| `apod` | Astronomy Picture of the Day | Daily high-res cosmic astrophotography, video features, and professional explanations |
| `neows` | Near Earth Object Web Service | Real-time asteroid close-approach tracking, hazard classifications, and miss distances |
| `donki` | Space Weather Database | Solar flares, coronal mass ejections, and geomagnetic storm event chronologies |
| `nasa_images` | NASA Image & Video Library | Deep space mission media, historical mission archives (Hubble, Webb, Apollo), and centers |
| `epic` | DSCOVR Spacecraft | Full-disc natural color Earth observations taken from the Sun-Earth L1 Lagrange point |

*(Note: SpaceScout coordinates real observation data from the sources listed above. Dedicated Mars Rover Photos are not part of the active tool set).*

---

## Security Practices

* **Encrypted Credential Storage**: User-provided API keys (OpenRouter, NASA) are encrypted using **Fernet symmetric encryption** (`cryptography` library) before being persisted in PostgreSQL. Secret keys are never stored in plaintext.
* **Server-Side Execution**: All AI completions and NASA queries execute server-side in Django. Provider keys are decrypted in memory only at execution time and are never bundled into client scripts or exposed in HTML.
* **Masked Credential Hints**: API read endpoints expose only masked previews (e.g. `••••abcd`) so users can identify configured keys without disclosing plaintext to the browser.
* **Strict Redaction in Error Logs**: Internal exception traces, database connection strings, and credential secrets are redacted from API error responses.
* **Transport & Cookie Security**: In production, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `X_FRAME_OPTIONS = 'DENY'`, and `SECURE_CONTENT_TYPE_NOSNIFF` are enforced. Edge TLS termination is handled via `SECURE_PROXY_SSL_HEADER`.

---

## Local Development Setup

### Prerequisites
* **Python 3.12+** and [uv](https://github.com/astral-sh/uv) (recommended) or standard `python3-venv`
* **Node.js 18.18+** and `npm`
* A free NASA API key from [api.nasa.gov](https://api.nasa.gov/)
* An OpenRouter API key from [openrouter.ai](https://openrouter.ai/)

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment and install dependencies
uv venv
# On Windows: .venv\Scripts\activate
# On macOS/Linux: source .venv/bin/activate
uv pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env` with your development keys:
```env
DJANGO_SECRET_KEY=development-secret-key-32-chars-minimum
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CREDENTIAL_ENCRYPTION_KEY=dGVzdF9mZXJuZXRfa2V5XzMyX2J5dGVzX2xvbmdfMTIzNDU=
OPENROUTER_API_KEY=sk-or-v1-your-key
NASA_API_KEY=your-nasa-key
```

Run database migrations and start the server:
```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
The backend API will run at `http://localhost:8000/`.

---

### 2. Frontend SPA Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment (optional: defaults to http://localhost:8000)
cp .env.example .env.local

# Start development server
npm run dev
```
The exploration application will run at `http://localhost:5173/`.

---

### 3. Standalone Landing Website Setup

```bash
cd landing

# Install dependencies
npm install

# Configure environment (optional: defaults to http://localhost:5173 for app handoff)
cp .env.example .env.local

# Start development server
npm run dev
```
The marketing landing page will run at `http://localhost:3000/`.

---

## Running Tests

### Backend Tests (Django)
```bash
cd backend
uv run python manage.py test api
```

### Frontend Tests (Vitest & RTL)
```bash
cd frontend
npm test
npm run typecheck
```

### Landing Application Tests (Node Test Runner & TypeScript)
```bash
cd landing
npm test
npm run typecheck
npm run build
```

---

## Project Context Documentation

Comprehensive architecture, roadmap, and design documentation is maintained in the `docs/` directory:

| Document | Purpose |
|---|---|
| [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Technical stack, data model, API contracts, deployment details |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | High-level architecture, orchestrator design, landing app integration |
| [ROADMAP.md](docs/ROADMAP.md) | Implementation milestones, completed phases, and remaining tasks |
| [DESIGN.md](docs/DESIGN.md) | Visual design system, component guidelines, and HTML mockups |
| [DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) | Engineering standards, security guidelines, and development workflow |
| [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | Product principles and additive exploration model |

---

## License

SpaceScout V2 is released under the [MIT License](LICENSE).
Astronomy data and media are provided courtesy of NASA Open APIs. SpaceScout is an independent application and is not affiliated with or endorsed by NASA.

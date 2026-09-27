# SpaceScout V2

SpaceScout is an AI-powered space exploration application. Users ask questions about space in natural language, and SpaceScout uses AI to determine which NASA data sources are relevant, retrieves the data, and presents structured discoveries.

SpaceScout V2 is a separate monorepo based on a copy of V1, evolving the project into a persistent, discovery-first exploration experience.

## Status

**Early V2 development.** The V1 core functionality (planner, NASA tools, authentication) is working. The V2 data model has been partially evolved. The frontend redesign has not yet been implemented.

## Features

### Implemented (V1 foundation)

* Natural-language space queries
* AI-powered tool selection via planner and tool registry
* NASA Astronomy Picture of the Day (APOD)
* NASA Near Earth Object Web Service (NeoWs)
* NASA DONKI Solar Flare data
* Structured discovery results with Pydantic validation
* User authentication with JWT
* React + TypeScript interface

### In Progress (V2)

* HTML mockup for the redesigned UI (`design/mockups/`)
* Data model evolution (Interactions, DiscoveryMedia, ProviderCredential, UserProfile)

### Planned (V2)

* Persistent, additive explorations with follow-up interactions
* BYOK (Bring Your Own Key) for OpenRouter and NASA
* Additional NASA capabilities
* Full application redesign (Home, Explore, Explorations, Settings)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, Axios, Lucide React |
| Backend | Python 3.12, Django 6, Django REST Framework, SimpleJWT, Pydantic |
| AI | OpenAI SDK via OpenRouter |
| Data | NASA APIs (APOD, NeoWs, DONKI), SQLite (development) |
| Tools | uv (Python), npm (JavaScript) |

## Repository Structure

```text
SpaceScout-v2/
├── backend/          — Django backend (API, planner, NASA services)
│   ├── config/       — Django project settings
│   ├── api/          — Models, views, serializers, URL routing
│   │   ├── engine/   — Space planner, tool registry, system prompt
│   │   └── services/ — NASA API service layer
│   └── manage.py
├── frontend/         — React + TypeScript + Vite frontend
│   └── src/
│       ├── pages/    — Planner, Login, Register, NotFound
│       ├── components/
│       ├── api/      — API client
│       ├── context/  — React context providers
│       └── styles/
├── design/           — HTML/CSS design mockups (not tracked in Git)
│   └── mockups/
├── docs/             — Project context documentation (not tracked in Git)
└── AGENTS.md         — Agent instruction file
```

## Design Mockups

The V2 visual direction is explored through standalone HTML mockups in `design/mockups/`. These files can be opened directly in a browser — no server required.

The primary design reference is `design/mockups/explore-professional-refined.html`.

See `docs/DESIGN.md` for the full design documentation.

## Setup

### Requirements

* Python 3.12+
* Node.js and npm
* A NASA API key ([api.nasa.gov](https://api.nasa.gov/))
* An OpenRouter API key ([openrouter.ai](https://openrouter.ai/))

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend runs at `http://127.0.0.1:8000/`.

### Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
NASA_API_KEY=your_nasa_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
LLM_MODEL=your_model_name  # optional — default uses OpenRouter free models
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173/`.

Both the Django backend and React frontend must be running simultaneously.

## Documentation

| Document | Description |
|---|---|
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | System overview, tech stack, data model, current state |
| [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | Product goals and UX direction |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture |
| [docs/DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) | Development practices |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Project phases and priorities |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual design system and mockup reference |

## Project Background

SpaceScout was originally built as a final project for CS50's Web Programming with Python and JavaScript. V2 is a continuation developed as a separate monorepo, evolving the project into a more complete, production-oriented application.

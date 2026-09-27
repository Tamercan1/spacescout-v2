# SpaceScout V2 — Agent Instructions

SpaceScout V2 is a monorepo with a Django backend (`backend/`), React + TypeScript frontend (`frontend/`), and HTML design mockups (`design/mockups/`).

## Project Context

The `docs/` directory contains the project's authoritative context documents. Read the relevant documents before implementing a task — do not read every document for every request.

| Document | Purpose |
|---|---|
| [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Current system state, tech stack, data model, and implementation details |
| [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | Product goals, exploration concept, and UX direction |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture, planner, tool registry, and provider abstraction |
| [DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) | Development practices, security rules, and implementation workflow |
| [ROADMAP.md](docs/ROADMAP.md) | Project phases and priorities |
| [DESIGN.md](docs/DESIGN.md) | Visual design system, mockup reference, and UI conventions |

## Implementation Rules

1. **Read before implementing.** Consult the relevant context documents before making significant changes. Understand the existing code and architecture first.

2. **Work in approved phases.** SpaceScout V2 follows the phased roadmap in `docs/ROADMAP.md`. When a phase is approved, implement it autonomously — including necessary supporting changes (migrations, serializers, tests) — while staying within the approved scope.

3. **Verify and report.** After implementing changes, verify that affected behavior works correctly. Report what was changed, what was verified, and any issues encountered.

4. **Do not rewrite unnecessarily.** Preserve working functionality. Extend existing systems rather than replacing them without a concrete reason.

5. **Security first for credentials.** Never expose provider credentials to the frontend in plaintext, commit secrets, or log API keys. See `docs/DEVELOPMENT_RULES.md` for the full security rules.

6. **Design before UI.** Follow the mockup-first workflow defined in `docs/DESIGN.md` for major visual changes. Do not implement substantial React UI changes without an approved design direction.
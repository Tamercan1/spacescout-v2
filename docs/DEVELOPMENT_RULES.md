# SpaceScout — Development Rules

## 1. Understand Before Implementing

Before making significant changes:

1. Inspect the existing implementation.
2. Understand how the relevant system currently works.
3. Identify affected components and dependencies.
4. Consider whether the existing architecture already supports the requirement.
5. Propose the implementation approach before writing substantial code.

Do not rewrite working systems simply because another architecture is possible.

---

## 2. Consult Before Significant Implementation

For meaningful features or architectural changes:

```text
Requirement
    ↓
Inspect existing code
    ↓
Propose design
    ↓
Discuss / validate
    ↓
Implement
    ↓
Test
```

Do not immediately implement a major feature based only on a short user request.

Small mechanical changes may be implemented directly when the intended behavior is already clear.

---

## 3. Preserve Working Functionality

Treat the existing application as a working foundation.

Before modifying existing behavior:

* identify what currently works
* avoid unnecessary breaking changes
* preserve existing APIs and behavior when practical
* explicitly identify migrations or breaking changes when they are necessary

Do not refactor unrelated code during feature implementation.

---

## 4. Prefer Simple Architecture

Use the simplest architecture that properly satisfies the requirement.

Avoid introducing:

* unnecessary frameworks
* unnecessary abstractions
* excessive design patterns
* dependencies that solve problems the project does not have

Existing systems such as the tool registry should be extended when appropriate rather than replaced without a concrete reason.

---

## 5. Separate Responsibilities

Keep responsibilities clear between:

```text
Frontend
    ↓
API / application layer
    ↓
Domain / planner logic
    ↓
Provider / service layer
    ↓
External APIs
```

Avoid putting business logic into UI components or provider-specific logic into unrelated application code.

---

## 6. Security First for Credentials

Never:

* hard-code API keys
* commit secrets
* expose provider credentials unnecessarily
* log API keys
* return raw credentials through API responses
* expose provider credentials to the frontend in plaintext

BYOK credentials require deliberate security design before implementation.

Security-sensitive changes should be reviewed carefully rather than treated as ordinary CRUD features.

---

## 7. AI-Assisted Development

AI-generated code is acceptable, but generated code must be understandable and reviewed.

Use AI to accelerate:

* repetitive implementation
* boilerplate
* mechanical refactoring
* routine UI/CSS work
* test scaffolding

Do not use AI as a substitute for understanding:

* architecture
* data flow
* authentication
* security
* business logic
* important algorithms
* external API behavior

If generated code introduces an abstraction or dependency, explain why it is needed.

---

## 8. Incremental Changes

Prefer small, verifiable changes over large uncontrolled implementations.

After meaningful changes:

1. Run relevant tests/checks:
   * Backend: `uv run python manage.py test`
   * Frontend tests: `npm test` (or `npx vitest run <path_to_test>`)
   * Frontend lint & build: `npm run lint` and `npm run build`
2. Verify affected behavior.
3. Check for regressions.
4. Continue only when the current step is stable.

Avoid implementing an entire V2 feature in one giant change when it can reasonably be divided into smaller stages.

---

## 9. Design Before UI Implementation

For major UI/UX changes:

```text
Idea
 ↓
HTML mockup
 ↓
Review
 ↓
Revision
 ↓
Approved design
 ↓
React implementation
```

Do not immediately modify the production React interface when the visual direction is still uncertain.

The final implementation should follow the approved design rather than allowing implementation constraints to define the design prematurely.

See `docs/DESIGN.md` for the current design documentation and mockup reference.

---

## 10. Explain Important Decisions

When proposing a significant change, briefly explain:

* what is changing
* why it is needed
* what existing behavior it affects
* important tradeoffs
* what remains intentionally unchanged

Do not provide unnecessary explanations for obvious mechanical changes.

---

## 11. Validate External Assumptions

For external APIs, libraries, models, or services:

* verify current documentation when relevant
* do not assume undocumented behavior
* account for errors, limits, and unavailable data
* avoid designing around deprecated functionality

---

## 12. Keep the Product Goal in Mind

Every significant change should support SpaceScout's core purpose:

> A discovery-first space exploration application that helps users build persistent, NASA-backed explorations.

Do not add complexity merely because it is technically interesting.

A technically impressive feature that weakens the exploration experience is not automatically an improvement.

---

## 13. Phase-Based Implementation

SpaceScout V2 is developed in approved phases as defined in `docs/ROADMAP.md`.

When a phase has been approved for implementation:

* Work autonomously within the approved scope.
* Include necessary supporting changes (migrations, serializers, tests) that are required by the approved work.
* Do not extend into unapproved phases without explicit approval.
* Verify changes after implementation.
* Report what was changed, what was verified, and any open issues.

---

## 14. Efficient API Calling & State Caching

Never introduce isolated, duplicate API calls across layout components and pages for the same resources.

Always utilize shared state providers (such as `PlansContext`) with:
* in-memory caching
* in-flight request deduplication
* optimistic cache mutations
* debounced remote synchronization where applicable (e.g. user theme preferences)

---

## 15. UI Testing by User

Do not launch automated browser testing subagents or automated browser drivers when implementing or fixing UI changes. The user tests the UI directly.

Keep verification focused on clean frontend code, unit/component tests in Vitest, linting (`npm run lint`), and build checks (`npm run build`).

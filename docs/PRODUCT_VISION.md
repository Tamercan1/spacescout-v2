# SpaceScout — Product Vision

## Vision

SpaceScout should evolve from a project that generates NASA-backed space discoveries into a **persistent, discovery-first space exploration experience**.

Users should be able to start with a simple question, discover interesting information, follow their curiosity, and gradually build an exploration that they can return to later.

SpaceScout should feel like an exploration application—not a generic chatbot wrapped around NASA APIs.

---

## Core Product Concept

The central concept of SpaceScout V2 is the **Exploration**.

An Exploration represents an ongoing investigation into a space-related topic. Each Exploration is persisted as a `SpacePlan` in the database.

Conceptually:

```text
Exploration (SpacePlan)
├── Original prompt
├── Context / summary
├── Discoveries
├── Follow-up interactions
└── Additional discoveries
```

---

## Discovery-First Experience

SpaceScout is not intended to become a general-purpose conversational AI application.

The primary output should remain **structured, useful discoveries backed by NASA data**.

AI should primarily help users:

* interpret natural-language questions
* determine what NASA data is relevant
* retrieve information through available tools
* organize the retrieved information
* explain why discoveries are interesting
* help users decide where to explore next

The AI should support exploration rather than become the product itself.

---

## Explorations Are Additive

An Exploration should accumulate knowledge over time.

### Core rule

> Follow-up interactions should add to or deepen an Exploration rather than silently destroying existing discoveries.

Examples:

```text
"Find more asteroids."
→ Add asteroid discoveries.

"Tell me more about this asteroid."
→ Add/deepen information related to that discovery.

"Find objects related to this one."
→ Add related discoveries.

"What about solar activity?"
→ Add relevant solar discoveries.

"Show me only hazardous objects."
→ Change the current view/filter without deleting discoveries.

"Start a completely different topic."
→ Create a new Exploration.
```

Existing discoveries should remain part of the underlying Exploration unless the user explicitly performs an action intended to remove something.

Filtering is a view operation, not a database deletion.

---

## Exploration Continuity

Users should be able to leave an Exploration and return to it later.

A previous Exploration should therefore represent more than a static generated response.

Conceptually:

```text
Near-Earth Asteroids
23 discoveries
7 follow-ups
Last explored: today

[Continue Exploration]
```

The exact interface is defined by the approved mockup and will be refined during design iteration.

---

## Discovery Identity

Because Explorations are additive, SpaceScout should avoid unnecessarily creating duplicate discoveries when the same underlying NASA object or event is encountered again.

The implementation uses `external_id` per discovery with a unique constraint per SpacePlan and source to prevent duplicates.

Examples of external identifiers:

* NeoWs → NASA object identifier
* DONKI → event identifier
* APOD → date

Deduplication should prevent accidental repetition without incorrectly merging genuinely distinct discoveries.

---

## NASA-Backed Exploration

NASA data should remain a fundamental part of the product.

The application should grow beyond its original three capabilities and eventually support additional NASA data sources when they provide genuinely different and useful exploration capabilities.

Current capabilities include:

* APOD
* Near Earth Object Web Service
* DONKI Solar Flare data

Planned V2 expansion should add approximately three additional useful capabilities.

New integrations should be selected based on usefulness and quality, not simply on increasing the number of APIs.

---

## Natural-Language Interaction

Users should not need to understand NASA APIs or technical query parameters.

They should be able to express curiosity naturally.

Examples:

```text
"What are some interesting asteroids approaching Earth?"

"Show me recent solar activity."

"Find some interesting exoplanets."

"Tell me more about the second object."

"What other discoveries are related to this one?"
```

SpaceScout should translate this intent into appropriate tool usage and structured discoveries.

---

## BYOK

V2 should support Bring Your Own Key (BYOK) for:

* OpenRouter
* NASA API

Users may optionally provide their own credentials.

The default application configuration should remain available where appropriate.

The BYOK system should be treated as a fundamental platform capability rather than merely a settings-page feature.

Conceptually:

```text
User Request
     ↓
Credential Resolution
     ↓
User Credential?
 ├── Yes → Use user's credential
 └── No  → Use application default
     ↓
Provider
```

User credentials must be handled securely:

* Never be exposed to the frontend in plaintext
* Never be committed to source control
* Never be returned in plaintext through normal API responses
* Never be written to application logs
* Never be exposed to other users
* Be stored securely if persistence is required

The BYOK architecture is implemented in `backend/api/services/credentials.py`: user keys are encrypted with Fernet symmetric encryption, validated before storage, masked in API responses, and resolved dynamically per request with system defaults as fallbacks.

---

## Application Structure

SpaceScout V2 has evolved beyond a single Planner-centered interface into a full multi-page application:

```text
Home
Explore
Explorations
Settings
```

### Home

The starting point for users and a place to encourage exploration with suggestion chips and quick-start prompts.

### Explore

The primary active exploration experience featuring the exploration overview, additive discovery card grid, follow-up interaction dock, and chronological InteractionStream.

### Explorations

A collection of the user's existing and resumable explorations, offering search, archive filtering, and direct continuation.

### Settings

Account and provider configuration, including BYOK key management, preferred LLM model selection, and theme switching.

---

## Design Direction

SpaceScout should feel:

* modern
* polished
* professional
* approachable
* responsive
* visually coherent
* connected to space and exploration

It should **not** rely excessively on:

* futuristic UI clichés
* excessive glowing effects
* unnecessary animations
* overly complicated interfaces
* visual decoration that competes with the discoveries

The design should prioritize clarity and usability over spectacle.

The approved HTML mockup in `design/mockups/` is the initial design reference. See `docs/DESIGN.md` for full design documentation.

---

## AI Behavior

AI-generated content should remain grounded in retrieved data.

The planner should use available NASA tools when factual NASA information is required rather than inventing information.

The system should distinguish between:

* retrieved NASA data
* AI-generated explanations or summaries
* user-provided context

When data cannot be retrieved or a request cannot be answered using available capabilities, the application should communicate that clearly rather than fabricate a discovery.

---

## Product Boundaries

SpaceScout should not become:

* a general-purpose chatbot
* a social network
* an unrestricted AI research assistant
* a generic search engine
* a collection of unrelated NASA APIs

New features should strengthen the central exploration experience.

---

## V2 Success Criteria

SpaceScout V2 should feel meaningfully different from V1 because users can:

1. Start an exploration naturally.
2. Receive structured NASA-backed discoveries.
3. Continue exploring without losing previous discoveries.
4. Follow up on individual discoveries.
5. Resume previous explorations.
6. Explore a wider range of NASA data.
7. Use their own OpenRouter and NASA credentials when desired.
8. Navigate a coherent multi-page application.
9. Understand what the system is doing without needing to understand its internal architecture.

---

## Design Decision Principle

When a future implementation decision is ambiguous, prefer the option that:

1. improves the user's ability to explore,
2. preserves useful existing discoveries and context,
3. keeps the experience discovery-first,
4. reduces unnecessary complexity,
5. maintains clear separation between AI reasoning, application logic, and external data,
6. preserves existing working functionality unless there is a clear reason to change it.

Detailed implementation decisions should be made after inspecting the existing codebase and, for significant features, discussing the proposed design before implementation.

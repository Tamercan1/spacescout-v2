# SpaceScout — Design

## Design Status

The visual design established in the approved mockup (`design/mockups/explore-professional-refined.html`) has been fully implemented into the production React + TypeScript application (`frontend/src/`).

Key implemented components:

* `layout/AppShell`, `AppNavbar`, `AppSidebar` — CSS grid desktop shell and responsive mobile drawer
* `pages/Home`, `Explore`, `Explorations`, `Settings`, `Onboarding` — Multi-page navigation
* `explore/InteractionStream` — Additive, multi-turn exploration feed
* Specialized Result Cards (`ApodResultCard`, `NeowsResultCard`, `DonkiResultCard`, `NasaImagesResultCard`, `EpicResultCard`, `GeneralResultCard`)
* Dark and light theme toggle with CSS custom properties, instant 0ms local caching, and debounced profile synchronization

---

## Design Workflow

```text
Concept
  ↓
HTML Mockup (design/mockups/)
  ↓
Review & Feedback
  ↓
Approved Direction
  ↓
React Implementation (frontend/src/)
```

Any future substantial visual features should continue to follow the mockup-first workflow before modifying production React components.

### Mockup rules

* Mockup files live in `design/mockups/`.
* Mockups are standalone HTML/CSS prototypes — no React, no backend, no database.
* External CDN resources (fonts, icons) are noted in each file's header comment.
* Do not modify application code in `backend/` or `frontend/` from within the design workflow.

---

## Design Goals

SpaceScout should feel:

* modern
* polished
* professional
* approachable
* clear
* responsive
* visually connected to space exploration

The interface should feel like a real product rather than a student project.

---

## Avoid Design Clichés

SpaceScout should not rely heavily on:

* excessive neon colors
* unnecessary glowing effects
* excessive gradients
* overly futuristic interfaces
* decorative animations
* complicated visual effects
* excessive glassmorphism
* visual elements that compete with content

Space-related aesthetics are welcome when they support the experience rather than becoming the experience.

---

## Visual Direction (from approved mockup)

The approved mockup establishes the following visual direction.

### Color System

The mockup defines a token-based color system with dark and light theme support.

**Dark theme (default):**

| Token       | Value       | Purpose                     |
|-------------|-------------|-----------------------------|
| `--base`    | `#0c1018`   | Page background             |
| `--surface` | `#0f141f`   | Card/panel backgrounds      |
| `--surface-2` | `#141a26` | Elevated surfaces           |
| `--surface-3` | `#1e2a3d` | Tertiary/active surfaces    |
| `--border`  | `#192333`   | Subtle borders              |
| `--border-2` | `#212e42`  | Prominent borders           |
| `--text-1`  | `#e8edf5`   | Primary text                |
| `--text-2`  | `#7a889c`   | Secondary/muted text        |
| `--text-3`  | `#424e5e`   | Tertiary/placeholder text   |

**Accent colors:**

| Token       | Value       | Usage                       |
|-------------|-------------|-----------------------------|
| `--blue`    | `#3b82f6`   | Primary action, brand       |
| `--amber`   | `#f59e0b`   | Warnings, hazardous status  |
| `--red`     | `#ef4444`   | Danger, destructive actions |
| `--green`   | `#22c55e`   | Success, safe status        |
| `--purple`  | `#a78bfa`   | Supplementary accent        |

Each accent has a `*-dim` variant (10% opacity) for subtle backgrounds.

**Light theme** inverts the surface hierarchy and adjusts accents for readability on light backgrounds.

### Typography

* Font family: `Inter` (Google Fonts), with system fallbacks
* Base font size: `15px`
* Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
* Letter spacing: tight for headings (`-0.02em`)
* Line height: `1.6` for body text
* Antialiased rendering

### Spacing and Radius

* Border radius: `8px` (standard), `12px` (large/cards)
* Transition timing: `0.18s ease`
* Navigation height: `56px`
* Default sidebar width: `260px`

---

## Application Layout

The mockup defines a CSS Grid shell layout:

```text
┌──────────────────────────────────┐
│              NAV                 │
├──────────┬───────────────────────┤
│          │                       │
│ SIDEBAR  │       MAIN            │
│          │                       │
│          │                       │
└──────────┴───────────────────────┘
```

* **Nav**: full-width sticky top bar (`56px` height)
* **Sidebar**: left panel (`260px` default, resizable via drag handle)
* **Main**: primary content area

Grid definition: `grid-template-areas: "nav nav" "sidebar main"`

---

## Navigation

The top navigation bar contains:

1. **Hamburger button** — toggles sidebar visibility
2. **Divider**
3. **Brand** — SpaceScout logo mark (blue square with search icon) + "SpaceScout" + "V2" badge
4. **Nav links** (desktop) — Home, Explore, Explorations, Settings
5. **Account dropdown** (right-aligned) — avatar, username, chevron; opens a dropdown with Settings, API Keys, and Sign Out

### Nav link behavior

* Active link: `--text-1` color with `--surface-2` background
* Hover: same treatment as active
* Icons are present in markup but hidden on desktop (shown on mobile bottom bar)

---

## Sidebar

The sidebar shows exploration history:

* **Header**: "Explorations" label + "New" button
* **Grouped items**: "Today", "This week", "Earlier"
* **Each item**: exploration title, discovery count, relative timestamp
* **Active item**: highlighted with `--blue-dim` background and left blue border
* **Desktop**: resizable via drag handle on right edge
* **Mobile**: slide-in overlay drawer triggered by hamburger

---

## Pages

The mockup demonstrates the following page areas:

### Home

* Centered layout with eyebrow text ("NASA-backed space exploration")
* Heading: "What are you curious about today?"
* Search box with prompt input and "Explore" button
* Suggestion chips below: preset prompts for quick starts

### Explore (Active Exploration)

* **Exploration header**: title, original prompt (dimmed), AI-generated summary, stat badges (discovery count, source count, interaction count), action buttons (share, archive, delete)
* **Discovery cards**: grid layout showing retrieved NASA data
* **Continue pane**: bottom-docked panel with input for follow-up prompts and suggestion chips; resizable via drag handle

### Explorations

* List/collection of the user's existing explorations (represented in sidebar)

### Settings

* Tab-based settings interface
* Desktop: sidebar navigation for settings sections
* Mobile: horizontal tab pills

---

## Discovery Cards

Discovery cards are the primary content element. The mockup shows:

* **Card structure**: surface background, rounded corners (`--radius-lg`), border
* **Type badge**: colored indicator showing source type (e.g., "Near-Earth Object" in blue, "Potentially Hazardous" in amber/red, "Solar Flare" in purple)
* **Title**: prominent, semibold
* **Summary**: secondary text with truncation
* **Facts/metadata**: key-value display within cards
* **Media**: image cards with full-bleed imagery
* **Actions**: per-card interaction options (e.g., "Deep Dive", "Compare", "Related")

### Implemented Dynamic Result Card Types

1. **`ApodResultCard` (`frontend/src/components/explore/ApodResultCard.tsx`)**:
   - Full-bleed media banner (image or responsive embedded video iframe)
   - Date badge and external HD media links
   - Rich textual explanation from NASA astronomers
2. **`NeowsResultCard` (`frontend/src/components/explore/NeowsResultCard.tsx`)**:
   - Close approach date and potentially hazardous status badge (amber/red)
   - Metric grid: estimated diameter (min/max meters), relative velocity (km/h), and miss distance (astronomical units/kilometers)
3. **`DonkiResultCard` (`frontend/src/components/explore/DonkiResultCard.tsx`)**:
   - Flare class badge (X-class extreme, M-class moderate, C-class minor)
   - Active solar region identifier, peak time, and start/end timestamps
4. **`NasaImagesResultCard` (`frontend/src/components/explore/NasaImagesResultCard.tsx`)**:
   - Query badges, search match count
   - Media asset card previews, NASA centers, and capture dates
5. **`EpicResultCard` (`frontend/src/components/explore/EpicResultCard.tsx`)**:
   - Full-disc Earth observation imagery from DSCOVR at Lagrange Point 1
   - Centroid latitude/longitude coordinates and UTC timestamp badges
6. **`GeneralResultCard` (`frontend/src/components/explore/GeneralResultCard.tsx`)**:
   - Multi-section markdown synthesis for comparisons and deep dives
   - Structured heading and bullet rendering
7. **`InteractionStream` (`frontend/src/components/explore/InteractionStream.tsx`)**:
   - Additive timeline tracking each interaction turn in chronological order
   - Status indicators (`completed`, `processing`, `failed`)
   - Confirmation pills for newly discovered records linked to the exploration

---

## Discovery-First UI

Discoveries are the primary content of SpaceScout.

The interface should make it easy to:

* scan discoveries
* understand what each discovery is
* identify its source/type
* open deeper information
* continue exploring
* distinguish different kinds of NASA data

Visual hierarchy should prioritize meaningful information over decoration.

---

## Exploration-Centered UX

The interface should communicate that an Exploration is an ongoing experience.

Users should understand:

* what they are currently exploring
* what they have already discovered
* what they can explore next
* how to continue an Exploration later

Follow-up interactions should feel like natural continuation rather than restarting the application.

---

## Responsive Design

The mockup defines explicit responsive behavior:

### Desktop (≥ 768px)

* Full grid layout with sidebar and main content
* Nav links displayed as text labels
* Sidebar with drag-to-resize handle

### Mobile (< 768px)

* **Bottom tab bar** replaces desktop nav links (Home, Explore, Explorations, Settings)
* **Sidebar**: becomes a slide-in overlay drawer, toggled via hamburger button
* **Settings**: horizontal tab pills replace sidebar navigation
* **Continue pane**: adapts to available space

Responsive behavior should be intentional rather than simply shrinking desktop layouts.

Navigation, discovery cards, exploration controls, dialogs, and settings should all have appropriate mobile behavior.

---

## Interaction Patterns

The mockup demonstrates these interaction behaviors:

* **Theme toggle**: light/dark mode switching
* **Account dropdown**: click to open/close with outside-click dismissal
* **Sidebar toggle**: hamburger button shows/hides sidebar
* **Sidebar resize**: drag handle on sidebar edge (desktop)
* **Continue pane resize**: drag handle on pane top edge
* **Suggestion chips**: clickable prompt suggestions
* **Explore simulation**: submitting a prompt injects animated discovery cards
* **Transitions**: `0.18s ease` default for hover and state changes

---

## Accessibility

The interface should prioritize:

* readable typography
* sufficient contrast
* clear interaction states
* keyboard accessibility
* semantic HTML
* meaningful labels (ARIA attributes present in mockup)
* understandable error states

Accessibility should be considered during design rather than added afterward.

---

## Design Implementation Rule

Do not introduce a new visual pattern or component repeatedly without considering whether it belongs in the shared design system.

Once the visual direction is approved, shared patterns should be extracted into reusable components and styles rather than duplicated throughout the application.

---

## Design Principle

> Design for exploration and clarity first; use visual style to support that experience, not replace it.

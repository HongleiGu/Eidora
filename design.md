# Eidora — Design Document

Story creation and text-based interactive game platform (detective, turtle soup, COC-style).
Human and AI collaborate inside a folder-based project. The agent reads and writes files;
the human edits them in any text editor.

---

## Entity taxonomy

| Folder | Type | Min definition | Notes |
|---|---|---|---|
| `characters/` | person / being | `name: "Guard #3"` | Player characters, full NPCs, walk-ons |
| `locations/` | place | `name: "The Locked Study"` | Nestable via `parent:` |
| `artifacts/` | significant object | `name: "A bloody glove"` | Clues, weapons, relics, props |
| `lore/` | everything else | `name: "The Blackwood Curse"` | Factions, events, creatures, laws, legends, rumors — typed by `type:` field |
| `documents/` | in-world or meta narrative | `title: "Lord Blackwood's Will"` | Timelines, manuscripts, maps, letters — not queryable as entities |
| `relations/` | graph edges | *(YAML, no body)* | One file per source entity slug |
| `scenarios/` | playable game or story | `name: "The Haunting"` | Holds premise, cast, optional solution |
| `sessions/` | live runtime state | *(folder)* | One subfolder per run; stores diffs only |
| `assets/` | media files | *(images, maps)* | Referenced by path string in front-matter |

---

## File format

All entity and document files are **Markdown with YAML front-matter** (gray-matter).

```markdown
---
id: inspector-morse          # defaults to filename slug if omitted
name: Inspector Morse
type: character              # implied by folder; explicit for lore/documents
visibility: public           # public | gm_only | author_only
---

Narrative content here. Supports full Markdown — headers, lists, tables.

## Secrets

Anything under a `## Secrets` heading is treated as `gm_only` regardless
of the file-level visibility flag.
```

- Front-matter: structured, agent-queryable
- Body: narrative prose, human and agent readable
- `## Secrets` section: always filtered before player-facing output
- Relations files and config files stay plain `.yaml` — no narrative body needed

---

## Folder structure

```
my-project/
├── .eidora/
│   └── project.yaml            # name, schema version, default scenario
│
├── world.md                    # world/setting definition
│
├── characters/
│   ├── inspector-morse.md
│   └── butler-jenkins.md       # can be front-matter only
│
├── locations/
│   ├── grand-manor.md
│   └── locked-study.md
│
├── artifacts/
│   └── poisoned-decanter.md
│
├── lore/                       # factions, events, creatures, laws, legends, rumors
│   ├── blackwood-household.md  # type: faction
│   ├── lords-death.md          # type: event
│   └── blackwood-curse.md      # type: legend
│
├── relations/                  # one .yaml per source entity, no circular deps
│   ├── inspector-morse.yaml
│   └── butler-jenkins.yaml
│
├── documents/                  # in-world and meta narrative content
│   ├── blackwood-will.md       # type: manuscript
│   ├── timeline-nov-12.md      # type: timeline
│   └── manor-ground-floor.md  # type: map
│
├── assets/
│   ├── characters/
│   └── locations/
│
├── scenarios/
│   └── haunting-of-blackwood.md
│
└── sessions/
    └── 2026-05-31-run-1/
        ├── meta.yaml
        ├── state.yaml
        ├── flags.yaml
        └── log.md
```

---

## Schemas

### world.md
```markdown
---
id: victorian-london
name: Victorian London
era: "1890s"
genre: [mystery, detective]
description: "Gas lamps, fog, class tension."
timelines:
  - id: main
    name: "The True History"
  - id: altered
    name: "After the Forgery"
---

Extended world description, lore overview, tone notes...
```

### characters/
```markdown
---
id: inspector-morse
name: Inspector Morse

# classification
role: player_character        # player_character | npc | background
status: alive                 # alive | dead | unknown | missing

# links (string IDs resolved to files)
location: oxford
faction: [thames-valley-police]

# optional traits (structured for agent queries)
traits:
  personality: [methodical, melancholic, perceptive]
  appearance: "Mid-50s, rumpled coat"

# only present when entity is used in a game
game_meta:
  archetype: investigator
  stats: { sanity: 65, investigation: 80 }

visibility: public
---

Narrative bio here.

## Secrets

He already suspects Jenkins but has no evidence yet.
```

Minimal form: `name: "Guard #3"` — front-matter only, no body required.

### locations/
```markdown
---
id: locked-study
name: The Locked Study
parent: grand-manor           # nesting — resolves to locations/grand-manor.md
type: room                    # continent|country|city|district|building|room|other
tags: [crime-scene, locked-room]
image: assets/locations/locked-study.jpg

game_meta:
  is_accessible: false
  unlock_condition: "Find the spare key in the wine cellar"

visibility: public
---
```

### artifacts/
```markdown
---
id: poisoned-decanter
name: The Poisoned Decanter
artifact_type: clue           # weapon | clue | document | treasure | prop
location: locked-study
owner: lord-blackwood

game_meta:
  discoverable: true
  discovered_by: []           # populated during session via state.yaml overlay
  reveals: "Cyanide. Purchased in Berlin, 1887."

visibility: public
---
```

### lore/
```markdown
---
id: blackwood-household
name: The Blackwood Household
type: faction                 # faction|event|creature|species|law|legend|rumor|custom
members: [lord-blackwood, butler-jenkins, maid-elspeth]
visibility: public
---
```

```markdown
---
id: lords-death
name: The Death of Lord Blackwood
type: event
date: "1893-11-12T23:00"
participants: [lord-blackwood]
location: locked-study
visibility: gm_only
---

Found slumped at his desk. Door locked from inside. Cyanide.
```

### documents/
```markdown
---
type: timeline                # timeline | manuscript | map | letter | codex | custom
title: "The Evening of 12 November 1893"
scenario: haunting-of-blackwood
visibility: gm_only
---

## 6:00 PM
Dinner party begins. Six guests.

## 9:00 PM
Jenkins slips away to the wine cellar.
```

```markdown
---
type: map
title: Grand Manor — Ground Floor
image: assets/locations/grand-manor-ground.png
location: grand-manor
pins:
  - target: locked-study
    x: 0.65
    y: 0.42
visibility: public
---
```

### relations/
```yaml
# relations/inspector-morse.yaml
# Entity files contain NO relations. This file is loaded separately on demand.

- target: sergeant-lewis
  type: "trusts completely"
  attitude: 85          # -100 (hostile) to 100 (devoted)
  two_way: true

- target: butler-jenkins
  type: "suspects"
  attitude: -30
  two_way: false
  note: "Hands were shaking at dinner."
```

### scenarios/
```markdown
---
id: haunting-of-blackwood
name: The Haunting of Blackwood Manor
game_type: detective          # detective | turtle_soup | coc | story | sandbox

world: victorian-london

# cast — all resolved to their respective folders
characters: [inspector-morse, lord-blackwood, butler-jenkins]
locations:  [grand-manor, locked-study, wine-cellar]
artifacts:  [jade-idol, poisoned-decanter]
lore:       [blackwood-household, lords-death]
documents:  [blackwood-will, timeline-nov-12]

game:
  premise: "Lord Blackwood was found dead in his locked study at 11pm."
  player_count: 1
  mechanics: [investigation, deduction, social]

visibility: public
---

Brief public-facing description of the scenario.

## Secrets

**Solution:** Butler Jenkins poisoned the decanter at 9pm using a duplicate key
he had cut six months earlier, after discovering the terms of the will.

**Win condition:** Player names Jenkins with at least 3 supporting clues.
```

### sessions/
```yaml
# sessions/2026-05-31-run-1/meta.yaml
scenario: haunting-of-blackwood
created: "2026-05-31"
player: "Honglei"
```

```yaml
# sessions/2026-05-31-run-1/state.yaml
# Diffs only — merged with base entities at runtime. Base files are never mutated.

characters:
  lord-blackwood:
    status: dead
  butler-jenkins:
    status: alive

artifacts:
  poisoned-decanter:
    discovered_by: [inspector-morse]

locations:
  locked-study:
    is_accessible: true
```

```yaml
# sessions/2026-05-31-run-1/flags.yaml
intro_complete: true
murder_revealed: false
butler_suspected: true
key_found: true
```

---

## Visibility system

| Value | Who can read | Use for |
|---|---|---|
| `public` | Players, agents, everyone | Normal world content |
| `gm_only` | GM / orchestrating agent only | Hidden solutions, event truths, NPC secrets |
| `author_only` | Author / design notes only | Structural notes, never surfaces in play |

`## Secrets` in any markdown body is always treated as `gm_only` regardless of
the file-level `visibility` field.

---

## Reveal system (EID-93)

`visibility` is the **static** authoring tier (above). `reveal` is a **dynamic,
play-time gate** layered on top — a *universal capability* on any entity, not a
new type. A "manuscript" is just `reveal: public`; a "secret" is `reveal: secret`.

```yaml
# entity front-matter
reveal: public   # default — visible whenever visibility allows
reveal: secret   # hidden from players until revealed during a session
```

**Reveal is manual** (v1): a secret stays hidden until something calls the reveal
handler. That "something" is either a human GM or an **AI GM** — both call the same
handler, so no condition DSL is needed; the revealer decides when.

**Where revealed-state lives:** per session, in `session_flags` under the key
`reveal:<entityType>:<slug>`. Revealing is session-scoped, so the same secret can
be hidden in one playthrough and revealed in another. Base entities never change.

**Player visibility (during a session)** = all of:
- `visibility === 'public'` (gm_only / author_only never reach players), AND
- `reveal !== 'secret'` OR the reveal flag is set for this session.

**Handler (`lib/sessions`):** `revealEntity` / `unrevealEntity` / `isRevealed` /
`listRevealed`, plus `visibleToPlayer(entity, revealedKeys)`. The AI GM (future,
server-side) imports `revealEntity` directly; a human GM gets a reveal button in
the Play surface (future epic). EID-93 lays this rail; the player-facing payoff
arrives with the Play surface.

---

## Play surface

Turns authored content + the session engine into a playable game. **v1 is
single-player + AI GM**, designed so multiplayer can be added without reworking
the loop.

### Principles

- **The session log is the source of truth.** Play is an append-only event log
  (`session_log`); the UI renders from it. State (flags, overrides, reveals) is
  derived/applied alongside.
- **Transport-agnostic.** v1 is plain request/response (no real-time). Multiplayer
  later adds a *delivery* layer over the log (Supabase Realtime, or a dedicated
  pub/sub at scale — TBD) **without changing the turn loop**.
- **AI GM via structured directives.** The GM turn is a structured (non-streaming)
  AI call returning `{ narration, actions[] }` — reliable JSON, every provider,
  no tool-use needed. Streaming is a later enhancement.
- **Human can step in.** A role-gated GM panel (gm/admin) exposes the solution,
  all entities, and manual controls (reveal, set flag, override) — same handlers
  the AI calls.

### The turn loop

1. Player message → append to log (`role: player`).
2. Server assembles **GM context**: scenario premise + **solution/secrets** (the GM
   knows all), the full cast (incl. gm_only), current state (flags, overrides,
   revealed set), recent log, and game-type guidance.
3. One AI call → `{ narration, actions }`.
4. Apply `actions` via the engine; append `narration` to log (`role: agent`).
5. Client re-renders from the updated log + player-visible state.

### Directive vocabulary (`actions[]`)

| Action | Effect (engine handler) |
|---|---|
| `{type:"reveal", target:"type:slug"}` | `revealEntity` — unhide a secret to players |
| `{type:"flag", key, value}` | `setFlag` — set game state |
| `{type:"override", entity:"type:slug", set:{…}}` | `setEntityOverride` — e.g. `status: dead` |
| `{type:"end", outcome:"solved"|"failed"|"ended"}` | mark the session concluded |

### Views

- **Player view**: the chat log, an input, a "discovered" panel (revealed entities),
  the public premise. Filtered by `visibleToPlayer` — players never see gm_only or
  un-revealed secrets.
- **GM panel** (gm/admin, opt-in toggle): solution, every entity, manual
  reveal/flag/override buttons. Off by default so a solo author doesn't spoil
  themselves.

### Game-type flow

One adaptive loop; the GM's system prompt specialises by `gameType`
(detective = investigate + accuse; turtle_soup = answer yes/no/irrelevant;
coc = dread + sanity; story = narrative; sandbox = open). No bespoke per-type UIs
in v1 beyond prompt guidance.

### Lifecycle & routes

- `/projects/[slug]/play` — session list + "New session" (pick a scenario).
- `/projects/[slug]/play/[sessionId]` — the play screen.
- Sessions are project-scoped (campaign normally; a template can be playtested).
- Resumable: the log + state persist; reopen to continue.

### Deferred to later

Multiplayer (presence + live delivery over the log), streaming GM narration,
native tool-calling, and bespoke per-game-type mechanics.

---

## Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| File format | `.md` + YAML front-matter | Structured front-matter for agent queries; rich markdown body for prose |
| IDs | Filename slug | No UUID generation; human-readable; stable references |
| Relations | Separate `relations/` folder | Avoids circular references on entity load; one file per source |
| Stats/game data | `game_meta:` block | Separates narrative from game-mechanical; block absent = pure story entity |
| Session state | Diff overlay in `sessions/` | Base entities stay pristine; new session = new folder |
| Lore | Single `lore/` folder typed by `type:` | Avoids proliferating thin folders (factions/, events/, etc.) |
| World | One `world.md` per project | Timelines/universes as sub-configs inside world.md, not separate files |
| Assets | Top-level `assets/` folder | Keeps content dirs scannable; referenced by path string in front-matter |

---

## Multi-user model

Eidora has three layers. **Authoring** produces a reusable template; a group **forks**
it into their own playable copy; each play sitting is a **session** that overlays
runtime state without mutating the copy.

| Layer | Table | What it is | Owned by | Edited in |
|---|---|---|---|---|
| **Project (template)** | `projects` (kind=`template`) | The authored world: entities, scenarios, lore | An author (`owner_id`) | Studio |
| **Campaign** | `projects` (kind=`campaign`, `forked_from` set) | A group's playable fork of a template | The group (via `project_members`) | Studio + Play |
| **Session** | `sessions` | One play sitting: chat log + live state | The group | Play surface |

A **campaign is just a project** with `kind=campaign` and `forked_from` pointing at
the source template. This means entities/worlds/relations tables stay unchanged
(always keyed by `project_id`), and the existing Studio + entity CRUD work on a
campaign with zero modification. Forking deep-copies the template's entities into
the new campaign project.

Runtime play state (who's dead, what's discovered) lives in `session_state` /
`session_flags` as overlays on the campaign's entities — the campaign's base
entities are never mutated, so a campaign can be replayed.

### Discord analogy

- **Project/template** ≈ a server *template*
- **Campaign** ≈ a server / guild (your party + your copy of the world)
- **Session** ≈ a channel / live play call

### New & modified tables

```
profiles                       -- 1:1 mirror of auth.users
  id            uuid pk = auth.uid()
  handle        text unique
  display_name  text
  avatar_url    text

projects        (MODIFIED)
  + owner_id     uuid → profiles      -- creator
  + kind         text   'template' | 'campaign'
  + forked_from  uuid → projects      -- null for templates
  + visibility   text   'private' | 'unlisted' | 'public'

project_members (NEW)               -- membership + roles for BOTH templates and campaigns
  project_id  uuid → projects
  user_id     uuid → profiles
  role        text   'admin' | 'gm' | 'player'
  added_at    timestamptz
  pk (project_id, user_id)

sessions        (UNCHANGED shape)    -- project_id IS the campaign
entities, worlds, relations          -- UNCHANGED (always project_id)
session_state, session_flags, session_log  -- UNCHANGED
```

### Roles

| Role | Can |
|---|---|
| `admin` | Manage members & settings, delete the campaign. A template's owner is its sole admin. |
| `gm` | Run sessions, see `gm_only` content, edit entities, control state |
| `player` | Play, see `public` content only |

### Template visibility

| Value | Who sees it | Forkable by |
|---|---|---|
| `private` | Owner + members only | Members |
| `unlisted` | Anyone with the link | Anyone with link |
| `public` | Listed in the public gallery | Anyone |

### Auth & RLS strategy

- **Supabase Auth** for accounts (email + OAuth later). `profiles` mirrors `auth.users`.
- **Shift from service-role-everywhere to user-scoped clients.** User-facing API
  routes use a request-scoped Supabase client (the user's JWT from cookies via
  `@supabase/ssr`), so **RLS enforces access**. The service-role client is kept only
  for admin scripts (`setup-db`, seeding).
- RLS policy sketch:
  - `projects` SELECT: `owner_id = auth.uid()` OR member OR `visibility in ('public','unlisted')`
  - `projects` UPDATE/DELETE: owner OR `admin` member
  - `entities/worlds/relations`: readable if the parent project is readable; writable by `gm`/`admin` members
  - `sessions/session_*`: restricted to members of the campaign
  - `gm_only` / `author_only` entity filtering stays **app-level** for now (player-context
    read filtering already exists in `lib/entities`); can be hardened into RLS later.

### Fork operation

`forkTemplate(templateId, userId)`:
1. Insert new `projects` row (`kind=campaign`, `forked_from=templateId`, `owner_id=userId`).
2. Deep-copy the template's `worlds`, `entities`, `relations` into the new project.
3. Insert `project_members(newProjectId, userId, 'admin')`.
4. Return the campaign. Done atomically via a Postgres function (`rpc`) for consistency.

### Play surface (future epic)

A campaign's sessions are Discord-like channels: multi-party chat (players +
GM-agent + narrator + system), live state overlay, flags. Real-time via **Supabase
Realtime** (broadcast + presence). The agent participates as a bot member — a player
message triggers a server-side AI call with session context, streamed back into the
log and broadcast to the channel. Detailed design deferred until the auth/fork
foundation lands.

---

## Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| File format | `.md` + YAML front-matter | Structured front-matter for agent queries; rich markdown body for prose |
| IDs | Filename slug | No UUID generation; human-readable; stable references |
| Relations | Separate `relations/` folder | Avoids circular references on entity load; one file per source |
| Stats/game data | `game_meta:` block | Separates narrative from game-mechanical; block absent = pure story entity |
| Session state | Diff overlay in `sessions/` | Base entities stay pristine; new session = new folder |
| Lore | Single `lore/` folder typed by `type:` | Avoids proliferating thin folders (factions/, events/, etc.) |
| World | One `world.md` per project | Timelines/universes as sub-configs inside world.md, not separate files |
| Assets | Top-level `assets/` folder | Keeps content dirs scannable; referenced by path string in front-matter |
| Storage | Supabase (cloud) is runtime; folders are export/import | Multiplayer needs a server; local files can't be shared by a live group |
| Template → play | Fork & own (deep copy into group-owned campaign) | Isolation; group customizes freely; editing a template never breaks a live game |
| Campaign = project | A campaign is a `projects` row with `forked_from` | Reuses entity tables + Studio unchanged; no parallel schema |
| Ownership | Group owns the campaign; admin is a role | Campaign survives when the admin leaves |

---

## Out of scope (for now)

- Multi-world projects
- Cross-project entity reuse / shared character libraries
- Asset storage / CDN
- Schema versioning and migration
- Snapshot/copy-on-write template updates flowing into existing campaigns

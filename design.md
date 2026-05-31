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

## Out of scope (for now)

- Multi-world projects
- Cross-project entity reuse / shared character libraries
- Real-time multiplayer sessions
- Asset storage / CDN
- Schema versioning and migration

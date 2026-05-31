/**
 * One-off script: seeds the EID Jira board with epics and stories.
 * Run once: pnpm tsx --env-file=.env scripts/seed-jira.ts
 */

const BASE_URL = "https://hongleigu19.atlassian.net";
const PROJECT_KEY = "EID";
const EMAIL = process.env.JIRA_EMAIL!;
const TOKEN = process.env.JIRA_API_TOKEN!;

const ISSUE_TYPES = {
  epic:  "10037", // 长篇故事
  task:  "10039", // 任务 (hierarchy 0 — used for stories under epics)
};

const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const headers = {
  Authorization: `Basic ${auth}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

async function createIssue(fields: Record<string, unknown>): Promise<{ key: string }> {
  const res = await fetch(`${BASE_URL}/rest/api/3/issue`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: { project: { key: PROJECT_KEY }, ...fields } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<{ key: string }>;
}

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

// ── Ticket plan ───────────────────────────────────────────────────────────────

const EPICS: Array<{
  summary: string;
  description: string;
  stories: Array<{ summary: string; description: string }>;
}> = [
  {
    summary: "Data Schema & Types",
    description:
      "Define all TypeScript interfaces, the gray-matter file format, and the entity resolver that backs the whole project.",
    stories: [
      {
        summary: "Define TypeScript interfaces for all entity types",
        description:
          "Character, Location, Artifact, Lore, Document, Scenario, World, Relation, Session. Covers both front-matter shape and the loaded entity object. Lives in src/types/.",
      },
      {
        summary: "Implement gray-matter parser for .md entity files",
        description:
          "Utility that reads a .md file, parses YAML front-matter, and returns a typed entity object. Handles missing id field (defaults to filename slug). Validates required fields.",
      },
      {
        summary: "Entity resolver: slug to loaded entity with visibility filtering",
        description:
          "Given an entity type and a slug, resolve and load the entity from disk. Apply visibility filtering (strip gm_only/author_only content from body and game_meta.secrets when caller is player-context). Handles the ## Secrets section convention.",
      },
      {
        summary: "Schema validation on write",
        description:
          "When the agent writes or updates an entity file, validate the front-matter against the type's required fields before saving. Return a structured error if validation fails.",
      },
    ],
  },
  {
    summary: "Core Data Layer",
    description:
      "CRUD operations for all entity folders, relations graph, and project/world config.",
    stories: [
      {
        summary: "Entity CRUD: characters, locations, artifacts",
        description:
          "Create, read, update, delete for the three core entity types. Create defaults to minimal form (name only). Read returns the parsed entity. Update merges front-matter and replaces body. Delete removes the file and its relations file if present.",
      },
      {
        summary: "Entity CRUD: lore, documents, scenarios",
        description:
          "Same CRUD contract as core entities but for lore (type-tagged), documents (type-tagged), and scenarios. Scenario creation pre-populates the game: block with game_type defaults.",
      },
      {
        summary: "Relations CRUD and bidirectional traversal",
        description:
          "Read/write relations/{slug}.yaml files. API: getRelations(slug), addRelation(source, target, type, attitude, twoWay), removeRelation. Bidirectional traversal: findRelationsTo(slug) scans all relations files for target matches.",
      },
      {
        summary: "World and project config management",
        description:
          "Read and write world.md (parsed as a special entity) and .eidora/project.yaml. Project init: create folder structure, write project.yaml and a starter world.md.",
      },
      {
        summary: "Entity index: list and filter entities by type and front-matter fields",
        description:
          "listEntities(type, filters?) — scans a folder, parses front-matter only (skip body for performance), returns filtered list. Used for scenario cast lookups, agent context building, and the CLI.",
      },
    ],
  },
  {
    summary: "Session Engine",
    description:
      "Runtime game state: session initialization, state overlay merge, flag management, and session log.",
    stories: [
      {
        summary: "Session initialization from scenario",
        description:
          "createSession(scenarioSlug, playerName) creates sessions/{date}-{slug}/ with meta.yaml, empty state.yaml, empty flags.yaml, and log.md. Returns the session path.",
      },
      {
        summary: "State overlay merge",
        description:
          "getMergedEntity(type, slug, sessionPath) loads the base entity and deep-merges the matching block from state.yaml on top of game_meta. Base files are never mutated. Used at every entity read during an active session.",
      },
      {
        summary: "Flag management",
        description:
          "getFlag(sessionPath, key), setFlag(sessionPath, key, value), listFlags(sessionPath). Flags are boolean or string values in flags.yaml. Atomic read-modify-write to avoid partial writes.",
      },
      {
        summary: "Session log: append and read transcript",
        description:
          "appendLog(sessionPath, role, content) appends a timestamped entry to log.md. readLog(sessionPath) returns the full transcript. Role is one of: player | agent | narrator | system.",
      },
    ],
  },
  {
    summary: "Project Scaffolding & CLI",
    description:
      "Developer tooling: eidora init, entity file templates, and CLI improvements.",
    stories: [
      {
        summary: "eidora init: scaffold a new project",
        description:
          "CLI command that creates the full folder structure (characters/, locations/, artifacts/, lore/, relations/, documents/, assets/, scenarios/, sessions/, .eidora/). Prompts for project name, world name, genre. Writes project.yaml and world.md starter.",
      },
      {
        summary: "Entity creation templates: minimal and full form per type",
        description:
          "For each entity type, define a minimal template (name only) and a full template (all optional fields commented out). Used by eidora init and by the agent when generating new entities.",
      },
      {
        summary: "Improve Jira CLI: add create and search commands",
        description:
          "Extend scripts/jira.ts with: create <type> <summary> [description] to create an issue, and search <jql> to run arbitrary JQL queries and display results.",
      },
    ],
  },
  {
    summary: "AI Integration",
    description:
      "Context builder for agent prompts, entity generation from AI output, and scenario-aware story generation.",
    stories: [
      {
        summary: "Context builder: load relevant entities for a scene",
        description:
          "buildContext(scenarioSlug, sessionPath?, focus?) loads the scenario cast, resolves all referenced entities (with visibility filtering for player context), and formats them into a structured prompt context block. focus is an optional subset of entity slugs to prioritise.",
      },
      {
        summary: "Entity generation: parse and save AI-produced entity files",
        description:
          "Given AI output (front-matter + markdown body), validate and save as a new entity file. Handles slug generation, conflict detection, and schema validation. Returns the created entity key.",
      },
      {
        summary: "Scenario generation: AI-assisted scenario scaffolding",
        description:
          "Given a world, game type, and brief premise, use the AI to generate a populated scenario: cast of characters, key locations, artifacts, a timeline document, and the solution block. Each generated entity is saved as a separate file.",
      },
    ],
  },
];

// ── Execution ─────────────────────────────────────────────────────────────────
// Pass --stories-only <EID-N,EID-N,...> to skip epic creation and attach tasks
// to pre-existing epic keys in order.
// Example: pnpm tsx --env-file=.env scripts/seed-jira.ts --stories-only EID-52,EID-53,EID-54,EID-55,EID-56

const args = process.argv.slice(2);
const storiesOnlyIdx = args.indexOf("--stories-only");
const existingEpicKeys: string[] =
  storiesOnlyIdx !== -1 ? (args[storiesOnlyIdx + 1] ?? "").split(",") : [];
const storiesOnly = storiesOnlyIdx !== -1;

(async () => {
  console.log(`\nSeeding EID Jira board${storiesOnly ? " (tasks only)" : ""}...\n`);
  let epicCount = 0;
  let taskCount = 0;

  for (let i = 0; i < EPICS.length; i++) {
    const epic = EPICS[i];
    let epicKey: string;

    if (storiesOnly) {
      epicKey = existingEpicKeys[i];
      if (!epicKey) { console.error(`No epic key provided for index ${i} (${epic.summary})`); continue; }
      console.log(`${c.bold("Epic")}  ${c.cyan(epicKey)}  ${epic.summary} ${c.dim("(existing)")}`);
    } else {
      try {
        const res = await createIssue({
          summary: epic.summary,
          description: adf(epic.description),
          issuetype: { id: ISSUE_TYPES.epic },
        });
        epicKey = res.key;
        console.log(`${c.bold("Epic")}  ${c.cyan(epicKey)}  ${epic.summary}`);
        epicCount++;
      } catch (err) {
        console.error(`${c.bold("Epic")}  FAILED  ${epic.summary}: ${(err as Error).message}`);
        continue;
      }
    }

    for (const story of epic.stories) {
      try {
        const { key: taskKey } = await createIssue({
          summary: story.summary,
          description: adf(story.description),
          issuetype: { id: ISSUE_TYPES.task },
          parent: { key: epicKey },
        });
        console.log(`  ${c.dim("Task")}  ${c.cyan(taskKey)}  ${story.summary}`);
        taskCount++;
      } catch (err) {
        console.error(`  ${c.dim("Task")}  FAILED  ${story.summary}: ${(err as Error).message}`);
      }
    }
  }

  console.log(
    `\n${c.green("Done.")}  ${storiesOnly ? "" : `Created ${epicCount} epic(s) and `}${taskCount} task(s).\n`
  );
})();

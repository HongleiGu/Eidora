/**
 * Story "bible" — the canonical GROUND TRUTH for a scenario (EID-114).
 * Generated once and persisted on the scenario; the GM reads it verbatim every
 * turn as fixed canon, so it stops re-inventing (and contradicting) facts.
 */
import { complete } from "../ai";
import type { Provider } from "../ai";

export interface BibleInput {
  gameType: string;
  worldText?: string;
  scenarioName: string;
  premise: string;
  solution: string;
  cast: { name: string; type: string; content: string; secrets: string }[];
}

const SYSTEM = `You are the story architect for an interactive game. Given the world, premise, intended solution, and cast, write the canonical GROUND TRUTH ("bible") that the Game Master will treat as FIXED FACT for every session.

Include:
1. What REALLY happened — the true sequence of events (the timeline).
2. Each character's real background, motive, secrets, and relationships.
3. Where the key clues/artifacts are and what each one proves.
4. The solution, stated clearly and decisively.
5. Any other facts the GM must keep consistent.

Write concise reference notes in Markdown (use headings/bullets). This is GM-only canon — be specific and DECISIVE. Where the inputs are vague, invent concrete details to fill the gaps; never leave ambiguity that would force the GM to improvise mid-play. Do not address the player; this is behind-the-screen truth.`;

export async function generateBible(
  input: BibleInput,
  opts: { provider?: Provider; model?: string } = {},
): Promise<string> {
  const castText = input.cast
    .map((c) => `- ${c.name} (${c.type})${c.content ? `: ${c.content}` : ""}${c.secrets ? `  [secret: ${c.secrets}]` : ""}`)
    .join("\n");

  const userPrompt = [
    input.worldText ? `# World\n${input.worldText}` : "",
    `# Game type\n${input.gameType}`,
    `# Scenario: ${input.scenarioName}\n${input.premise}`,
    input.solution ? `# Intended solution\n${input.solution}` : "",
    castText ? `# Cast\n${castText}` : "",
  ].filter(Boolean).join("\n\n");

  const result = await complete({
    provider: opts.provider,
    model: opts.model,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.7,
    maxTokens: 2000,
  });

  return result.text.trim();
}

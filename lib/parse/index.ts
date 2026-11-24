import { parseHeuristic } from "./heuristic";
import type { ParseResult } from "./types";

export type { ParseResult };

function hasClaudeCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

/** Use Claude when credentials are configured; otherwise (or if Claude fails) the built-in reader. */
export async function parseTrip(text: string): Promise<ParseResult> {
  if (hasClaudeCredentials()) {
    try {
      const { parseWithClaude } = await import("./claude");
      return { criteria: await parseWithClaude(text), reader: "claude" };
    } catch (err) {
      return {
        criteria: parseHeuristic(text),
        reader: "built-in",
        warning: `Claude couldn't read the description (${(err as Error).message}). Used the built-in reader instead.`,
      };
    }
  }
  return { criteria: parseHeuristic(text), reader: "built-in" };
}

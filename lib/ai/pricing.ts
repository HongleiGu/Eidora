/** Cost in USD per 1 000 000 tokens (input / output).
 *  Keep this table up to date as models change. */
export const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-8':             { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':           { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':   { input:  0.80, output:  4.00 },

  // OpenAI
  'gpt-4o':                      { input:  2.50, output: 10.00 },
  'gpt-4o-mini':                 { input:  0.15, output:  0.60 },
  'gpt-4-turbo':                 { input: 10.00, output: 30.00 },
  'o1':                          { input: 15.00, output: 60.00 },
  'o1-mini':                     { input:  3.00, output: 12.00 },

  // Groq (public pricing)
  'llama-3.3-70b-versatile':     { input:  0.59, output:  0.79 },
  'llama-3.1-8b-instant':        { input:  0.05, output:  0.08 },
  'mixtral-8x7b-32768':          { input:  0.24, output:  0.24 },
  'gemma2-9b-it':                { input:  0.20, output:  0.20 },
};

/** Returns estimated USD cost, or undefined if the model is not in the table. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const price = PRICING[model];
  if (!price) return undefined;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

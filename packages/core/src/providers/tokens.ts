/**
 * Estimate token count using a simple chars/4 heuristic.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

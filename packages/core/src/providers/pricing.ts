export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

// Default pricing for common models (USD per 1M tokens)
export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
  'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },
  'claude-sonnet-4-20250514': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.80, outputPer1M: 4.00 },
  'claude-opus-4-20250514': { inputPer1M: 15.00, outputPer1M: 75.00 },
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
};

export function getPricing(model: string): ModelPricing | undefined {
  return DEFAULT_PRICING[model];
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricing(model);
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.inputPer1M +
         (outputTokens / 1_000_000) * pricing.outputPer1M;
}

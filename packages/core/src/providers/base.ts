export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Infer the provider name from a model string.
 */
export function inferProvider(model: string): string {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
    return 'openai';
  }
  if (model.startsWith('claude-')) {
    return 'anthropic';
  }
  if (model.startsWith('gemini-') || model.startsWith('palm-')) {
    return 'google';
  }
  // Fall back to ollama for unknown/local models
  return 'ollama';
}

import type { ProviderAdapter, PromptCIConfig } from '../types.js';
import { ProviderError } from './base.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { OllamaAdapter } from './ollama.js';

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(name: string, adapter: ProviderAdapter): void {
    this.adapters.set(name, adapter);
  }

  get(name: string): ProviderAdapter | undefined {
    return this.adapters.get(name);
  }

  getOrThrow(name: string): ProviderAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new ProviderError(
        `Provider "${name}" is not registered. Available: ${[...this.adapters.keys()].join(', ')}`,
        name,
      );
    }
    return adapter;
  }
}

export function createDefaultRegistry(config: PromptCIConfig): ProviderRegistry {
  const registry = new ProviderRegistry();

  // OpenAI — register if configured or if OPENAI_API_KEY env var exists
  const openaiSettings = config.providers['openai'];
  const openaiKeyEnv = openaiSettings?.apiKeyEnv ?? 'OPENAI_API_KEY';
  if (openaiSettings !== undefined || process.env[openaiKeyEnv]) {
    try {
      registry.register('openai', new OpenAIAdapter({
        apiKeyEnv: openaiSettings?.apiKeyEnv,
        baseUrl: openaiSettings?.baseUrl,
      }));
    } catch { /* key not set — skip */ }
  }

  // Anthropic — register if configured or if ANTHROPIC_API_KEY env var exists
  const anthropicSettings = config.providers['anthropic'];
  const anthropicKeyEnv = anthropicSettings?.apiKeyEnv ?? 'ANTHROPIC_API_KEY';
  if (anthropicSettings !== undefined || process.env[anthropicKeyEnv]) {
    try {
      registry.register('anthropic', new AnthropicAdapter({
        apiKeyEnv: anthropicSettings?.apiKeyEnv,
      }));
    } catch { /* key not set — skip */ }
  }

  // Ollama — register if configured or if default endpoint is likely available
  const ollamaSettings = config.providers['ollama'];
  if (ollamaSettings !== undefined || process.env['OLLAMA_HOST']) {
    registry.register('ollama', new OllamaAdapter({
      baseUrl: ollamaSettings?.baseUrl ?? process.env['OLLAMA_HOST'],
    }));
  }

  return registry;
}

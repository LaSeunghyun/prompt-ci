import type { PromptCIConfig, ProviderAdapter } from '../types.js';

/**
 * Shared run context passed through the eval executor.
 */
export class RunContext {
  readonly startTime: number;
  readonly config: PromptCIConfig;
  private readonly _providers: Map<string, ProviderAdapter>;

  constructor(config: PromptCIConfig, providers: Map<string, ProviderAdapter>) {
    this.startTime = Date.now();
    this.config = config;
    this._providers = providers;
  }

  /**
   * Look up a provider adapter by name.
   */
  getProvider(name: string): ProviderAdapter | undefined {
    return this._providers.get(name);
  }

  /**
   * Return the default provider adapter, using config.defaultProvider as the
   * key. Returns undefined if no providers are registered.
   */
  getDefaultProvider(): ProviderAdapter | undefined {
    const key = this.config.defaultProvider;
    if (key) return this._providers.get(key);
    // Fallback: return the first registered provider
    return this._providers.values().next().value;
  }

  /**
   * Milliseconds elapsed since the run started.
   */
  elapsedMs(): number {
    return Date.now() - this.startTime;
  }
}

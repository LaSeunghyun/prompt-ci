import type { ProviderAdapter, ChatRequest, ChatResponse } from '../types.js';
import { ProviderError } from './base.js';
import { calculateCost } from './pricing.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicAdapterOptions {
  apiKeyEnv?: string;
}

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';

  private readonly apiKey: string;

  constructor(options: AnthropicAdapterOptions = {}) {
    const envVar = options.apiKeyEnv ?? 'ANTHROPIC_API_KEY';
    const key = process.env[envVar];
    if (!key) {
      throw new ProviderError(
        `Missing API key: environment variable ${envVar} is not set`,
        this.name,
      );
    }
    this.apiKey = key;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body: AnthropicRequest = {
      model: request.model,
      messages: [{ role: 'user', content: request.userMessage }],
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    if (request.system) body.system = request.system;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      const safeText = text.slice(0, 200).replace(/(sk-[A-Za-z0-9]+)/g, '[REDACTED]');
      throw new ProviderError(
        `Anthropic API error ${response.status}: ${safeText}`,
        this.name,
        response.status,
      );
    }

    const data = (await response.json()) as AnthropicResponse;
    const textBlock = data.content.find((b) => b.type === 'text');

    return {
      content: textBlock?.text ?? '',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: data.stop_reason,
    };
  }

  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    return calculateCost(model, inputTokens, outputTokens);
  }
}

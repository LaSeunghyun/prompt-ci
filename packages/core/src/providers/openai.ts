import type { ProviderAdapter, ChatRequest, ChatResponse } from '../types.js';
import { ProviderError } from './base.js';
import { calculateCost } from './pricing.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface OpenAIResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIAdapterOptions {
  apiKeyEnv?: string;
  baseUrl?: string;
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = 'openai';

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: OpenAIAdapterOptions = {}) {
    const envVar = options.apiKeyEnv ?? 'OPENAI_API_KEY';
    const key = process.env[envVar];
    if (!key) {
      throw new ProviderError(
        `Missing API key: environment variable ${envVar} is not set`,
        this.name,
      );
    }
    this.apiKey = key;

    const rawBase = options.baseUrl ?? 'https://api.openai.com';
    try {
      const parsed = new URL(rawBase);
      const blockedHosts = ['169.254.169.254', '0.0.0.0'];
      if (blockedHosts.includes(parsed.hostname)) {
        throw new ProviderError(`Provider baseUrl hostname is blocked: ${parsed.hostname}`, this.name);
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(`Invalid baseUrl: ${rawBase}`, this.name);
    }
    this.baseUrl = rawBase;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages: OpenAIMessage[] = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    messages.push({ role: 'user', content: request.userMessage });

    const body: OpenAIRequest = {
      model: request.model,
      messages,
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.topP !== undefined) body.top_p = request.topP;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      const safeText = text.slice(0, 200).replace(/(sk-[A-Za-z0-9]+)/g, '[REDACTED]');
      throw new ProviderError(
        `OpenAI API error ${response.status}: ${safeText}`,
        this.name,
        response.status,
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: choice.finish_reason,
    };
  }

  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    return calculateCost(model, inputTokens, outputTokens);
  }
}

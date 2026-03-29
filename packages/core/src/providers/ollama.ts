import type { ProviderAdapter, ChatRequest, ChatResponse } from '../types.js';
import { ProviderError } from './base.js';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream: false;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaResponse {
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

export interface OllamaAdapterOptions {
  baseUrl?: string;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly name = 'ollama';

  private readonly baseUrl: string;

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:11434';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages: OllamaMessage[] = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    messages.push({ role: 'user', content: request.userMessage });

    const body: OllamaRequest = {
      model: request.model,
      messages,
      stream: false,
    };

    const options: OllamaRequest['options'] = {};
    if (request.temperature !== undefined) options.temperature = request.temperature;
    if (request.topP !== undefined) options.top_p = request.topP;
    if (request.maxTokens !== undefined) options.num_predict = request.maxTokens;
    if (Object.keys(options).length > 0) body.options = options;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ProviderError(
        `Ollama API error ${response.status}: ${text}`,
        this.name,
        response.status,
      );
    }

    const data = (await response.json()) as OllamaResponse;
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

  estimateCost(_model: string, _inputTokens: number, _outputTokens: number): number {
    // Ollama runs locally - no cost
    return 0;
  }
}

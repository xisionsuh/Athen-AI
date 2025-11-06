import OpenAI from 'openai';
import { AIProvider } from './base.js';

/**
 * Grok AI Provider (xAI)
 * Grok은 xAI에서 제공하는 AI 모델입니다.
 * OpenAI 호환 API를 사용합니다.
 */
export class GrokProvider extends AIProvider {
  constructor(apiKey, model = 'grok-beta') {
    super('Grok', apiKey);
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    });
    this.model = model;
  }

  async chat(messages, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
      });

      return {
        content: response.choices[0].message.content,
        provider: this.name,
        model: this.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0
        }
      };
    } catch (error) {
      this.lastError = error.message;
      throw error;
    }
  }

  async streamChat(messages, options = {}) {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        stream: true,
      });

      return stream;
    } catch (error) {
      this.lastError = error.message;
      throw error;
    }
  }
}


import OpenAI from 'openai';
import { AIProvider } from './base.js';

export class OpenAIProvider extends AIProvider {
  constructor(apiKey, model = 'gpt-4-turbo-preview') {
    super('ChatGPT', apiKey);
    this.client = new OpenAI({ apiKey });
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
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens
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

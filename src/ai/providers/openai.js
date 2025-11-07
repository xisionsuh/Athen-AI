import OpenAI from 'openai';
import { AIProvider } from './base.js';

export class OpenAIProvider extends AIProvider {
  constructor(apiKey, model = 'gpt-5') {
    super('ChatGPT', apiKey);
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async chat(messages, options = {}) {
    try {
      const requestOptions = {
        model: this.model,
        messages: messages,
      };

      // gpt-5 모델은 max_completion_tokens 사용, temperature는 기본값만 지원
      if (this.model.startsWith('gpt-5') || this.model.includes('gpt-5')) {
        requestOptions.max_completion_tokens = options.maxTokens || 4096;
        // gpt-5는 temperature를 지원하지 않으므로 제외
      } else {
        requestOptions.max_tokens = options.maxTokens || 4096;
        requestOptions.temperature = options.temperature || 0.7;
      }

      const response = await this.client.chat.completions.create(requestOptions);

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
      const requestOptions = {
        model: this.model,
        messages: messages,
        stream: true,
      };

      // gpt-5 모델은 max_completion_tokens 사용, temperature는 기본값만 지원
      if (this.model.startsWith('gpt-5') || this.model.includes('gpt-5')) {
        requestOptions.max_completion_tokens = options.maxTokens || 4096;
        // gpt-5는 temperature를 지원하지 않으므로 제외
      } else {
        requestOptions.max_tokens = options.maxTokens || 4096;
        requestOptions.temperature = options.temperature || 0.7;
      }

      const stream = await this.client.chat.completions.create(requestOptions);

      return stream;
    } catch (error) {
      this.lastError = error.message;
      throw error;
    }
  }
}

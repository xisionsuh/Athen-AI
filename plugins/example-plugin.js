/**
 * 예제 플러그인
 * 플러그인 개발 가이드
 */

import { PluginBase } from '../src/plugins/pluginBase.js';

export default class ExamplePlugin extends PluginBase {
  constructor() {
    super(
      'example-plugin',
      '1.0.0',
      '플러그인 개발 예제'
    );
  }

  async initialize(config) {
    // 플러그인 초기화 로직
    console.log('Example plugin initialized');

    // 훅 등록 예제
    this.registerHook('beforeMessage', this.beforeMessage.bind(this));
    this.registerHook('afterMessage', this.afterMessage.bind(this));
  }

  /**
   * 메시지 전처리 훅
   */
  async beforeMessage(message, userId, sessionId) {
    // 메시지 전처리 로직
    console.log('Before message hook:', message);
    return message;
  }

  /**
   * 메시지 후처리 훅
   */
  async afterMessage(response, userId, sessionId) {
    // 응답 후처리 로직
    console.log('After message hook:', response);
    return response;
  }

  async cleanup() {
    // 정리 로직
    console.log('Example plugin cleaned up');
  }
}


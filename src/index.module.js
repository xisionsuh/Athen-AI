/**
 * Athena AI - 모듈화된 진입점
 * 다른 프로젝트에서 Athena AI를 모듈로 사용할 수 있도록 제공
 */

import { AthenaOrchestrator } from './core/orchestrator.js';
import { MemoryManager } from './memory/memoryManager.js';
import { WebSearchService } from './utils/webSearch.js';
import { PerformanceMonitor } from './utils/performanceMonitor.js';

/**
 * Athena AI 모듈 클래스
 * 간소화된 API 인터페이스 제공
 */
export class AthenaAI {
  constructor(config) {
    this.config = config;
    this.orchestrator = new AthenaOrchestrator(config);
    this.memory = this.orchestrator.memory;
    this.performanceMonitor = this.orchestrator.performanceMonitor;
    
    // WebSearchService는 선택적
    if (config.webSearchEnabled) {
      this.webSearch = new WebSearchService({
        searchApiKey: config.searchApiKey,
        searchEngineId: config.searchEngineId,
        dbPath: config.dbPath
      });
    }
  }

  /**
   * 메시지 처리 (간소화된 API)
   * @param {string} userId - 사용자 ID
   * @param {string} sessionId - 세션 ID
   * @param {string} message - 사용자 메시지
   * @param {object} options - 옵션 (searchResults 등)
   * @returns {Promise<object>} 응답 결과
   */
  async process(userId, sessionId, message, options = {}) {
    const searchResults = options.searchResults || null;
    return await this.orchestrator.process(userId, sessionId, message, searchResults);
  }

  /**
   * 스트리밍 메시지 처리
   * @param {string} userId - 사용자 ID
   * @param {string} sessionId - 세션 ID
   * @param {string} message - 사용자 메시지
   * @param {object} options - 옵션
   * @returns {AsyncGenerator} 스트리밍 응답
   */
  async *processStream(userId, sessionId, message, options = {}) {
    const searchResults = options.searchResults || null;
    const imageData = options.imageData || [];
    yield* this.orchestrator.processStream(userId, sessionId, message, searchResults, imageData);
  }

  /**
   * 메모리 관리
   */
  get memory() {
    return this.orchestrator.memory;
  }

  /**
   * 성능 모니터링
   */
  get performance() {
    return this.performanceMonitor;
  }

  /**
   * 웹 검색 (선택적)
   */
  async search(query, options = {}) {
    if (!this.webSearch) {
      throw new Error('Web search is not enabled');
    }
    return await this.webSearch.search(query, options);
  }
}

/**
 * 간단한 팩토리 함수
 */
export function createAthena(config) {
  return new AthenaAI(config);
}

// 기본 export
export default AthenaAI;


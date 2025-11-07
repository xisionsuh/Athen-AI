import express from 'express';
import { AthenaOrchestrator } from '../core/orchestrator.js';
import { WebSearchService } from '../utils/webSearch.js';
import { asyncHandler, createErrorResponse } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';

export function createRoutes(orchestrator, webSearch) {
  const router = express.Router();

  /**
   * POST /api/chat
   * 메인 채팅 엔드포인트
   */
  router.post('/chat', asyncHandler(async (req, res) => {
      const { userId, sessionId, message } = req.body;

      if (!userId || !sessionId || !message) {
      const error = new Error('필수 파라미터 누락: userId, sessionId, message');
      error.status = 400;
      throw error;
    }

    logger.debug('Chat request received', { userId, sessionId, messageLength: message.length });

    // 웹 검색 또는 YouTube 검색이 필요한지 확인
      const needsSearch = webSearch.needsWebSearch(message);
    const needsYouTube = webSearch.needsYouTubeSearch(message);
    const hasYouTubeLink = webSearch.hasYouTubeLink(message);
      let searchResults = null;
    let searchType = null;

    // 유튜브 링크가 포함된 경우 비디오 정보 가져오기
    if (hasYouTubeLink) {
      logger.info('📺 유튜브 링크 감지됨');
      try {
        const videoInfo = await webSearch.getYouTubeVideoFromUrl(message);
        if (videoInfo) {
          logger.info('✅ 유튜브 비디오 정보 가져옴', { title: videoInfo.title });
          searchResults = [{
            title: videoInfo.title,
            link: videoInfo.link,
            snippet: videoInfo.description || videoInfo.title,
            source: 'YouTube',
            videoId: videoInfo.videoId,
            thumbnail: videoInfo.thumbnail,
            channelTitle: videoInfo.channelTitle,
            publishedAt: videoInfo.publishedAt
          }];
          searchType = 'youtube_video';
        } else {
          logger.warn('⚠️ 유튜브 비디오 정보를 가져올 수 없습니다.');
        }
      } catch (error) {
        logger.logWebSearchError(error, message, { type: 'youtube_video' });
      }
    } else if (needsYouTube) {
      try {
        const searchData = await webSearch.search(message, { type: 'youtube' });
        searchResults = searchData.results;
        searchType = 'youtube';
        logger.info('YouTube 검색 완료', { resultsCount: searchResults?.length || 0 });
      } catch (error) {
        logger.logWebSearchError(error, message, { type: 'youtube' });
      }
    } else if (needsSearch) {
      try {
        const searchData = await webSearch.search(message);
        searchResults = searchData.results;
        searchType = 'web';
        logger.info('웹 검색 완료', { resultsCount: searchResults?.length || 0 });
      } catch (error) {
        logger.logWebSearchError(error, message, { type: 'web' });
        searchResults = null;
      }
    }

    // Orchestrator를 통해 처리 (검색 결과 전달)
    const result = await orchestrator.process(userId, sessionId, message, searchResults);

    logger.info('Chat response generated', {
      strategy: result.strategy,
      agentsUsed: result.agentsUsed,
      hasSearchResults: !!searchResults
    });

      res.json({
        success: true,
        response: result.content,
        metadata: {
          strategy: result.strategy,
          agentsUsed: result.agentsUsed,
          searchResults: searchResults,
        searchType: searchType,
          ...result.metadata
        }
      });
  }));

  /**
   * POST /api/chat/stream
   * 스트리밍 채팅
   */
  router.post('/chat/stream', asyncHandler(async (req, res) => {
    const { userId, sessionId, message } = req.body;

    if (!userId || !sessionId || !message) {
      const error = new Error('필수 파라미터 누락: userId, sessionId, message');
      error.status = 400;
      throw error;
    }

    logger.debug('Stream chat request received', { userId, sessionId, messageLength: message.length });

    // SSE 헤더 설정 (먼저 설정하여 스트리밍 시작)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 웹 검색 또는 YouTube 검색이 필요한지 확인
    let searchResults = null;
    
    try {
      const needsSearch = webSearch.needsWebSearch(message);
      const needsYouTube = webSearch.needsYouTubeSearch(message);
      const hasYouTubeLink = webSearch.hasYouTubeLink(message);

      logger.debug('검색 필요 여부 확인', { needsSearch, needsYouTube, hasYouTubeLink });

      if (hasYouTubeLink) {
        logger.info('📺 유튜브 링크 감지됨 (스트리밍)');
        try {
          const videoInfo = await webSearch.getYouTubeVideoFromUrl(message);
          if (videoInfo) {
            logger.info('✅ 유튜브 비디오 정보 가져옴 (스트리밍)', { title: videoInfo.title });
            searchResults = [{
              title: videoInfo.title,
              link: videoInfo.link,
              snippet: videoInfo.description || videoInfo.title,
              source: 'YouTube',
              videoId: videoInfo.videoId,
              thumbnail: videoInfo.thumbnail,
              channelTitle: videoInfo.channelTitle,
              publishedAt: videoInfo.publishedAt
            }];
          }
        } catch (error) {
          logger.logWebSearchError(error, message, { type: 'youtube_video', mode: 'stream' });
        }
      } else if (needsYouTube) {
        try {
          const searchData = await webSearch.search(message, { type: 'youtube' });
          searchResults = searchData.results;
          logger.info('YouTube 검색 완료 (스트리밍)', { resultsCount: searchResults?.length || 0 });
        } catch (error) {
          logger.logWebSearchError(error, message, { type: 'youtube', mode: 'stream' });
        }
      } else if (needsSearch) {
        try {
          const searchData = await webSearch.search(message);
          searchResults = searchData.results;
          logger.info('웹 검색 완료 (스트리밍)', { resultsCount: searchResults?.length || 0 });
        } catch (error) {
          logger.logWebSearchError(error, message, { type: 'web', mode: 'stream' });
          searchResults = null;
        }
      }
    } catch (searchError) {
      logger.logWebSearchError(searchError, message, { mode: 'stream' });
      searchResults = null;
    }

    logger.debug('orchestrator.processStream 호출 전', { searchResultsCount: searchResults?.length || 0 });

    // 스트리밍 처리
    try {
      for await (const chunk of orchestrator.processStream(userId, sessionId, message, searchResults)) {
        res.write(`data: ${chunk.trim()}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (streamError) {
      logger.error('Streaming error', streamError, { userId, sessionId });
      const errorJson = JSON.stringify({ type: 'error', error: streamError.message }, null, 0);
      res.write(`data: ${errorJson}\n\n`);
    }

    res.end();
  }));

  /**
   * POST /api/session/new
   * 새 세션 생성
   */
  router.post('/session/new', asyncHandler(async (req, res) => {
    const { userId, title } = req.body;

    if (!userId) {
      const error = new Error('userId 필요');
      error.status = 400;
      throw error;
    }

    // 사용자가 없으면 자동 생성
    try {
      const userStmt = orchestrator.memory.db.prepare(`
        INSERT OR IGNORE INTO users (id, email, name, last_login)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      userStmt.run(userId, `${userId}@athena.ai`, userId);
    } catch (userError) {
      logger.warn('User creation failed', userError, { userId });
    }

    const sessionId = orchestrator.memory.createSession(userId, title);
    logger.info('Session created', { userId, sessionId, title });

    res.json({
      success: true,
      sessionId
    });
  }));

  /**
   * GET /api/session/:sessionId
   * 세션 정보 조회
   */
  router.get('/session/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = orchestrator.memory.getSession(sessionId);

    if (!session) {
      const error = new Error('세션을 찾을 수 없습니다');
      error.status = 404;
      throw error;
    }

    const messages = orchestrator.memory.getShortTermMemory(sessionId);

    res.json({
      success: true,
      session,
      messages
    });
  }));

  /**
   * DELETE /api/session/:sessionId
   * 세션 삭제
   */
  router.delete('/session/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    orchestrator.memory.deleteSession(sessionId);
    logger.info('Session deleted', { sessionId });

    res.json({
      success: true,
      message: '세션이 삭제되었습니다'
    });
  }));

  /**
   * GET /api/sessions/:userId
   * 사용자의 모든 세션 조회
   */
  router.get('/sessions/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const sessions = orchestrator.memory.getUserSessions(userId);

    res.json({
      success: true,
      sessions
    });
  }));

  /**
   * POST /api/memory/long-term
   * 장기 기억 추가
   */
  router.post('/memory/long-term', asyncHandler(async (req, res) => {
    const { userId, category, title, content, tags, importance } = req.body;

    const result = orchestrator.memory.addLongTermMemory(
      userId,
      category,
      title,
      content,
      tags || [],
      importance || 5
    );

    logger.info('Long-term memory added', { userId, category, title });

    res.json({
      success: true,
      memoryId: result.lastInsertRowid
    });
  }));

  /**
   * GET /api/memory/long-term/:userId
   * 장기 기억 조회
   */
  router.get('/memory/long-term/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { category } = req.query;

    const memories = orchestrator.memory.getLongTermMemory(userId, category);

    res.json({
      success: true,
      memories
    });
  }));

  /**
   * GET /api/memory/search/:userId
   * 장기 기억 검색
   */
  router.get('/memory/search/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { q } = req.query;

    if (!q) {
      const error = new Error('검색어(q) 필요');
      error.status = 400;
      throw error;
    }

    const results = orchestrator.memory.searchLongTermMemory(userId, q);

    res.json({
      success: true,
      results
    });
  }));

  /**
   * GET /api/decision-log/:sessionId
   * 의사결정 로그 조회
   */
  router.get('/decision-log/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const log = orchestrator.memory.getDecisionLog(sessionId);

    res.json({
      success: true,
      log
    });
  }));

  /**
   * GET /api/health
   * AI 프로바이더 상태 확인
   */
  router.get('/health', asyncHandler(async (req, res) => {
    const status = {};

    for (const [name, provider] of Object.entries(orchestrator.providers)) {
      status[name] = provider.getStatus();
    }

    res.json({
      success: true,
      providers: status,
      currentBrain: orchestrator.currentBrain?.name || null
    });
  }));

  /**
   * POST /api/search
   * 웹 검색 엔드포인트
   */
  router.post('/search', asyncHandler(async (req, res) => {
    const { query, numResults, type } = req.body;

    if (!query) {
      const error = new Error('검색어(query) 필요');
      error.status = 400;
      throw error;
    }

    const results = await webSearch.search(query, { 
      numResults: numResults || 5,
      type: type || 'web'
    });

    res.json({
      success: true,
      ...results
    });
  }));

  /**
   * POST /api/search/youtube
   * YouTube 검색 전용 엔드포인트
   */
  router.post('/search/youtube', asyncHandler(async (req, res) => {
    const { query, numResults } = req.body;

    if (!query) {
      const error = new Error('검색어(query) 필요');
      error.status = 400;
      throw error;
    }

    const results = await webSearch.search(query, { 
      numResults: numResults || 5,
      type: 'youtube'
    });

    res.json({
      success: true,
      ...results
    });
  }));

  /**
   * GET /api/performance/stats
   * 성능 통계 조회
   */
  router.get('/performance/stats', asyncHandler(async (req, res) => {
    const { provider, taskType } = req.query;
    const stats = orchestrator.performanceMonitor.getPerformanceStats(provider, taskType);

    res.json({
      success: true,
      stats
    });
  }));

  /**
   * GET /api/performance/summary
   * 성능 요약 조회
   */
  router.get('/performance/summary', asyncHandler(async (req, res) => {
    const summary = orchestrator.performanceMonitor.getSummary();

    res.json({
      success: true,
      summary
    });
  }));

  /**
   * GET /api/performance/best/:taskType
   * 특정 작업에 대한 최적 AI 추천
   */
  router.get('/performance/best/:taskType', asyncHandler(async (req, res) => {
    const { taskType } = req.params;
    const bestProvider = orchestrator.performanceMonitor.getBestProviderForTask(taskType);

    res.json({
      success: true,
      bestProvider
    });
  }));

  return router;
}

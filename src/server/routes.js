import express from 'express';
import { AthenaOrchestrator } from '../core/orchestrator.js';
import { WebSearchService } from '../utils/webSearch.js';

export function createRoutes(orchestrator, webSearch) {
  const router = express.Router();

  /**
   * POST /api/chat
   * 메인 채팅 엔드포인트
   */
  router.post('/chat', async (req, res) => {
    try {
      const { userId, sessionId, message } = req.body;

      if (!userId || !sessionId || !message) {
        return res.status(400).json({
          error: '필수 파라미터 누락: userId, sessionId, message'
        });
      }

      // 웹 검색 또는 YouTube 검색이 필요한지 확인
      // 각 AI의 학습 날짜를 고려하여 자동으로 판단
      const needsSearch = webSearch.needsWebSearch(message);
      const needsYouTube = webSearch.needsYouTubeSearch(message);
      const hasYouTubeLink = webSearch.hasYouTubeLink(message);
      let searchResults = null;
      let searchType = null;

      // 유튜브 링크가 포함된 경우 비디오 정보 가져오기
      if (hasYouTubeLink) {
        console.log('📺 유튜브 링크 감지됨');
        const videoInfo = await webSearch.getYouTubeVideoFromUrl(message);
        if (videoInfo) {
          console.log('✅ 유튜브 비디오 정보 가져옴:', videoInfo.title);
          // 비디오 정보를 검색 결과 형식으로 변환
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
          console.log('⚠️ 유튜브 비디오 정보를 가져올 수 없습니다.');
        }
      } else if (needsYouTube) {
        // YouTube 검색
        const searchData = await webSearch.search(message, { type: 'youtube' });
        searchResults = searchData.results;
        searchType = 'youtube';
      } else if (needsSearch) {
        // 일반 웹 검색
        const searchData = await webSearch.search(message);
        searchResults = searchData.results;
        searchType = 'web';
      }

      // Orchestrator를 통해 처리 (검색 결과 전달)
      const result = await orchestrator.process(userId, sessionId, message, searchResults);

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
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/chat/stream
   * 스트리밍 채팅
   */
  router.post('/chat/stream', async (req, res) => {
    const { userId, sessionId, message } = req.body;

    if (!userId || !sessionId || !message) {
      return res.status(400).json({
        error: '필수 파라미터 누락: userId, sessionId, message'
      });
    }

    // SSE 헤더 설정 (먼저 설정하여 스트리밍 시작)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx 버퍼링 방지

    try {
      // 웹 검색 또는 YouTube 검색이 필요한지 확인 (에러 발생해도 계속 진행)
      let searchResults = null;
      let searchType = null;
      
      try {
        const needsSearch = webSearch.needsWebSearch(message);
        const needsYouTube = webSearch.needsYouTubeSearch(message);
        const hasYouTubeLink = webSearch.hasYouTubeLink(message);

        console.log('🔍 검색 필요 여부 확인:', { needsSearch, needsYouTube, hasYouTubeLink, message });

        // 유튜브 링크가 포함된 경우 비디오 정보 가져오기
        if (hasYouTubeLink) {
          console.log('📺 유튜브 링크 감지됨');
          const videoInfo = await webSearch.getYouTubeVideoFromUrl(message);
          if (videoInfo) {
            console.log('✅ 유튜브 비디오 정보 가져옴:', videoInfo.title);
            // 비디오 정보를 검색 결과 형식으로 변환
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
            console.log('⚠️ 유튜브 비디오 정보를 가져올 수 없습니다.');
          }
        } else if (needsYouTube) {
          // YouTube 검색
          console.log('📺 YouTube 검색 실행:', message);
          const searchData = await webSearch.search(message, { type: 'youtube' });
          searchResults = searchData.results;
          searchType = 'youtube';
          console.log('📺 YouTube 검색 결과:', searchResults?.length || 0, '개');
          console.log('📺 searchResults 타입:', typeof searchResults, Array.isArray(searchResults));
        } else if (needsSearch) {
          // 일반 웹 검색
          console.log('🌐 웹 검색 실행:', message);
          const searchData = await webSearch.search(message);
          console.log('🌐 searchData:', JSON.stringify(searchData).substring(0, 200));
          searchResults = searchData.results;
          searchType = 'web';
          console.log('🌐 웹 검색 결과:', searchResults?.length || 0, '개');
          console.log('🌐 searchResults 타입:', typeof searchResults, Array.isArray(searchResults));
          if (searchResults && searchResults.length > 0) {
            console.log('🌐 첫 번째 검색 결과:', searchResults[0].title);
          } else {
            console.log('⚠️ 검색 결과가 비어있습니다.');
          }
        } else {
          console.log('ℹ️ 웹 검색이 필요하지 않습니다.');
        }
      } catch (searchError) {
        console.error('❌ Web search error (continuing without search):', searchError);
        console.error('❌ Error stack:', searchError.stack);
        // 웹 검색 실패해도 스트리밍은 계속 진행
        searchResults = null;
      }

      console.log('📤 orchestrator.processStream 호출 전 searchResults:', searchResults?.length || 0, '개');

      // 스트리밍 처리 (검색 결과 전달)
      try {
        for await (const chunk of orchestrator.processStream(userId, sessionId, message, searchResults)) {
          // chunk는 이미 JSON 문자열 + \n 형식이므로 SSE 형식으로 전송
          // chunk 예: '{"type":"chunk","content":"안녕"}\n'
          res.write(`data: ${chunk.trim()}\n\n`);
        }
        res.write('data: [DONE]\n\n');
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        const errorJson = JSON.stringify({ type: 'error', error: streamError.message }, null, 0);
        res.write(`data: ${errorJson}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error('Chat stream error:', error);
      // SSE 헤더가 이미 설정되어 있으므로 JSON 대신 SSE 형식으로 에러 전송
      const errorJson = JSON.stringify({ type: 'error', error: error.message }, null, 0);
      res.write(`data: ${errorJson}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  /**
   * POST /api/session/new
   * 새 세션 생성
   */
  router.post('/session/new', async (req, res) => {
    try {
      const { userId, title } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId 필요' });
      }

      // 사용자가 없으면 자동 생성
      try {
        const userStmt = orchestrator.memory.db.prepare(`
          INSERT OR IGNORE INTO users (id, email, name, last_login)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        userStmt.run(userId, `${userId}@athena.ai`, userId);
      } catch (userError) {
        console.log('User already exists or creation failed:', userError.message);
      }

      const sessionId = orchestrator.memory.createSession(userId, title);

      res.json({
        success: true,
        sessionId
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/session/:sessionId
   * 세션 정보 조회
   */
  router.get('/session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = orchestrator.memory.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
      }

      const messages = orchestrator.memory.getShortTermMemory(sessionId);

      res.json({
        success: true,
        session,
        messages
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/session/:sessionId
   * 세션 삭제
   */
  router.delete('/session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      orchestrator.memory.deleteSession(sessionId);

      res.json({
        success: true,
        message: '세션이 삭제되었습니다'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/sessions/:userId
   * 사용자의 모든 세션 조회
   */
  router.get('/sessions/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const sessions = orchestrator.memory.getUserSessions(userId);

      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/memory/long-term
   * 장기 기억 추가
   */
  router.post('/memory/long-term', async (req, res) => {
    try {
      const { userId, category, title, content, tags, importance } = req.body;

      const result = orchestrator.memory.addLongTermMemory(
        userId,
        category,
        title,
        content,
        tags || [],
        importance || 5
      );

      res.json({
        success: true,
        memoryId: result.lastInsertRowid
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/memory/long-term/:userId
   * 장기 기억 조회
   */
  router.get('/memory/long-term/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { category } = req.query;

      const memories = orchestrator.memory.getLongTermMemory(userId, category);

      res.json({
        success: true,
        memories
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/memory/search/:userId
   * 장기 기억 검색
   */
  router.get('/memory/search/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({ error: '검색어(q) 필요' });
      }

      const results = orchestrator.memory.searchLongTermMemory(userId, q);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/decision-log/:sessionId
   * 의사결정 로그 조회
   */
  router.get('/decision-log/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const log = orchestrator.memory.getDecisionLog(sessionId);

      res.json({
        success: true,
        log
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/health
   * AI 프로바이더 상태 확인
   */
  router.get('/health', async (req, res) => {
    try {
      const status = {};

      for (const [name, provider] of Object.entries(orchestrator.providers)) {
        status[name] = provider.getStatus();
      }

      res.json({
        success: true,
        providers: status,
        currentBrain: orchestrator.currentBrain?.name || null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/search
   * 웹 검색 엔드포인트
   */
  router.post('/search', async (req, res) => {
    try {
      const { query, numResults, type } = req.body;

      if (!query) {
        return res.status(400).json({ error: '검색어(query) 필요' });
      }

      const results = await webSearch.search(query, { 
        numResults: numResults || 5,
        type: type || 'web' // 'web' or 'youtube'
      });

      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/search/youtube
   * YouTube 검색 전용 엔드포인트
   */
  router.post('/search/youtube', async (req, res) => {
    try {
      const { query, numResults } = req.body;

      if (!query) {
        return res.status(400).json({ error: '검색어(query) 필요' });
      }

      const results = await webSearch.search(query, { 
        numResults: numResults || 5,
        type: 'youtube'
      });

      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

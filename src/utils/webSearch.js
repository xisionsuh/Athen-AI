import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDatabase } from '../database/schema.js';

export class WebSearchService {
  constructor(config) {
    this.apiKey = config.searchApiKey;
    this.searchEngineId = config.searchEngineId;
    this.dbPath = config.dbPath;
  }

  /**
   * Google Custom Search API를 사용한 웹 검색
   */
  async searchGoogle(query, numResults = 5) {
    try {
      if (!this.apiKey || !this.searchEngineId) {
        console.error('⚠️ Google Search API 키가 설정되지 않았습니다.');
        console.error('   SEARCH_API_KEY:', this.apiKey ? '설정됨' : '없음');
        console.error('   SEARCH_ENGINE_ID:', this.searchEngineId ? '설정됨' : '없음');
        return [];
      }

      const url = 'https://www.googleapis.com/customsearch/v1';
      const params = {
        key: this.apiKey,
        cx: this.searchEngineId,
        q: query,
        num: numResults
      };

      console.log('🔍 Google 검색 실행:', query);
      const response = await axios.get(url, { params });

      const results = response.data.items?.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: 'Google'
      })) || [];

      console.log('✅ Google 검색 결과:', results.length, '개');
      // 캐시에 저장
      this.cacheSearchResults(query, results);

      return results;
    } catch (error) {
      console.error('❌ Google search error:', error.message);
      if (error.response) {
        console.error('   응답 상태:', error.response.status);
        console.error('   응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  /**
   * 간단한 웹 스크래핑 (API 없이 사용 가능)
   */
  async searchDuckDuckGo(query, numResults = 5) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result').slice(0, numResults).each((i, elem) => {
        const title = $(elem).find('.result__title').text().trim();
        const link = $(elem).find('.result__url').attr('href');
        const snippet = $(elem).find('.result__snippet').text().trim();

        if (title && link) {
          results.push({
            title,
            link,
            snippet,
            source: 'DuckDuckGo'
          });
        }
      });

      this.cacheSearchResults(query, results);

      return results;
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  /**
   * 검색 결과 캐싱
   */
  cacheSearchResults(query, results) {
    try {
      const db = getDatabase(this.dbPath);
      const stmt = db.prepare(`
        INSERT INTO search_cache (query, results, source)
        VALUES (?, ?, ?)
      `);
      stmt.run(query, JSON.stringify(results), 'web_search');
    } catch (error) {
      console.error('Cache error:', error);
    }
  }

  /**
   * 캐시에서 검색 결과 가져오기 (24시간 이내)
   */
  getCachedResults(query) {
    try {
      const db = getDatabase(this.dbPath);
      const stmt = db.prepare(`
        SELECT * FROM search_cache
        WHERE query = ?
        AND datetime(created_at) > datetime('now', '-24 hours')
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const result = stmt.get(query);

      if (result) {
        return JSON.parse(result.results);
      }
      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * 특정 URL의 내용 가져오기
   */
  async fetchPageContent(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);

      // 불필요한 요소 제거
      $('script, style, nav, footer, header, iframe, ads').remove();

      // 주요 텍스트 추출
      const title = $('title').text();
      const content = $('article, main, .content, #content, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // 최대 5000자

      return {
        url,
        title,
        content,
        success: true
      };
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error.message);
      return {
        url,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * YouTube 검색 (Google Custom Search API 사용)
   */
  async searchYouTube(query, numResults = 5) {
    try {
      if (!this.apiKey || !this.searchEngineId) {
        throw new Error('Google Custom Search API 키가 필요합니다');
      }

      // YouTube 사이트로 제한하여 검색
      const youtubeQuery = `site:youtube.com ${query}`;
      const url = 'https://www.googleapis.com/customsearch/v1';
      const params = {
        key: this.apiKey,
        cx: this.searchEngineId,
        q: youtubeQuery,
        num: numResults
      };

      const response = await axios.get(url, { params });

      const results = response.data.items?.map(item => {
        // YouTube URL에서 비디오 ID 추출
        const videoIdMatch = item.link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

        return {
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          source: 'YouTube',
          videoId: videoId,
          thumbnail: thumbnail
        };
      }) || [];

      // 캐시에 저장
      this.cacheSearchResults(`youtube:${query}`, results);

      return results;
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  }

  /**
   * 통합 검색 함수
   */
  async search(query, options = {}) {
    const numResults = options.numResults || 5;
    const useCache = options.useCache !== false;
    const searchType = options.type || 'web'; // 'web' or 'youtube'

    // 캐시 확인
    if (useCache) {
      const cacheKey = searchType === 'youtube' ? `youtube:${query}` : query;
      const cached = this.getCachedResults(cacheKey);
      if (cached) {
        return {
          results: cached,
          source: 'cache'
        };
      }
    }

    // YouTube 검색인 경우
    if (searchType === 'youtube') {
      const results = await this.searchYouTube(query, numResults);
      return {
        results,
        source: 'youtube'
      };
    }

    // 일반 웹 검색
    let results;
    if (this.apiKey && this.searchEngineId) {
      results = await this.searchGoogle(query, numResults);
    } else {
      results = await this.searchDuckDuckGo(query, numResults);
    }

    return {
      results,
      source: 'web'
    };
  }

  /**
   * 각 AI의 학습 날짜 (컷오프 날짜)
   * 이 날짜 이후의 정보는 웹 검색이 필요함
   */
  getAIKnowledgeCutoff(aiName) {
    const cutoffs = {
      'ChatGPT': '2024-04',      // GPT-4 Turbo 학습 날짜
      'Gemini': '2024-02',       // Gemini 2.0 학습 날짜
      'Claude': '2024-04',       // Claude 3.5 Sonnet 학습 날짜
      'Grok': '2024-04',         // Grok 학습 날짜
      'default': '2024-04'        // 기본값
    };
    return cutoffs[aiName] || cutoffs['default'];
  }

  /**
   * 질문에서 날짜 정보 추출 및 분석
   */
  extractDateInfo(query) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();

    const queryLower = query.toLowerCase();
    const dateInfo = {
      hasFutureDate: false,
      hasRecentDate: false,
      hasSpecificDate: false,
      extractedYear: null,
      extractedMonth: null,
      extractedDay: null
    };

    // 미래 날짜 키워드 (내일, 다음주, 다음달 등)
    const futureKeywords = ['내일', '다음주', '다음달', '내년', 'tomorrow', 'next week', 'next month', 'next year'];
    if (futureKeywords.some(kw => queryLower.includes(kw))) {
      dateInfo.hasFutureDate = true;
    }

    // 최근 날짜 키워드
    const recentKeywords = ['최근', '최신', '지금', '현재', '오늘', '이번', 'recent', 'latest', 'current', 'now', 'today'];
    if (recentKeywords.some(kw => queryLower.includes(kw))) {
      dateInfo.hasRecentDate = true;
    }

    // 연도 추출 (2024, 2025 등)
    const yearMatch = query.match(/20\d{2}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      dateInfo.extractedYear = year;
      if (year > currentYear) {
        dateInfo.hasFutureDate = true;
      }
      if (year === currentYear) {
        dateInfo.hasRecentDate = true;
      }
    }

    // 월 추출 (1월, 2월 등)
    const monthMatch = query.match(/(\d{1,2})월|(\d{1,2})\s*월/);
    if (monthMatch) {
      const month = parseInt(monthMatch[1] || monthMatch[2]);
      dateInfo.extractedMonth = month;
      dateInfo.hasSpecificDate = true;
    }

    return dateInfo;
  }

  /**
   * AI가 최신 정보가 필요한지 판단 (각 AI의 학습 날짜 고려)
   */
  needsWebSearch(query, aiName = null) {
    const currentDate = new Date();
    const cutoffDate = new Date(this.getAIKnowledgeCutoff(aiName || 'default'));
    
    // 날짜 정보 추출
    const dateInfo = this.extractDateInfo(query);

    // 미래 날짜가 포함된 질문은 항상 웹 검색 필요
    if (dateInfo.hasFutureDate) {
      return true;
    }

    // 최근 날짜 키워드가 있으면 웹 검색 필요
    if (dateInfo.hasRecentDate) {
      return true;
    }

    // 학습 날짜 이후의 연도가 포함된 경우
    if (dateInfo.extractedYear) {
      const cutoffYear = cutoffDate.getFullYear();
      const cutoffMonth = cutoffDate.getMonth() + 1;
      
      if (dateInfo.extractedYear > cutoffYear) {
        return true;
      }
      
      // 같은 연도라도 학습 날짜 이후의 월이면 검색 필요
      if (dateInfo.extractedYear === cutoffYear && dateInfo.extractedMonth) {
        if (dateInfo.extractedMonth > cutoffMonth) {
          return true;
        }
      }
    }

    // 시간 관련 키워드
    const timeKeywords = [
      '최신', '최근', '지금', '현재', '오늘', '이번',
      'latest', 'recent', 'current', 'now', 'today'
    ];

    // 뉴스/이벤트 키워드
    const newsKeywords = [
      '뉴스', '사건', '발표', '출시', '업데이트', '정책', '영향',
      'news', 'event', 'announcement', 'release', 'update', 'policy', 'impact'
    ];

    const queryLower = query.toLowerCase();

    // 시간 키워드 확인
    const hasTimeKeyword = timeKeywords.some(keyword =>
      queryLower.includes(keyword.toLowerCase())
    );

    // 뉴스 키워드 확인
    const hasNewsKeyword = newsKeywords.some(keyword =>
      queryLower.includes(keyword.toLowerCase())
    );

    // 날씨, 주가, 환율 등 실시간 정보 키워드
    const realtimeKeywords = [
      '날씨', '주가', '환율', '가격', 'weather', 'stock', 'exchange rate', 'price'
    ];
    const hasRealtimeKeyword = realtimeKeywords.some(keyword =>
      queryLower.includes(keyword.toLowerCase())
    );

    return hasTimeKeyword || hasNewsKeyword || hasRealtimeKeyword;
  }

  /**
   * YouTube 검색이 필요한지 판단
   */
  needsYouTubeSearch(query) {
    const youtubeKeywords = [
      '유튜브', 'youtube', '영상', '비디오', '튜토리얼', '강의',
      'video', 'tutorial', 'lecture', '강좌'
    ];
    const queryLower = query.toLowerCase();
    return youtubeKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
  }

  /**
   * 유튜브 링크에서 비디오 ID 추출
   */
  extractYouTubeVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\s?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * 메시지에 유튜브 링크가 포함되어 있는지 확인
   */
  hasYouTubeLink(message) {
    const youtubeUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/i;
    return youtubeUrlPattern.test(message);
  }

  /**
   * 유튜브 비디오 정보 가져오기 (YouTube Data API 사용)
   */
  async getYouTubeVideoInfo(videoId) {
    try {
      // YouTube Data API v3를 사용하여 비디오 정보 가져오기
      // API 키가 없으면 웹 스크래핑 시도
      if (!this.apiKey) {
        console.log('⚠️ YouTube Data API 키가 없어 웹 스크래핑을 시도합니다.');
        return await this.fetchYouTubeVideoInfo(videoId);
      }

      const url = 'https://www.googleapis.com/youtube/v3/videos';
      const params = {
        key: this.apiKey,
        id: videoId,
        part: 'snippet,contentDetails,statistics'
      };

      const response = await axios.get(url, { params });
      
      if (response.data.items && response.data.items.length > 0) {
        const video = response.data.items[0];
        return {
          title: video.snippet.title,
          description: video.snippet.description,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          duration: video.contentDetails?.duration,
          viewCount: video.statistics?.viewCount,
          likeCount: video.statistics?.likeCount,
          thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
          videoId: videoId,
          link: `https://www.youtube.com/watch?v=${videoId}`
        };
      }
      
      return null;
    } catch (error) {
      console.error('YouTube Data API error:', error.message);
      // API 실패 시 웹 스크래핑 시도
      return await this.fetchYouTubeVideoInfo(videoId);
    }
  }

  /**
   * 웹 스크래핑을 통한 유튜브 비디오 정보 가져오기
   */
  async fetchYouTubeVideoInfo(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // YouTube 페이지에서 메타데이터 추출 시도
      const title = $('meta[property="og:title"]').attr('content') || 
                    $('title').text().replace(' - YouTube', '');
      const description = $('meta[property="og:description"]').attr('content') || 
                         $('meta[name="description"]').attr('content') || '';
      const thumbnail = $('meta[property="og:image"]').attr('content') || 
                       `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      return {
        title: title,
        description: description.substring(0, 1000), // 최대 1000자
        thumbnail: thumbnail,
        videoId: videoId,
        link: url
      };
    } catch (error) {
      console.error('YouTube 웹 스크래핑 error:', error.message);
      return null;
    }
  }

  /**
   * 유튜브 링크에서 비디오 정보 가져오기
   */
  async getYouTubeVideoFromUrl(url) {
    const videoId = this.extractYouTubeVideoId(url);
    if (!videoId) {
      return null;
    }
    
    return await this.getYouTubeVideoInfo(videoId);
  }

  /**
   * 검색 결과를 AI가 이해하기 쉬운 형태로 포맷팅
   */
  formatResultsForAI(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return '';
    }
    
    return searchResults.map((result, index) => {
      const title = result.title || '제목 없음';
      const link = result.link || '';
      const snippet = result.snippet || '';
      
      return `[검색 결과 ${index + 1}]
제목: ${title}
출처: ${link}
내용: ${snippet}`;
    }).join('\n\n');
  }
}

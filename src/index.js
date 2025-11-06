import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import { initializeDatabase } from './database/schema.js';
import { AthenaOrchestrator } from './core/orchestrator.js';
import { WebSearchService } from './utils/webSearch.js';
import { createRoutes } from './server/routes.js';
import { setupPassport } from './server/auth.js';
import { createAuthRoutes } from './server/authRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
dotenv.config();

// 데이터베이스 초기화
const dbPath = process.env.DB_PATH || './data/athena.db';
initializeDatabase(dbPath);

// Passport 설정
setupPassport(dbPath);

// Web Search Service 초기화
const webSearch = new WebSearchService({
  searchApiKey: process.env.SEARCH_API_KEY,
  searchEngineId: process.env.SEARCH_ENGINE_ID,
  dbPath
});

// Athena Orchestrator 초기화 (WebSearchService 전달)
const orchestrator = new AthenaOrchestrator({
  dbPath,
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GOOGLE_AI_API_KEY,
  claudeApiKey: process.env.ANTHROPIC_API_KEY,
  grokApiKey: process.env.XAI_API_KEY, // .env 파일에서는 XAI_API_KEY로 정의됨
  webSearchEnabled: true,
  webSearchService: webSearch // WebSearchService 인스턴스 전달
});

// Express 앱 설정
const app = express();
const PORT = process.env.PORT || 3000;

// 세션 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'athena-ai-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS에서만 쿠키 전송
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30일
    }
  })
);

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 미들웨어
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 (프론트엔드) - 개발 모드에서는 캐시 방지
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, '../public'), {
    setHeaders: (res, path) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }));
} else {
  app.use(express.static(path.join(__dirname, '../public')));
}

// 인증 라우트
app.use('/auth', createAuthRoutes());

// API 라우트
app.use('/api', createRoutes(orchestrator, webSearch));

// 기본 라우트 - HTML 파일에 캐시 방지 헤더 추가
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║        🧠  ATHENA AI - Multi-Agent System        ║
║                                                   ║
║  Server running on http://localhost:${PORT}       ║
║                                                   ║
╚═══════════════════════════════════════════════════╝

AI Brain Hierarchy (Meta AI - 총괄 AI 우선순위):
${process.env.OPENAI_API_KEY ? '✓ 1st' : '✗ 1st'} ChatGPT (Primary Meta AI)
${process.env.GOOGLE_AI_API_KEY ? '✓ 2nd' : '✗ 2nd'} Gemini (Backup Meta AI)
${process.env.ANTHROPIC_API_KEY ? '✓ 3rd' : '✗ 3rd'} Claude (Backup Meta AI)
${process.env.XAI_API_KEY ? '✓ 4th' : '✗ 4th'} Grok (Final Backup Meta AI)

Database: ${dbPath}
  `);
});

export default app;

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initializeDatabase(dbPath = './data/athena.db') {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // 사용자 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // 정체성 데이터베이스 - 아테나의 인격, 행동 방법, 판단 가중치
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      category TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 단기 기억 - 대화 세션과 맥락
  db.exec(`
    CREATE TABLE IF NOT EXISTS short_term_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      message_type TEXT NOT NULL, -- 'user' or 'assistant'
      content TEXT NOT NULL,
      metadata TEXT, -- JSON 형태로 추가 정보 저장
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 장기 기억 - 영구히 기록되어야 할 프로젝트 단위 정보
  db.exec(`
    CREATE TABLE IF NOT EXISTS long_term_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL, -- 'project', 'preference', 'fact', etc.
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT, -- JSON array
      importance INTEGER DEFAULT 5, -- 1-10 scale
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // AI 판단 및 결정 로그
  db.exec(`
    CREATE TABLE IF NOT EXISTS decision_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      decision_type TEXT NOT NULL, -- 'agent_selection', 'collaboration', 'voting', etc.
      input TEXT NOT NULL,
      process TEXT NOT NULL, -- JSON 형태로 사고 과정 저장
      output TEXT NOT NULL,
      ai_used TEXT NOT NULL, -- JSON array of AI providers used
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 웹 검색 캐시
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      results TEXT NOT NULL, -- JSON
      source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI 성능 및 선호도 학습 데이터
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ai_provider TEXT NOT NULL,
      task_type TEXT NOT NULL,
      success_rate REAL DEFAULT 0.0,
      avg_response_time REAL DEFAULT 0.0,
      total_uses INTEGER DEFAULT 0,
      user_satisfaction REAL DEFAULT 0.0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 세션 관리
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_short_term_session ON short_term_memory(session_id);
    CREATE INDEX IF NOT EXISTS idx_short_term_user ON short_term_memory(user_id);
    CREATE INDEX IF NOT EXISTS idx_long_term_user ON long_term_memory(user_id);
    CREATE INDEX IF NOT EXISTS idx_long_term_category ON long_term_memory(category);
    CREATE INDEX IF NOT EXISTS idx_decision_session ON decision_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_search_query ON search_cache(query);
  `);

  console.log('Database initialized successfully');
  return db;
}

export function getDatabase(dbPath = './data/athena.db') {
  return new Database(dbPath);
}

# Athena AI 모듈 사용 가이드

Athena AI를 다른 프로젝트에서 모듈로 사용하는 방법을 안내합니다.

## 설치

```bash
npm install athena-ai
```

또는 로컬에서 개발 중인 경우:

```bash
npm link
```

## 기본 사용법

```javascript
import { AthenaAI } from 'athena-ai';

// Athena AI 인스턴스 생성
const athena = new AthenaAI({
  dbPath: './data/athena.db',
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GOOGLE_AI_API_KEY,
  claudeApiKey: process.env.ANTHROPIC_API_KEY,
  grokApiKey: process.env.XAI_API_KEY,
  webSearchEnabled: true,
  searchApiKey: process.env.SEARCH_API_KEY,
  searchEngineId: process.env.SEARCH_ENGINE_ID,
  mcpEnabled: true,
  mcpWorkspaceRoot: './workspace'
});

// 메시지 처리
const result = await athena.process('user123', 'session456', '안녕하세요!');

console.log(result.content); // AI 응답
console.log(result.metadata); // 메타데이터 (전략, 사용된 AI 등)
```

## 스트리밍 사용법

```javascript
// 스트리밍 응답 처리
for await (const chunk of athena.processStream('user123', 'session456', '질문')) {
  const data = JSON.parse(chunk);
  
  if (data.type === 'chunk') {
    process.stdout.write(data.content);
  } else if (data.type === 'metadata') {
    console.log('Metadata:', data.metadata);
  } else if (data.type === 'done') {
    console.log('\n완료');
  }
}
```

## 메모리 관리

```javascript
// 장기 기억 추가
athena.memory.addLongTermMemory('user123', 'project', '프로젝트 정보', '내용...');

// 장기 기억 검색
const memories = athena.memory.searchLongTermMemory('user123', '프로젝트');

// 단기 기억 가져오기
const context = athena.memory.getContextWindow('session456', 10);
```

## 성능 모니터링

```javascript
// 성능 데이터 조회
const stats = athena.performance.getStats('ChatGPT', 'general');

// API 사용량 조회
const usage = athena.performance.getAPIUsage({
  provider: 'ChatGPT',
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});
```

## 웹 검색

```javascript
// 웹 검색 수행
const results = await athena.search('최신 AI 뉴스', { type: 'web' });

// YouTube 검색
const youtubeResults = await athena.search('Python 튜토리얼', { type: 'youtube' });
```

## 고급 사용법

### 커스텀 설정

```javascript
const athena = new AthenaAI({
  dbPath: './custom-data/athena.db',
  // AI Provider 설정
  openaiApiKey: 'your-key',
  geminiApiKey: 'your-key',
  claudeApiKey: 'your-key',
  grokApiKey: 'your-key',
  // 웹 검색 설정
  webSearchEnabled: true,
  searchApiKey: 'your-key',
  searchEngineId: 'your-id',
  // MCP 설정
  mcpEnabled: true,
  mcpWorkspaceRoot: './custom-workspace'
});
```

### 에러 처리

```javascript
try {
  const result = await athena.process('user123', 'session456', '질문');
} catch (error) {
  console.error('Athena AI 오류:', error.message);
  // 에러 처리 로직
}
```

## API 참조

### AthenaAI 클래스

#### 생성자
- `new AthenaAI(config)` - Athena AI 인스턴스 생성

#### 메서드
- `process(userId, sessionId, message, options)` - 메시지 처리
- `processStream(userId, sessionId, message, options)` - 스트리밍 메시지 처리
- `search(query, options)` - 웹 검색 (webSearchEnabled가 true인 경우)

#### 속성
- `memory` - MemoryManager 인스턴스
- `performance` - PerformanceMonitor 인스턴스
- `webSearch` - WebSearchService 인스턴스 (선택적)

## 예제

### Express.js 서버에 통합

```javascript
import express from 'express';
import { AthenaAI } from 'athena-ai';

const app = express();
app.use(express.json());

const athena = new AthenaAI({
  dbPath: './data/athena.db',
  openaiApiKey: process.env.OPENAI_API_KEY,
  // ... 기타 설정
});

app.post('/api/chat', async (req, res) => {
  const { userId, sessionId, message } = req.body;
  
  try {
    const result = await athena.process(userId, sessionId, message);
    res.json({ success: true, response: result.content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000);
```

### Next.js API Route에 통합

```javascript
// pages/api/chat.js
import { AthenaAI } from 'athena-ai';

const athena = new AthenaAI({
  dbPath: './data/athena.db',
  openaiApiKey: process.env.OPENAI_API_KEY,
  // ... 기타 설정
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, sessionId, message } = req.body;
  
  try {
    const result = await athena.process(userId, sessionId, message);
    res.status(200).json({ success: true, response: result.content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

## 라이선스

MIT License


# Athena AI - 아키텍처 문서

## 시스템 개요

Athena는 여러 AI 모델을 통합하여 하나의 지능적인 인격체처럼 작동하는 멀티 에이전트 시스템입니다. 인간의 뇌처럼 중앙에서 총괄하는 Meta AI가 있고, 필요에 따라 다른 AI들을 협업시킵니다.

## 디렉토리 구조

```
Athena-AI/
├── src/
│   ├── ai/
│   │   └── providers/          # AI 프로바이더 통합
│   │       ├── base.js         # 기본 AI 인터페이스
│   │       ├── claude.js       # Anthropic Claude
│   │       ├── openai.js       # OpenAI ChatGPT
│   │       ├── gemini.js       # Google Gemini
│   │       └── meta.js         # Meta AI (Llama)
│   │
│   ├── core/
│   │   └── orchestrator.js     # 핵심 오케스트레이터 (Athena Brain)
│   │
│   ├── database/
│   │   └── schema.js           # 데이터베이스 스키마 및 초기화
│   │
│   ├── memory/
│   │   └── memoryManager.js    # 메모리 관리 시스템
│   │
│   ├── server/
│   │   └── routes.js           # Express API 라우트
│   │
│   ├── utils/
│   │   └── webSearch.js        # 웹 검색 서비스
│   │
│   ├── scripts/
│   │   └── initDatabase.js     # DB 초기화 스크립트
│   │
│   └── index.js                # 메인 서버 엔트리
│
├── public/                     # 프론트엔드 정적 파일
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── data/                       # 데이터 저장소 (gitignored)
│   └── athena.db
│
├── .env                        # 환경 변수 (gitignored)
├── .env.example
├── package.json
├── README.md
├── USAGE.md
└── ARCHITECTURE.md
```

## 핵심 컴포넌트

### 1. AthenaOrchestrator (src/core/orchestrator.js)

**역할**: Athena의 "뇌" - 모든 판단과 결정을 총괄

**주요 기능**:
- 질문 분석 및 전략 결정
- AI 프로바이더 관리 및 장애 복구
- 5가지 협업 모드 실행 (single, parallel, sequential, debate, voting)
- 메모리 시스템 통합

**플로우**:
```
사용자 입력
    ↓
질문 분석 (analyzeQuery)
    ↓
전략 결정 (strategy selection)
    ↓
┌─────────┬──────────┬────────────┬────────┬────────┐
│ Single  │ Parallel │ Sequential │ Debate │ Voting │
└─────────┴──────────┴────────────┴────────┴────────┘
    ↓
결과 종합
    ↓
응답 반환 + 메타데이터
```

### 2. AI Providers (src/ai/providers/)

**역할**: 각 AI 모델과의 통신 인터페이스

**구조**:
```javascript
class AIProvider {
  - name: string
  - isAvailable: boolean
  - chat(messages, options)
  - streamChat(messages, options)
  - checkHealth()
}
```

**지원 모델**:
- **Claude**: Anthropic Claude 3.5 Sonnet
- **ChatGPT**: OpenAI GPT-4 Turbo
- **Gemini**: Google Gemini 2.0 Flash
- **Meta AI**: Meta Llama 3.3 70B (via Together AI)

### 3. Memory System (src/memory/memoryManager.js)

**역할**: 3계층 메모리 시스템 관리

**메모리 계층**:

#### Identity (정체성)
- Athena의 인격, 성격, 목적
- 행동 방식, 판단 가중치
- 시스템 설정
- 영구 저장

#### Short-term Memory (단기 기억)
- 현재 세션의 대화 내용
- 맥락 유지 (컨텍스트 윈도우)
- 대명사 이해 ("그거", "아까 말한 것")
- 세션 종료 시 선택적 삭제

#### Long-term Memory (장기 기억)
- 프로젝트 정보
- 사용자 선호도
- 중요한 학습 내용
- 영구 저장, 검색 가능

**데이터베이스 스키마**:
```sql
- users              (사용자)
- identity           (정체성)
- short_term_memory  (단기 기억)
- long_term_memory   (장기 기억)
- decision_log       (의사결정 로그)
- sessions           (세션 관리)
- search_cache       (검색 캐시)
- ai_performance     (AI 성능 추적)
```

### 4. Web Search Service (src/utils/webSearch.js)

**역할**: 최신 정보 검색 및 제공

**기능**:
- Google Custom Search API 지원
- DuckDuckGo 백업 검색
- 검색 결과 캐싱 (24시간)
- 최신 정보 필요 여부 자동 판단

**판단 기준**:
- 시간 키워드 (최신, 최근, 현재, 2024, 2025 등)
- 뉴스 키워드 (뉴스, 발표, 출시, 업데이트 등)
- AI 지식 컷오프 날짜 이후의 연도

### 5. Express Server (src/index.js, src/server/routes.js)

**역할**: REST API 서버

**주요 엔드포인트**:
```
POST   /api/chat                  # 채팅
POST   /api/chat/stream           # 스트리밍 채팅 (예정)
POST   /api/session/new           # 새 세션 생성
GET    /api/session/:sessionId    # 세션 조회
GET    /api/sessions/:userId      # 사용자 세션 목록
POST   /api/memory/long-term      # 장기 기억 추가
GET    /api/memory/long-term/:id  # 장기 기억 조회
GET    /api/memory/search/:userId # 장기 기억 검색
GET    /api/decision-log/:session # 의사결정 로그
GET    /api/health                # AI 상태 확인
POST   /api/search                # 웹 검색
```

## 협업 모드 상세

### 1. Single (단일 실행)
```javascript
User Input → Meta AI analyzes → Select best AI → Response
```
- 가장 빠름
- 간단한 질문에 적합
- 특화된 AI 선택

### 2. Parallel (병렬 실행)
```javascript
User Input → Meta AI analyzes
    ↓
┌────────┬─────────┬────────┐
│ GPT    │ Gemini  │ Claude │
└────┬───┴────┬────┴───┬────┘
     └────────┴────────┘
              ↓
        Meta AI synthesizes
              ↓
          Response
```
- 다양한 관점
- 균형잡힌 답변
- 복잡한 주제

### 3. Sequential (순차 실행)
```javascript
Input → AI1 → Result1 → AI2 → Result2 → AI3 → Final
```
- 단계적 처리
- 각 단계가 다음 단계의 입력
- 체계적 작업

### 4. Debate (토론)
```javascript
Round 1:
  AI1 → Opinion A
  AI2 → Opinion B
  AI3 → Opinion C

Round 2 (considering others):
  AI1 → Revised Opinion A'
  AI2 → Revised Opinion B'
  AI3 → Revised Opinion C'

Meta AI → Conclusion
```
- 논쟁적 주제
- 깊이 있는 분석
- 다양한 의견 고려

### 5. Voting (투표)
```javascript
Each AI:
  - Analyzes problem
  - Provides opinion
  - Casts vote

Meta AI:
  - Counts votes
  - Explains majority
  - Mentions minority
  - Final decision
```
- 명확한 선택 필요
- 민주적 결정
- 합리적 판단

## 데이터 플로우

### 일반적인 채팅 플로우

```
1. User sends message
   ↓
2. Frontend (app.js)
   → POST /api/chat
   ↓
3. Express Router (routes.js)
   → orchestrator.process()
   ↓
4. AthenaOrchestrator
   ├─ Save to short-term memory
   ├─ Analyze query (strategy decision)
   ├─ Check if web search needed
   ├─ Execute strategy (single/parallel/etc)
   └─ Save decision log
   ↓
5. Response with metadata
   ↓
6. Frontend displays
   ├─ Message
   ├─ Strategy badge
   ├─ AI agents used
   └─ Link to decision log
```

### 장애 복구 플로우

```
Meta AI fails
   ↓
Try ChatGPT
   ↓ (if fails)
Try Gemini
   ↓ (if fails)
Try Claude
   ↓ (if all fail)
Error: All AI providers unavailable
```

## 확장성 설계

### 1. 새로운 AI 프로바이더 추가

```javascript
// src/ai/providers/newai.js
import { AIProvider } from './base.js';

export class NewAIProvider extends AIProvider {
  constructor(apiKey) {
    super('NewAI', apiKey);
  }

  async chat(messages, options) {
    // 구현
  }
}

// src/core/orchestrator.js에 추가
if (config.newAiApiKey) {
  providers['NewAI'] = new NewAIProvider(config.newAiApiKey);
}
```

### 2. 새로운 협업 모드 추가

```javascript
// orchestrator.js
async executeCustomMode(userId, sessionId, userMessage, strategy) {
  // 커스텀 로직 구현
}

// process()의 switch문에 추가
case 'custom':
  result = await this.executeCustomMode(...);
  break;
```

### 3. 플러그인 시스템 (향후)

```javascript
class AthenaPlugin {
  name: string;
  onBeforeChat(message): message;
  onAfterChat(response): response;
  onMemoryAccess(memory): void;
}
```

## 모듈화 설계

Athena를 다른 프로그램에 임베딩하기 위한 구조:

```javascript
// athena-module.js
import { AthenaOrchestrator } from './src/core/orchestrator.js';

export class AthenaModule {
  constructor(config) {
    this.orchestrator = new AthenaOrchestrator(config);
  }

  async chat(userId, message, context = {}) {
    // 간소화된 인터페이스
  }

  getMemory(userId) {
    // 메모리 접근
  }
}

// 다른 프로그램에서 사용
import { AthenaModule } from 'athena-module';

const athena = new AthenaModule({
  apiKeys: {...},
  dbPath: './data/my-app-athena.db'
});

const response = await athena.chat('user1', 'Hello Athena!');
```

## 성능 최적화

### 1. 캐싱
- 웹 검색 결과 (24시간)
- 전략 결정 패턴 학습 (향후)
- AI 응답 임베딩 (향후)

### 2. 병렬 처리
- 여러 AI 동시 호출
- 비동기 데이터베이스 작업

### 3. 리소스 관리
- 컨텍스트 윈도우 크기 제한
- 세션 자동 정리
- 오래된 캐시 삭제

## 보안 고려사항

### 1. API 키 관리
- 환경 변수로 분리
- .env 파일 gitignore
- 프로덕션에서는 비밀 관리 서비스 사용 권장

### 2. 데이터 보호
- 사용자 데이터 암호화 (향후)
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (입력 검증)

### 3. Rate Limiting
- API 호출 제한 (향후)
- 사용량 모니터링

## 향후 개선 방향

### Phase 1 (v1.1)
- [ ] Google OAuth 통합
- [ ] 스트리밍 응답
- [ ] MCP (Model Context Protocol) 지원
- [ ] 음성 입출력

### Phase 2 (v2.0)
- [ ] Artifacts (코드 실행, 미리보기)
- [ ] 웹 브라우저 통합
- [ ] 로컬 AI 모델 (Ollama 등)
- [ ] 자체 학습 시스템
- [ ] 플러그인 아키텍처

### Phase 3 (v3.0)
- [ ] 멀티모달 (이미지, 비디오)
- [ ] 에이전트 자율성 강화
- [ ] 분산 시스템 지원
- [ ] 커스텀 AI 트레이닝

## 테스트 전략

### 단위 테스트
```javascript
// tests/providers/claude.test.js
test('Claude provider should respond', async () => {
  const provider = new ClaudeProvider(API_KEY);
  const response = await provider.chat([
    { role: 'user', content: 'Hello' }
  ]);
  expect(response.content).toBeDefined();
});
```

### 통합 테스트
```javascript
// tests/orchestrator.test.js
test('Orchestrator should select appropriate strategy', async () => {
  const orchestrator = new AthenaOrchestrator(config);
  const strategy = await orchestrator.analyzeQuery(
    'user1',
    'session1',
    'Complex question requiring debate'
  );
  expect(strategy.collaborationMode).toBe('debate');
});
```

## 모니터링

### 로깅
- 모든 AI 호출 로깅
- 전략 결정 로깅
- 에러 추적

### 메트릭스
- AI별 사용 빈도
- 응답 시간
- 성공률
- 사용자 만족도

---

이 문서는 Athena AI 시스템의 전체 아키텍처를 설명합니다.
시스템 확장이나 커스터마이징 시 이 문서를 참고하세요.

# 🧠 Athena AI - Multi-Agent Collaborative System

여러 AI가 협업하여 하나의 인격체처럼 작동하는 지능형 AI 비서 시스템

## 📋 개요

Athena는 Claude, ChatGPT, Gemini, Meta AI 등 여러 AI 모델을 통합하여 하나의 인격체처럼 작동하는 혁신적인 AI 시스템입니다. 뇌(Brain)처럼 작동하는 Meta AI가 총괄 역할을 수행하며, 필요에 따라 다른 AI들을 협업시켜 최선의 답변을 제공합니다.

## ✨ 주요 기능

### 1. 🧠 뇌 기능 (Brain System)
- **Meta AI 총괄**: 모든 판단과 결정을 총괄하는 중앙 AI
- **장애 복구**: Meta AI 장애 시 자동으로 ChatGPT → Gemini → Claude 순으로 권한 위임
- **웹 검색 통합**: 최신 정보가 필요한 경우 자동으로 웹 검색 수행
- **출처 표시**: 모든 정보에 대한 출처 추적 및 표시

### 2. 💾 기억 시스템 (Memory System)
- **정체성 기억**: 아테나의 인격, 행동 방식, 판단 기준 저장
- **단기 기억**: 대화 맥락 유지 ("그거", "아까 말한 것" 등 이해)
- **장기 기억**: 프로젝트 단위의 영구 기록
- **SQLite 데이터베이스**: 모든 기억을 구조화하여 저장

### 3. 🤝 에이전트 협업 시스템
- **단일 실행**: 간단한 작업은 특화 AI가 단독 처리
- **병렬 협업**: 여러 AI가 동시에 작업하여 결과 종합
- **순차 실행**: 복잡한 작업을 단계별로 처리
- **토론 모드**: AI들이 의견을 교환하여 최선의 답 도출
- **투표 모드**: 다수결로 합리적인 결정

### 4. 🔍 웹 검색
- Google Custom Search API 지원
- DuckDuckGo 백업 검색
- 검색 결과 캐싱 (24시간)
- 최신 정보 자동 감지

### 5. 💬 사용자 인터페이스
- 깔끔한 채팅 인터페이스
- 실시간 AI 상태 모니터링
- 사고 과정(Decision Log) 확인
- 세션 관리
- 장기 기억 관리

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────┐
│           Athena Brain (Meta AI)             │
│         총괄 AI - 판단 및 결정              │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │   Strategy Analysis  │
    │   (전략 결정)       │
    └──────────┬──────────┘
               │
    ┌──────────┴───────────────────────┐
    │                                   │
┌───▼────┐  ┌─────────┐  ┌──────────┐ │
│ChatGPT │  │ Gemini  │  │  Claude  │ │
│        │  │         │  │          │ │
└────────┘  └─────────┘  └──────────┘ │
                                       │
                  ┌────────────────────┘
                  │
         ┌────────▼─────────┐
         │  Memory System   │
         │  - Identity      │
         │  - Short-term    │
         │  - Long-term     │
         └──────────────────┘
```

## 📦 설치 방법

### 1. 사전 요구사항
- Node.js 18 이상
- npm 또는 yarn

### 2. 프로젝트 클론 및 설치

```bash
cd Athena-AI
npm install
```

### 3. 환경 변수 설정

`.env.example` 파일을 `.env`로 복사하고 API 키를 설정합니다:

```bash
cp .env.example .env
```

`.env` 파일을 열어서 다음 정보를 입력:

```env
# AI API Keys
ANTHROPIC_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_AI_API_KEY=your_gemini_api_key
META_AI_API_KEY=your_together_ai_api_key  # Together AI 사용

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./data/athena.db

# Web Search (선택사항)
SEARCH_API_KEY=your_google_search_api_key
SEARCH_ENGINE_ID=your_search_engine_id
```

### 4. 데이터베이스 초기화

```bash
npm run db:init
```

### 5. 서버 실행

**개발 모드** (자동 재시작):
```bash
npm run dev
```

**프로덕션 모드**:
```bash
npm start
```

서버가 시작되면 http://localhost:3000 으로 접속합니다.

## 🔑 API 키 발급 방법

### Claude (Anthropic)
1. https://console.anthropic.com 접속
2. API Keys 메뉴에서 새 키 발급

### ChatGPT (OpenAI)
1. https://platform.openai.com 접속
2. API Keys 섹션에서 새 키 발급

### Gemini (Google AI)
1. https://makersuite.google.com/app/apikey 접속
2. API 키 생성

### Meta AI (Together AI)
1. https://api.together.xyz 접속
2. 회원가입 후 API 키 발급
3. Llama 모델 사용 가능

### Google Custom Search (선택)
1. https://developers.google.com/custom-search 접속
2. Custom Search Engine 생성
3. API 키 및 Search Engine ID 획득

## 📖 사용 방법

### 기본 채팅
1. 웹 브라우저에서 http://localhost:3000 접속
2. 메시지 입력창에 질문 입력
3. Athena가 자동으로 최적의 전략을 선택하여 응답

### 장기 기억 추가
- 채팅 중 "이거 기억해줘" 또는 장기 기억 버튼 사용
- 프로젝트 정보, 개인 선호도 등 저장

### 사고 과정 확인
- 각 응답 하단의 "🧠 사고 과정 보기" 클릭
- 어떤 AI가 사용되었는지, 어떤 전략이 선택되었는지 확인

## 🔧 API 엔드포인트

### 채팅
```http
POST /api/chat
Content-Type: application/json

{
  "userId": "user_id",
  "sessionId": "session_id",
  "message": "질문 내용"
}
```

### 세션 생성
```http
POST /api/session/new
Content-Type: application/json

{
  "userId": "user_id",
  "title": "세션 제목"
}
```

### 장기 기억 추가
```http
POST /api/memory/long-term
Content-Type: application/json

{
  "userId": "user_id",
  "category": "project",
  "title": "기억 제목",
  "content": "기억 내용",
  "tags": ["tag1", "tag2"],
  "importance": 8
}
```

### AI 상태 확인
```http
GET /api/health
```

## 🎯 로드맵

### v1.0 (현재)
- [x] 기본 멀티 AI 협업 시스템
- [x] 메모리 시스템 (정체성, 단기, 장기)
- [x] 웹 검색 통합
- [x] 채팅 UI
- [x] 의사결정 로그

### v1.1 (예정)
- [ ] Google 로그인 통합
- [ ] MCP (Model Context Protocol) 지원
- [ ] 스트리밍 응답
- [ ] 음성 입출력

### v2.0 (예정)
- [ ] Artifacts 기능 (코드 실행, 미리보기)
- [ ] 웹 브라우저 통합
- [ ] 로컬 AI 모델 지원 (자체 학습)
- [ ] 플러그인 시스템
- [ ] 다른 프로그램에 임베딩 가능한 모듈화

## 🤝 기여하기

이 프로젝트는 개인 프로젝트이지만 개선 제안이나 버그 리포트를 환영합니다!

## 📝 라이선스

MIT License

## 🙏 감사의 말

이 프로젝트는 다음 기술들을 사용합니다:
- Anthropic Claude API
- OpenAI GPT API
- Google Gemini API
- Together AI (Meta Llama)
- Express.js
- SQLite

---

Made with 💙 by creating an AI friend named Athena

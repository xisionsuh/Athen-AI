# 사용 가이드

## 빠른 시작

### 1. 설치 및 실행

```bash
# 의존성 설치
npm install

# 데이터베이스 초기화
npm run db:init

# 서버 시작
npm run dev
```

### 2. 브라우저에서 접속
http://localhost:3000

## 주요 사용 시나리오

### 시나리오 1: 간단한 질문
**입력:** "오늘 날씨 어때?"

**Athena의 동작:**
1. Meta AI가 질문을 분석
2. 최신 정보가 필요하므로 웹 검색 수행
3. 단일 AI로 충분하다고 판단
4. Gemini가 응답 생성 (검색 결과 기반)

### 시나리오 2: 복잡한 기술 질문
**입력:** "React에서 상태 관리를 위해 Redux와 MobX 중 어떤 걸 선택해야 할까? 프로젝트는 중규모 e-commerce 사이트야."

**Athena의 동작:**
1. Meta AI가 복잡한 결정 문제로 판단
2. 토론 모드 선택
3. ChatGPT, Gemini, Claude에게 각각 의견 요청
4. 2라운드 토론 진행
5. Meta AI가 의견을 종합하여 최종 답변

### 시나리오 3: 심층 리서치
**입력:** "2024년 AI 시장 트렌드에 대해 심층 조사해줘"

**Athena의 동작:**
1. Deep research로 판단
2. 병렬 모드 선택
3. 여러 AI가 동시에 다양한 각도에서 조사
4. 웹 검색으로 최신 정보 수집
5. Meta AI가 모든 정보를 종합하여 보고서 작성

### 시나리오 4: 맥락 기억
**사용자:** "파이썬으로 웹 스크래핑 하는 법 알려줘"
**Athena:** [BeautifulSoup 예제 제공]

**사용자:** "아까 말한 그 라이브러리 설치 명령어 뭐였지?"
**Athena:** "BeautifulSoup을 말씀하시는 거죠? `pip install beautifulsoup4` 명령어로 설치하실 수 있습니다."

→ Athena는 "아까 말한 그 라이브러리"가 BeautifulSoup임을 맥락에서 이해

### 시나리오 5: 장기 기억 활용
**입력:** "내가 작업중인 프로젝트에 대해 기억해줘. Next.js로 만드는 블로그 플랫폼이고, PostgreSQL 사용해. 배포는 Vercel로 할 예정이야."

**Athena:** [장기 기억에 저장]

**나중에...**
**입력:** "프로젝트에 댓글 기능 추가하려면 어떻게 해?"

**Athena:** "Next.js 블로그 프로젝트에 댓글 기능을 추가하시는거군요. PostgreSQL에 comments 테이블을 만들고..."
→ 프로젝트 정보를 장기 기억에서 불러와 맥락에 맞는 답변

## API 사용 예제

### cURL로 채팅

```bash
# 세션 생성
curl -X POST http://localhost:3000/api/session/new \
  -H "Content-Type: application/json" \
  -d '{"userId": "default_user"}'

# 응답: {"success": true, "sessionId": "session_xxx"}

# 메시지 전송
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "default_user",
    "sessionId": "session_xxx",
    "message": "안녕 아테나!"
  }'
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const userId = 'default_user';

async function chat() {
  // 세션 생성
  const sessionRes = await axios.post(`${API_BASE}/session/new`, {
    userId
  });

  const sessionId = sessionRes.data.sessionId;

  // 메시지 전송
  const chatRes = await axios.post(`${API_BASE}/chat`, {
    userId,
    sessionId,
    message: '안녕 아테나! TypeScript 공부하려는데 추천 자료 있어?'
  });

  console.log(chatRes.data.response);
  console.log('사용된 AI:', chatRes.data.metadata.agentsUsed);
  console.log('전략:', chatRes.data.metadata.strategy);
}

chat();
```

### Python

```python
import requests

API_BASE = 'http://localhost:3000/api'
user_id = 'default_user'

# 세션 생성
session_res = requests.post(f'{API_BASE}/session/new', json={
    'userId': user_id
})
session_id = session_res.json()['sessionId']

# 메시지 전송
chat_res = requests.post(f'{API_BASE}/chat', json={
    'userId': user_id,
    'sessionId': session_id,
    'message': '파이썬 FastAPI로 REST API 만드는 예제 보여줘'
})

data = chat_res.json()
print(data['response'])
print('사용된 AI:', data['metadata']['agentsUsed'])
```

## 고급 기능

### 장기 기억 수동 추가

```bash
curl -X POST http://localhost:3000/api/memory/long-term \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "default_user",
    "category": "project",
    "title": "블로그 프로젝트 기술 스택",
    "content": "Next.js 14, TypeScript, PostgreSQL, Prisma ORM, TailwindCSS",
    "tags": ["project", "blog", "nextjs"],
    "importance": 8
  }'
```

### 장기 기억 검색

```bash
curl "http://localhost:3000/api/memory/search/default_user?q=프로젝트"
```

### 의사결정 로그 조회

```bash
curl "http://localhost:3000/api/decision-log/session_xxx"
```

### AI 상태 확인

```bash
curl "http://localhost:3000/api/health"
```

## 협업 모드 이해하기

### Single (단일)
- 간단한 질문, 일반 대화
- 가장 적합한 AI 한 개만 사용
- 빠른 응답

### Parallel (병렬)
- 복잡한 주제, 여러 관점 필요
- 모든 AI가 동시에 응답
- Meta AI가 종합
- 균형잡힌 답변

### Sequential (순차)
- 단계적 처리 필요한 작업
- AI들이 순서대로 작업
- 각 단계의 결과가 다음 단계의 입력
- 체계적 처리

### Debate (토론)
- 논쟁적 주제, 다양한 의견 필요
- AI들이 2라운드 토론
- 서로의 의견을 고려하여 재정리
- 깊이 있는 분석

### Voting (투표)
- 명확한 선택이 필요한 경우
- 각 AI가 의견과 선택 제시
- 다수결로 결정
- 소수 의견도 언급

## 문제 해결

### AI가 응답하지 않음
1. `.env` 파일의 API 키 확인
2. AI 상태 확인 (화면 하단)
3. 콘솔 로그 확인

### 웹 검색이 작동하지 않음
- `SEARCH_API_KEY`가 없으면 DuckDuckGo 사용
- 일부 검색 실패는 정상 (캐시 활용)

### 데이터베이스 오류
```bash
# 데이터베이스 재초기화
rm -rf data/
npm run db:init
```

## 팁

1. **구체적으로 질문하기**: "코드 설명해줘" 보다 "이 React 컴포넌트에서 useState가 어떻게 작동하는지 설명해줘"

2. **맥락 활용하기**: 이전 대화를 기억하므로 "그거", "아까 말한 것" 등 자유롭게 사용

3. **장기 기억 활용**: 자주 사용하는 정보는 장기 기억에 저장

4. **사고 과정 확인**: 복잡한 답변의 경우 "사고 과정" 링크로 어떻게 판단했는지 확인

5. **전략 피드백**: 원하는 전략이 있으면 명시적으로 요청 (예: "여러 AI의 의견을 들어보고 싶어")

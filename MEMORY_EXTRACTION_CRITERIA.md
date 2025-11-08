# 장기 기억 추출 기준 가이드

## 현재 상태

### ✅ 구현된 기능
- **수동 저장**: 사용자가 장기 기억 모달에서 직접 저장
- **API 엔드포인트**: `POST /api/memory/long-term`

### ❌ 미구현 기능
- **자동 추출**: AI가 대화에서 중요한 정보를 자동으로 판단하여 장기 기억으로 저장
- **명시적 저장 요청**: 사용자가 대화 중 "이건 기억해줘"라고 말하면 저장

---

## 추천 기준: 하이브리드 방식

### 1. 사용자 명시적 요청 (최우선)

**패턴 감지:**
- "이건 기억해줘"
- "이 정보 저장해줘"
- "나중에 쓸 거니까 저장해"
- "장기 기억에 추가해줘"
- "기억해둬"

**동작:**
1. AI가 해당 메시지 감지
2. 사용자에게 확인: "다음 정보를 장기 기억에 저장할까요?"
   - 제목 자동 생성
   - 카테고리 자동 분류
3. 사용자 확인 시 저장

**예시:**
```
사용자: "나는 간결한 답변을 좋아해. 이건 기억해줘"
AI: "알겠습니다! '간결한 답변 선호'를 선호도(preference) 카테고리로 저장할까요?"
사용자: "네"
→ 장기 기억에 저장됨
```

---

### 2. AI 자동 판단 (선택적)

**판단 기준:**

#### A. 사용자 선호도 (Preference)
- **감지 패턴:**
  - "나는 ~를 좋아해"
  - "~를 선호해"
  - "~ 스타일로 해줘"
  - 반복적으로 언급되는 선호사항 (3회 이상)

- **예시:**
  ```
  사용자: "코드 예제는 항상 주석을 달아줘"
  → AI가 자동으로 preference 카테고리로 저장 제안
  ```

#### B. 프로젝트 정보 (Project)
- **감지 패턴:**
  - "현재 ~ 프로젝트 진행 중"
  - "~ 작업하고 있어"
  - 프로젝트명, 기술 스택, 목표 등

- **예시:**
  ```
  사용자: "React로 쇼핑몰 앱 만들고 있어"
  → AI가 자동으로 project 카테고리로 저장 제안
  ```

#### C. 사실 정보 (Fact)
- **감지 패턴:**
  - 개인 정보 (직업, 거주지, 취미 등)
  - 중요한 사실 (알레르기, 선호도 등)

- **예시:**
  ```
  사용자: "나는 서울에 살고 있어"
  → AI가 자동으로 fact 카테고리로 저장 제안
  ```

#### D. 중요도 점수 (Importance)
- **자동 계산 기준:**
  - 사용자가 명시적으로 언급: 9-10점
  - 반복적으로 언급 (3회 이상): 7-8점
  - 프로젝트 관련: 6-7점
  - 일반 선호도: 5-6점

---

## 구현 방안

### 옵션 1: 완전 자동 (권장하지 않음)
- AI가 자동으로 판단하여 저장
- **단점**: 사용자가 원하지 않는 정보도 저장될 수 있음

### 옵션 2: 제안 방식 (권장 ⭐)
- AI가 자동으로 판단하되, 저장 전 사용자에게 확인
- **장점**: 사용자 제어권 유지, 실수 방지

### 옵션 3: 하이브리드 (최적 ⭐⭐)
- **명시적 요청**: 즉시 저장 (확인 없이)
- **자동 감지**: 저장 제안 후 사용자 확인

---

## 구현 예시 코드

### 1. 메시지 처리 시 자동 감지

```javascript
// orchestrator.js의 process 메서드에서
async process(userId, sessionId, userMessage, searchResults = null) {
  // ... 기존 처리 ...
  
  // 장기 기억 추출 시도
  const extractedMemory = await this.extractLongTermMemory(userId, userMessage, result.content);
  
  if (extractedMemory) {
    // 사용자에게 저장 제안
    result.suggestedMemory = extractedMemory;
  }
  
  return result;
}

async extractLongTermMemory(userId, userMessage, aiResponse) {
  const brain = await this.selectBrain();
  
  const extractionPrompt = `다음 대화에서 장기 기억으로 저장할 만한 정보를 추출하세요.

사용자 메시지: ${userMessage}
AI 응답: ${aiResponse}

다음 기준으로 판단:
1. 사용자 선호도 (preference): "~를 좋아해", "~ 스타일로 해줘"
2. 프로젝트 정보 (project): "~ 프로젝트 진행 중", "~ 작업 중"
3. 사실 정보 (fact): 개인 정보, 중요한 사실
4. 사용자가 명시적으로 "기억해줘"라고 요청한 경우

JSON 형식으로 응답:
{
  "shouldExtract": true/false,
  "category": "preference|project|fact",
  "title": "제목",
  "content": "내용",
  "importance": 1-10,
  "reason": "추출 이유"
}`;

  const response = await brain.chat(extractionPrompt);
  const extracted = JSON.parse(response);
  
  if (extracted.shouldExtract) {
    return {
      category: extracted.category,
      title: extracted.title,
      content: extracted.content,
      importance: extracted.importance,
      reason: extracted.reason
    };
  }
  
  return null;
}
```

### 2. 명시적 요청 감지

```javascript
function detectExplicitMemoryRequest(message) {
  const patterns = [
    /이건?\s*기억해(줘|야|)/,
    /이\s*정보?\s*저장해(줘|야|)/,
    /나중에\s*쓸\s*거니까?\s*저장해/,
    /장기\s*기억에?\s*추가해(줘|야|)/,
    /기억해(둬|줘|야)/
  ];
  
  return patterns.some(pattern => pattern.test(message));
}
```

### 3. 프론트엔드 저장 제안 UI

```javascript
// app.js에서 응답 처리 시
if (result.suggestedMemory) {
  showMemorySuggestion(result.suggestedMemory);
}

function showMemorySuggestion(memory) {
  const suggestionHtml = `
    <div class="memory-suggestion">
      <div class="suggestion-header">
        <span>💾 장기 기억 저장 제안</span>
        <button onclick="this.closest('.memory-suggestion').remove()">×</button>
      </div>
      <div class="suggestion-content">
        <strong>${memory.title}</strong>
        <p>${memory.content}</p>
        <p class="suggestion-reason">${memory.reason}</p>
      </div>
      <div class="suggestion-actions">
        <button onclick="saveSuggestedMemory(${JSON.stringify(memory).replace(/"/g, '&quot;')})">저장</button>
        <button onclick="this.closest('.memory-suggestion').remove()">나중에</button>
      </div>
    </div>
  `;
  
  // 메시지 영역에 추가
  const lastMessage = document.querySelector('.message.assistant:last-child');
  if (lastMessage) {
    lastMessage.insertAdjacentHTML('beforeend', suggestionHtml);
  }
}
```

---

## 사용자 경험 시나리오

### 시나리오 1: 명시적 요청
```
사용자: "나는 간결한 답변을 좋아해. 이건 기억해줘"
AI: "알겠습니다! '간결한 답변 선호'를 선호도로 저장했습니다."
→ 즉시 저장 (확인 없이)
```

### 시나리오 2: 자동 감지
```
사용자: "코드 예제는 항상 주석을 달아줘"
AI: [응답 후]
    💾 장기 기억 저장 제안
    "코드 예제 주석 포함 선호"
    [저장] [나중에]
→ 사용자가 선택
```

### 시나리오 3: 프로젝트 정보
```
사용자: "React로 쇼핑몰 앱 만들고 있어"
AI: [응답 후]
    💾 장기 기억 저장 제안
    "React 쇼핑몰 앱 프로젝트"
    [저장] [나중에]
```

---

## 권장 구현 순서

1. **1단계**: 명시적 요청 감지 및 즉시 저장
2. **2단계**: 자동 감지 로직 구현 (AI 판단)
3. **3단계**: 저장 제안 UI 구현
4. **4단계**: 사용자 피드백 수집 및 개선

---

## 설정 옵션

사용자가 설정에서 선택할 수 있도록:

```javascript
const memorySettings = {
  autoExtract: true, // 자동 추출 활성화
  requireConfirmation: true, // 저장 전 확인 필요
  extractCategories: ['preference', 'project', 'fact'], // 추출할 카테고리
  minImportance: 5 // 최소 중요도 점수
};
```

---

## 주의사항

1. **프라이버시**: 개인 정보는 사용자 확인 필수
2. **중복 방지**: 이미 저장된 정보는 다시 저장하지 않음
3. **정확성**: AI 판단이 틀릴 수 있으므로 확인 단계 필수
4. **사용자 제어**: 언제든지 자동 추출 기능 끄기 가능


# MCP (Model Context Protocol) 통합 완료

## ✅ 구현 완료 사항

### 1. MCP 기본 구조
- **위치**: `src/mcp/base.js`
- MCP 기본 클래스 (`MCPBase`) 구현
- 도구(Tools) 및 리소스(Resources) 인터페이스 정의
- 도구 등록, 실행, 리소스 조회 기능

### 2. 파일 시스템 도구
- **위치**: `src/mcp/tools/fileSystem.js`
- `read_file`: 파일 읽기
- `write_file`: 파일 생성/수정
- `list_directory`: 디렉토리 목록 조회
- `delete_file`: 파일/디렉토리 삭제
- 보안: 작업 공간(`workspace`) 밖의 파일 접근 방지

### 3. 코드 실행 도구
- **위치**: `src/mcp/tools/codeExecutor.js`
- `execute_code`: Python, JavaScript, Shell 코드 실행
- Sandbox 환경에서 안전하게 실행
- 위험한 명령어 차단 (rm -rf, format 등)
- 타임아웃 설정 (기본 10초)

### 4. MCP Manager
- **위치**: `src/mcp/mcpManager.js`
- 도구 및 리소스 통합 관리
- AI 프롬프트에 도구 정보 자동 추가
- AI 응답에서 도구 호출 추출 및 실행
- 도구 실행 결과를 응답에 통합

### 5. Orchestrator 통합
- **위치**: `src/core/orchestrator.js`
- `buildAthenaSystemPrompt`에 MCP 도구 정보 추가
- `executeSingle`에서 도구 호출 처리
- `executeSingleStream`에서 스트리밍 모드 도구 호출 처리
- 도구 실행 결과를 응답에 자동 통합

### 6. 서버 설정
- **위치**: `src/index.js`
- MCP 활성화 옵션 추가 (`MCP_ENABLED`)
- 작업 공간 경로 설정 (`MCP_WORKSPACE_ROOT`)
- 기본값: 활성화, 작업 공간: `./workspace`

## 📋 사용 방법

### AI가 도구를 사용하는 방법

AI는 응답에서 다음 형식으로 도구를 호출할 수 있습니다:

```markdown
```mcp_tool
{
  "tool": "read_file",
  "arguments": {
    "file_path": "example.txt"
  }
}
```
```

### 지원되는 도구

1. **read_file**: 파일 읽기
2. **write_file**: 파일 쓰기
3. **list_directory**: 디렉토리 목록
4. **delete_file**: 파일 삭제
5. **execute_code**: 코드 실행 (Python, JavaScript, Shell)

## 🔒 보안 기능

1. **작업 공간 제한**: 모든 파일 작업은 `workspace` 디렉토리 내에서만 가능
2. **위험 명령어 차단**: `rm -rf`, `format`, `shutdown` 등 위험한 명령어 실행 방지
3. **타임아웃**: 코드 실행은 기본 10초 타임아웃
4. **입력 검증**: 모든 도구 입력은 스키마에 따라 검증

## 📝 환경 변수

`.env` 파일에 다음 변수를 추가할 수 있습니다:

```env
# MCP 설정
MCP_ENABLED=true                    # MCP 활성화 (기본값: true)
MCP_WORKSPACE_ROOT=./workspace      # 작업 공간 경로 (기본값: ./workspace)
```


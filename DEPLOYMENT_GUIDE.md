# Athena AI - 배포 및 설치 가이드

## 🚀 다른 PC에서 코드 받아서 사용하기

### 1. Git 저장소에서 클론하기

#### GitHub/GitLab/Bitbucket에 저장소가 있는 경우

```bash
# 저장소 클론
git clone https://github.com/your-username/Athena-AI.git
# 또는
git clone git@github.com:your-username/Athena-AI.git

# 프로젝트 디렉토리로 이동
cd Athena-AI
```

#### 로컬 Git 저장소만 있는 경우

다른 PC로 프로젝트를 옮기는 방법:

**방법 1: USB/네트워크로 복사**
```bash
# 원본 PC에서
cd /path/to/Athena-AI
tar -czf athena-ai-backup.tar.gz --exclude='node_modules' --exclude='data/*.db-shm' --exclude='data/*.db-wal' --exclude='.env' .

# 다른 PC에서
tar -xzf athena-ai-backup.tar.gz
cd Athena-AI
```

**방법 2: Git Bundle 사용**
```bash
# 원본 PC에서
cd /path/to/Athena-AI
git bundle create athena-ai.bundle --all

# 다른 PC에서
git clone athena-ai.bundle Athena-AI
cd Athena-AI
```

### 2. 의존성 설치

```bash
# npm 패키지 설치
npm install
```

**주의사항**: 
- `node_modules` 폴더는 Git에 포함되지 않으므로 각 PC에서 새로 설치해야 합니다.
- 네이티브 모듈(better-sqlite3, puppeteer 등)은 각 플랫폼에 맞게 자동으로 빌드됩니다.

### 3. 환경 변수 설정

`.env` 파일은 Git에 포함되지 않습니다 (보안상 이유). 각 PC에서 새로 만들어야 합니다:

```bash
# .env.example을 복사
cp .env.example .env

# .env 파일 편집 (텍스트 에디터로)
# 필요한 API 키들을 입력하세요
```

`.env` 파일 예시:
```env
# AI API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_claude_api_key_here
GOOGLE_AI_API_KEY=your_gemini_api_key_here
XAI_API_KEY=your_grok_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./data/athena.db

# Web Search (선택사항)
SEARCH_API_KEY=your_google_search_api_key
SEARCH_ENGINE_ID=your_search_engine_id

# Session Secret (보안을 위해 변경 권장)
SESSION_SECRET=your-random-secret-key-here

# Google OAuth (선택사항)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 4. 데이터베이스 초기화

```bash
# 데이터베이스 스키마 생성
npm run db:init
```

또는 수동으로:
```bash
node src/scripts/initDatabase.js
```

### 5. 서버 실행

```bash
# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 6. 브라우저에서 접속

```
http://localhost:3000
```

## 📋 체크리스트

다른 PC에서 설치할 때 확인할 사항:

- [ ] Node.js 18 이상 설치됨 (`node --version`)
- [ ] npm 설치됨 (`npm --version`)
- [ ] Git 저장소 클론 완료
- [ ] `npm install` 실행 완료
- [ ] `.env` 파일 생성 및 API 키 입력 완료
- [ ] 데이터베이스 초기화 완료 (`npm run db:init`)
- [ ] 서버 실행 성공 (`npm start`)
- [ ] 브라우저에서 접속 가능

## 🔄 업데이트 받기

다른 PC에서 최신 코드를 받으려면:

```bash
# 저장소로 이동
cd Athena-AI

# 최신 변경사항 가져오기
git pull origin main
# 또는
git pull origin master

# 의존성 업데이트 (필요시)
npm install

# 서버 재시작
npm start
```

## 🗂️ Git에 포함되지 않는 파일들

다음 파일들은 `.gitignore`에 의해 제외됩니다:

- `node_modules/` - npm으로 재설치
- `.env` - 각 PC에서 새로 생성 (보안)
- `data/*.db-shm`, `data/*.db-wal` - 데이터베이스 임시 파일
- `data/athena.db` - 데이터베이스 파일 (선택적, 백업용으로 포함 가능)
- `uploads/` - 업로드된 파일
- `projects/` - 프로젝트 파일
- `workspace/` - MCP 워크스페이스
- `*.log` - 로그 파일

## 💾 데이터베이스 백업 및 복원

### 백업
```bash
# 데이터베이스 파일 복사
cp data/athena.db data/athena.db.backup
```

### 복원
```bash
# 백업 파일로 복원
cp data/athena.db.backup data/athena.db
```

## 🌐 원격 저장소 설정 (처음 한 번만)

GitHub/GitLab 등에 저장소를 만들고 연결하려면:

```bash
# 원격 저장소 추가
git remote add origin https://github.com/your-username/Athena-AI.git

# 또는 SSH 사용
git remote add origin git@github.com:your-username/Athena-AI.git

# 첫 푸시
git push -u origin main
```

## 🔐 보안 주의사항

1. **절대 `.env` 파일을 Git에 커밋하지 마세요**
   - API 키가 노출될 수 있습니다
   - `.gitignore`에 이미 포함되어 있지만 확인하세요

2. **각 PC마다 다른 `.env` 파일 사용**
   - 개발/프로덕션 환경 분리
   - API 키는 각 환경에 맞게 설정

3. **데이터베이스 파일**
   - 민감한 사용자 데이터가 포함될 수 있습니다
   - 필요시 `.gitignore`에 `data/athena.db` 추가

## 🐛 문제 해결

### npm install 실패
```bash
# 캐시 정리 후 재시도
npm cache clean --force
npm install
```

### 네이티브 모듈 빌드 실패
- **Linux**: `build-essential`, `python3` 설치 확인
- **Windows**: Python 3.x 및 Visual Studio Build Tools 설치 확인
- **macOS**: Xcode Command Line Tools 설치 확인

자세한 내용은 `PLATFORM_SUPPORT.md` 참조

### 포트가 이미 사용 중
`.env` 파일에서 포트 변경:
```env
PORT=3001
```

## ✅ 결론

**네, 다른 PC에서 Git으로 코드를 받아서 바로 사용할 수 있습니다!**

필요한 단계:
1. Git 클론
2. `npm install`
3. `.env` 파일 생성 및 API 키 입력
4. `npm run db:init`
5. `npm start`

각 PC는 독립적으로 작동하며, 데이터베이스와 업로드 파일은 각 PC에 별도로 저장됩니다.


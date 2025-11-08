# Athena AI - 플랫폼 지원 가이드

## ✅ 지원 플랫폼

이 프로그램은 **크로스 플랫폼**으로 설계되어 다음 운영체제에서 실행 가능합니다:

- ✅ **Linux** (Ubuntu, Debian, CentOS, Fedora 등)
- ✅ **macOS** (Intel 및 Apple Silicon)
- ✅ **Windows** (Windows 10/11)
- ✅ **Unix 계열** (FreeBSD, OpenBSD 등)

## 📋 플랫폼별 요구사항

### 공통 요구사항
- **Node.js 18 이상** (권장: Node.js 20 LTS)
- **npm** 또는 **yarn** 패키지 매니저
- **인터넷 연결** (AI API 호출용)

### Linux / Unix / macOS

#### 필수 도구
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential python3

# CentOS/RHEL/Fedora
sudo yum groupinstall "Development Tools"
sudo yum install python3

# macOS (Homebrew)
brew install python3
```

#### 설치
```bash
cd Athen-AI
npm install
```

### Windows

#### 필수 도구
1. **Node.js** (공식 사이트에서 다운로드)
   - https://nodejs.org/
   - Windows Installer (.msi) 다운로드 및 설치

2. **Python 3.x** (네이티브 모듈 빌드용)
   - https://www.python.org/downloads/
   - 설치 시 "Add Python to PATH" 체크 필수!

3. **Visual Studio Build Tools** (선택사항, 권장)
   - https://visualstudio.microsoft.com/downloads/
   - "Build Tools for Visual Studio" 다운로드
   - C++ 빌드 도구 포함하여 설치

#### Windows에서 설치
```powershell
# PowerShell 또는 CMD에서 실행
cd Athen-AI
npm install
```

**주의사항**: 
- Windows에서 `better-sqlite3`, `puppeteer`, `sharp` 같은 네이티브 모듈 설치 시 시간이 걸릴 수 있습니다.
- 설치 중 오류가 발생하면 Visual Studio Build Tools를 설치하세요.

## 🔧 플랫폼별 특이사항

### Linux
- **Puppeteer**: Chromium이 자동으로 다운로드됩니다.
- **파일 권한**: `data/`, `uploads/`, `projects/` 디렉토리에 쓰기 권한이 필요합니다.
- **포트**: 기본 포트 3000이 사용 중이면 `.env`에서 변경 가능합니다.

### macOS
- **Apple Silicon (M1/M2/M3)**: 모든 패키지가 자동으로 ARM64 버전으로 설치됩니다.
- **Intel Mac**: x64 버전으로 설치됩니다.
- **보안**: 처음 실행 시 터미널 접근 권한을 요청할 수 있습니다.

### Windows
- **경로 구분자**: 내부적으로 Node.js가 자동 처리하므로 문제 없습니다.
- **긴 경로명**: Windows 10 이상에서는 긴 경로명 지원이 활성화되어 있어야 합니다.
- **방화벽**: 첫 실행 시 Windows 방화벽에서 Node.js 접근 허용을 요청할 수 있습니다.
- **Puppeteer**: Windows에서도 Chromium이 자동 다운로드됩니다.

## 🚀 실행 방법 (모든 플랫폼 동일)

### 1. 환경 변수 설정
```bash
# Linux/macOS
cp .env.example .env

# Windows (CMD)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

### 2. .env 파일 편집
모든 플랫폼에서 동일한 형식:
```env
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_AI_API_KEY=your_key_here
PORT=3000
DB_PATH=./data/athena.db
```

### 3. 데이터베이스 초기화
```bash
npm run db:init
```

### 4. 서버 실행
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 5. 브라우저에서 접속
```
http://localhost:3000
```

## 🐛 플랫폼별 문제 해결

### Linux - 네이티브 모듈 빌드 실패
```bash
# 빌드 도구 설치
sudo apt-get install -y build-essential python3

# 다시 설치
npm rebuild
npm install
```

### macOS - Python 경로 문제
```bash
# Python 경로 확인
which python3

# npm 설정
npm config set python python3
npm install
```

### Windows - 빌드 도구 오류
```powershell
# Visual Studio Build Tools 설치 후
npm config set msvs_version 2022
npm install --build-from-source
```

### Windows - Puppeteer 다운로드 실패
```powershell
# 수동으로 Chromium 다운로드
npx puppeteer browsers install chrome
```

## 📦 네이티브 모듈 정보

이 프로젝트에서 사용하는 네이티브 모듈들:

1. **better-sqlite3** (v11.7.0)
   - SQLite 데이터베이스 바인딩
   - 크로스 플랫폼 지원 (Windows, macOS, Linux)
   - 빌드 시 C++ 컴파일러 필요

2. **puppeteer** (v24.29.1)
   - Chrome/Chromium 자동화
   - 각 플랫폼에 맞는 Chromium 자동 다운로드
   - Windows, macOS, Linux 모두 지원

3. **sharp** (v0.34.5)
   - 이미지 처리 라이브러리
   - 크로스 플랫폼 지원
   - 네이티브 바이너리 포함

## ✅ 플랫폼 호환성 확인

프로그램은 플랫폼 특정 코드를 사용하지 않으며, Node.js의 표준 API만 사용합니다:

- ✅ `fs` 모듈: 크로스 플랫폼 파일 시스템
- ✅ `path` 모듈: 자동 경로 구분자 처리
- ✅ `process.cwd()`: 현재 작업 디렉토리 (모든 플랫폼 동일)
- ✅ Express: 순수 JavaScript, 플랫폼 독립적

## 🧪 테스트된 환경

- ✅ Ubuntu 22.04 LTS
- ✅ macOS 13+ (Intel 및 Apple Silicon)
- ✅ Windows 10/11
- ✅ Node.js 18.x, 20.x

## 💡 권장사항

### 프로덕션 환경
- **Linux 서버**: Ubuntu 22.04 LTS 권장
- **Node.js**: 20.x LTS 버전 사용
- **프로세스 관리**: PM2 사용 권장
  ```bash
  npm install -g pm2
  pm2 start src/index.js --name athena-ai
  ```

### 개발 환경
- 모든 플랫폼에서 동일하게 작동합니다.
- 개발 모드(`npm run dev`)는 nodemon을 사용하여 파일 변경 시 자동 재시작됩니다.

## 📞 문제 발생 시

플랫폼별 문제가 발생하면:

1. Node.js 버전 확인: `node --version` (18 이상 필요)
2. npm 버전 확인: `npm --version`
3. 빌드 도구 설치 확인 (위의 플랫폼별 요구사항 참조)
4. `npm install` 로그 확인
5. GitHub Issues에 문제 보고

## 🎯 결론

**이 프로그램은 모든 주요 운영체제에서 완전히 동일하게 작동합니다!**

플랫폼별 차이는 없으며, Node.js와 npm만 설치되어 있으면 어디서든 실행 가능합니다.


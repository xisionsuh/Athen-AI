# GitHub 원격 저장소 푸시 가이드

## 방법 1: GitHub CLI 사용 (권장)

### 1. GitHub CLI 로그인
```bash
gh auth login
```
브라우저에서 인증을 완료하세요.

### 2. 원격 저장소 생성 및 푸시
```bash
cd /Users/hee-seocksuh/Dev/Athena-AI
gh repo create Athena-AI --public --source=. --remote=origin --description "Athena AI - Multi-Agent AI System with Meta AI Orchestrator" --push
```

## 방법 2: 수동으로 GitHub에서 생성 후 푸시

### 1. GitHub에서 저장소 생성
1. https://github.com/new 접속
2. Repository name: `Athena-AI`
3. Description: `Athena AI - Multi-Agent AI System with Meta AI Orchestrator`
4. Public 또는 Private 선택
5. "Create repository" 클릭

### 2. 원격 저장소 추가 및 푸시
```bash
cd /Users/hee-seocksuh/Dev/Athena-AI

# 원격 저장소 추가 (YOUR_USERNAME을 실제 GitHub 사용자명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/Athena-AI.git

# 또는 SSH 사용 시
git remote add origin git@github.com:YOUR_USERNAME/Athena-AI.git

# 푸시
git push -u origin main
```

## 현재 Git 상태 확인
```bash
git status
git log --oneline -1
```


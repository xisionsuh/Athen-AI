// Athena AI Frontend Application

const API_BASE = '/api';
let userId = null;
let currentSessionId = null;

// DOM 요소
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const chatForm = document.getElementById('chatForm');
const sendBtn = document.getElementById('sendBtn');
const thinkingIndicator = document.getElementById('thinkingIndicator');
const newChatBtn = document.getElementById('newChatBtn');
const sessionsList = document.getElementById('sessionsList');
const memoryBtn = document.getElementById('memoryBtn');
const memoryModal = document.getElementById('memoryModal');
const decisionLogModal = document.getElementById('decisionLogModal');
const performanceBtn = document.getElementById('performanceBtn');
const performanceModal = document.getElementById('performanceModal');
const voiceInputBtn = document.getElementById('voiceInputBtn');
const voiceIcon = document.getElementById('voiceIcon');

// 음성 관련 변수
let recognition = null;
let isListening = false;
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let voiceSettings = {
  enabled: false,
  language: 'ko-KR',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0
};

// 로그인 체크
async function checkLogin() {
  // 먼저 서버 세션 확인
  try {
    const response = await fetch('/auth/status', {
      credentials: 'include'
    });
    const data = await response.json();

    if (data.authenticated && data.user) {
      // 서버 세션에 로그인 정보가 있음
      userId = data.user.id;
  const currentUserElement = document.getElementById('currentUser');
  if (currentUserElement) {
        currentUserElement.textContent = `👤 ${data.user.name}`;
  }
  return true;
    }
  } catch (error) {
    console.error('Auth status check failed:', error);
  }

  // 서버 세션이 없으면 로그인 페이지로 리다이렉트
  // localStorage에 남아있는 테스트 유저 정보는 무시
  window.location.href = '/login.html';
  return false;
}

// 로그아웃 함수
async function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    try {
      // 서버 세션 로그아웃
      await fetch('/auth/logout', {
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // localStorage도 정리
    localStorage.removeItem('athena_user');
    localStorage.removeItem('athena_user_id');
    window.location.href = '/login.html';
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  // 로그인 체크
  if (!(await checkLogin())) {
    return;
  }

  await checkAIStatus();
  await loadSessions();
  
  // 기존 세션이 있으면 가장 최근 세션을 로드, 없으면 새 세션 생성
  const sessionsResponse = await fetch(`${API_BASE}/sessions/${userId}`);
  const sessionsData = await sessionsResponse.json();
  
  if (sessionsData.success && sessionsData.sessions && sessionsData.sessions.length > 0) {
    // 가장 최근 세션 로드
    const latestSession = sessionsData.sessions[0]; // 이미 updated_at DESC로 정렬됨
    await window.loadSession(latestSession.id);
  } else {
    // 세션이 없으면 새로 생성
  await createNewSession();
  }

  // 이벤트 리스너
  chatForm.addEventListener('submit', handleSendMessage);
  newChatBtn.addEventListener('click', createNewSession);
  memoryBtn.addEventListener('click', () => openModal('memoryModal'));
  if (performanceBtn) {
    performanceBtn.addEventListener('click', () => showPerformanceDashboard());
  }
  
  // 음성 입력 초기화
  if (voiceInputBtn) {
    initVoiceInput();
    voiceInputBtn.addEventListener('click', toggleVoiceInput);
  }
  
  // 음성 설정 로드
  loadVoiceSettings();
  
  // TTS 토글 버튼
  const ttsToggle = document.getElementById('ttsToggle');
  if (ttsToggle) {
    updateTTSButton();
    ttsToggle.addEventListener('click', toggleTTS);
  }

  // 음성 설정 버튼
  const voiceSettingsBtn = document.getElementById('voiceSettingsBtn');
  if (voiceSettingsBtn) {
    voiceSettingsBtn.addEventListener('click', () => {
      openVoiceSettingsModal();
    });
  }

  // 음성 일시정지/재개 버튼
  const ttsPauseBtn = document.getElementById('ttsPauseBtn');
  if (ttsPauseBtn) {
    ttsPauseBtn.addEventListener('click', toggleTTSPause);
  }
  
  // 테마 토글 버튼
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    // 저장된 테마 불러오기
    const savedTheme = localStorage.getItem('athena-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  // 모달 닫기
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.target.dataset.modal;
      closeModal(modalId);
    });
  });

  // textarea 자동 높이 조절
  messageInput.addEventListener('input', autoResizeTextarea);

  // 한글 입력 조합 상태 추적
  let isComposing = false;
  
  messageInput.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  
  messageInput.addEventListener('compositionend', () => {
    isComposing = false;
  });

  // Shift+Enter로 줄바꿈, Enter로 전송 (한글 조합 중에는 무시)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // 한글 조합 중이면 무시
      if (isComposing) {
        return;
      }
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // 주기적으로 AI 상태 체크
  setInterval(checkAIStatus, 30000);

  // 키보드 단축키 설정
  setupKeyboardShortcuts();
});

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K 또는 Cmd+K: 새 대화
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      createNewSession();
      return;
    }

    // Ctrl+/ 또는 Cmd+/: 도움말 표시
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      showKeyboardShortcutsHelp();
      return;
    }

    // Ctrl+L 또는 Cmd+L: 입력창에 포커스 (입력창이 포커스되지 않은 경우)
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      if (document.activeElement !== messageInput) {
        e.preventDefault();
        messageInput.focus();
      }
      return;
    }

    // Ctrl+M 또는 Cmd+M: 장기 기억 모달 열기
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      openModal('memoryModal');
      return;
    }

    // Ctrl+Shift+K 또는 Cmd+Shift+K: 의사결정 로그 보기
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      showDecisionLog();
      return;
    }
  });
}

// 키보드 단축키 도움말 표시
function showKeyboardShortcutsHelp() {
  const helpContent = `
    <div class="shortcuts-help">
      <h3>⌨️ 키보드 단축키</h3>
      <div class="shortcuts-list">
        <div class="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd>
          <span>새 대화 시작</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>L</kbd>
          <span>입력창에 포커스</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>M</kbd>
          <span>장기 기억 관리</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>
          <span>의사결정 로그 보기</span>
        </div>
        <div class="shortcut-item">
          <kbd>Enter</kbd>
          <span>메시지 전송</span>
        </div>
        <div class="shortcut-item">
          <kbd>Shift</kbd> + <kbd>Enter</kbd>
          <span>줄바꿈</span>
        </div>
        <div class="shortcut-item">
          <kbd>Esc</kbd>
          <span>모달 닫기</span>
        </div>
      </div>
    </div>
  `;

  // 기존 도움말 모달이 있으면 제거
  const existingHelp = document.getElementById('shortcutsHelpModal');
  if (existingHelp) {
    existingHelp.remove();
  }

  // 도움말 모달 생성
  const helpModal = document.createElement('div');
  helpModal.id = 'shortcutsHelpModal';
  helpModal.className = 'modal';
  helpModal.style.display = 'flex';
  helpModal.innerHTML = `
    <div class="modal-content shortcuts-modal">
      <div class="modal-header">
        <h3>⌨️ 키보드 단축키</h3>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        ${helpContent}
      </div>
    </div>
  `;

  document.body.appendChild(helpModal);

  // 모달 외부 클릭시 닫기
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.remove();
    }
  });

  // ESC 키로 닫기
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      helpModal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 메시지 전송 (스트리밍 지원)
let isSubmitting = false; // 중복 제출 방지 플래그

async function handleSendMessage(e) {
  e.preventDefault();

  // 이미 제출 중이면 무시
  if (isSubmitting) {
    return;
  }

  const message = messageInput.value.trim();
  if (!message) return;

  // 제출 시작 플래그 설정
  isSubmitting = true;
  sendBtn.disabled = true;

  // UI 업데이트
  addMessage('user', message);
  window.lastUserMessage = message; // 마지막 사용자 메시지 저장
  messageInput.value = '';
  messageInput.style.height = 'auto';
  showThinking('생각하는 중...');

  // 스트리밍 모드 사용 여부 (기본값: true)
  const useStreaming = true;

  try {
    if (useStreaming) {
      await handleStreamingMessage(message);
    } else {
      await handleRegularMessage(message);
    }
  } finally {
    // 제출 완료 플래그 해제
    isSubmitting = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// 일반 메시지 처리
async function handleRegularMessage(message) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sessionId: currentSessionId,
        message
      })
    });

    const data = await response.json();

    if (data.success) {
      hideThinking();
      addMessageWithVoice('assistant', data.response, data.metadata);
      await loadSessions();
    } else {
      throw new Error(data.error || '응답 오류');
    }
  } catch (error) {
    console.error('Error:', error);
    hideThinking();
    addMessage('assistant', '죄송합니다. 오류가 발생했습니다: ' + error.message);
  }
}

// 스트리밍 메시지 처리
async function handleStreamingMessage(message) {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sessionId: currentSessionId,
        message
      })
    });

    if (!response.ok) {
      throw new Error('스트리밍 요청 실패');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8'); // UTF-8 명시적 지정
    let buffer = '';
    let assistantMessageDiv = null;
    let fullContent = '';
    let metadata = null;

    hideThinking();

    // 스트리밍 메시지 컨테이너 생성
    assistantMessageDiv = document.createElement('div');
    assistantMessageDiv.className = 'message assistant';
    assistantMessageDiv.innerHTML = `
      <div class="message-avatar">🧠</div>
      <div class="message-content">
        <div class="streaming-content"></div>
        <div class="message-metadata"></div>
      </div>
    `;
    chatMessages.appendChild(assistantMessageDiv);
    const contentDiv = assistantMessageDiv.querySelector('.streaming-content');
    const metadataDiv = assistantMessageDiv.querySelector('.message-metadata');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 마지막 불완전한 라인은 버퍼에 보관

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            // 스트리밍 완료
            if (metadata) {
              renderMetadata(metadataDiv, metadata);
            }
            await loadSessions();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'metadata') {
              metadata = parsed.data;
              // 협업 모드에 따른 UI 업데이트
              if (metadata.strategy === 'parallel' || metadata.strategy === 'debate' || metadata.strategy === 'voting') {
                console.log('🎬 협업 모드:', metadata.strategy, '사용된 AI:', metadata.agentsUsed);
                updateThinkingStatus(`협업 모드: ${translateStrategy(metadata.strategy)}`, `${metadata.agentsUsed?.length || 0}개 AI 사용 중`);
              } else {
                updateThinkingStatus('응답 생성 중...', '');
              }
            } else if (parsed.type === 'chunk') {
              // 한글 콘텐츠 안전하게 처리
              const chunkContent = parsed.content || '';
              fullContent += chunkContent;
              const streamingContentDiv = assistantMessageDiv.querySelector('.streaming-content');
              if (streamingContentDiv) {
                streamingContentDiv.innerHTML = formatMessage(fullContent, metadata?.searchResults || null);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } else if (parsed.type === 'tool_result') {
              // MCP 도구 실행 결과
              console.log('🔧 도구 실행 결과:', parsed.data);
              renderArtifacts(assistantMessageDiv, parsed.data);
            } else if (parsed.type === 'updated_response') {
              // 도구 실행 후 업데이트된 응답
              fullContent = parsed.content;
              const streamingContentDiv = assistantMessageDiv.querySelector('.streaming-content');
              if (streamingContentDiv) {
                streamingContentDiv.innerHTML = formatMessage(fullContent, metadata?.searchResults || null);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } else if (parsed.type === 'agent_response') {
              // Parallel 모드: 각 AI의 응답
              console.log(`📝 ${parsed.agent}의 응답 수신됨`);
              updateThinkingStatus(`${parsed.agent} 응답 수신`, '다른 AI들의 응답을 기다리는 중...');
            } else if (parsed.type === 'step_start') {
              // Sequential 모드: 단계 시작
              console.log(`📌 단계 ${parsed.step} 시작 (${parsed.agent})`);
              updateThinkingStatus(`단계 ${parsed.step} 진행 중`, `${parsed.agent} 처리 중...`);
            } else if (parsed.type === 'debate_round') {
              // Debate 모드: 라운드 시작
              console.log(`💬 토론 라운드 ${parsed.round} 시작`);
              updateThinkingStatus(`토론 라운드 ${parsed.round}`, 'AI들이 의견을 교환하는 중...');
            } else if (parsed.type === 'debate_opinion_start') {
              // Debate 모드: 의견 시작
              console.log(`💭 ${parsed.agent}의 의견 시작`);
              updateThinkingStatus(`${parsed.agent}의 의견 수집 중`, '');
            } else if (parsed.type === 'debate_conclusion_start') {
              // Debate 모드: 결론 시작
              console.log(`📊 결론 도출 시작`);
              updateThinkingStatus('결론 도출 중', '총괄 AI가 의견을 종합하는 중...');
            } else if (parsed.type === 'vote_start') {
              // Voting 모드: 투표 시작
              console.log(`🗳️ ${parsed.agent}의 투표 시작`);
              updateThinkingStatus(`${parsed.agent} 투표 수집 중`, '');
            } else if (parsed.type === 'voting_tally_start') {
              // Voting 모드: 집계 시작
              console.log(`📊 투표 집계 시작`);
              updateThinkingStatus('투표 집계 중', '총괄 AI가 투표를 집계하는 중...');
            } else if (parsed.type === 'synthesis_start') {
              // Parallel 모드: 종합 시작
              console.log(`🔄 응답 종합 시작`);
              updateThinkingStatus('응답 종합 중', '총괄 AI가 여러 AI의 답변을 종합하는 중...');
            } else if (parsed.type === 'done') {
              // 스트리밍 완료
              if (metadata) {
                renderMetadata(metadataDiv, metadata);
              }
              // 최종 메시지 저장
              if (fullContent) {
                const finalContentDiv = assistantMessageDiv.querySelector('.streaming-content');
                if (finalContentDiv) {
                  finalContentDiv.innerHTML = formatMessage(fullContent, metadata?.searchResults || null);
                }
              }
              // 음성 출력
              handleStreamingComplete(fullContent);
              await loadSessions();
              return;
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error || '알 수 없는 오류');
            }
          } catch (parseError) {
            console.error('Parse error:', parseError, 'Data:', data);
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    hideThinking();
    addMessage('assistant', '죄송합니다. 스트리밍 중 오류가 발생했습니다: ' + error.message);
  }
}

// Artifacts 렌더링 함수
function renderArtifacts(messageDiv, toolResults) {
  if (!toolResults || !Array.isArray(toolResults) || toolResults.length === 0) {
    return;
  }

  // Artifacts 컨테이너 찾기 또는 생성
  let artifactsContainer = messageDiv.querySelector('.artifacts-container');
  if (!artifactsContainer) {
    artifactsContainer = document.createElement('div');
    artifactsContainer.className = 'artifacts-container';
    const messageContent = messageDiv.querySelector('.message-content');
    if (messageContent) {
      messageContent.appendChild(artifactsContainer);
    } else {
      messageDiv.appendChild(artifactsContainer);
    }
  }

  toolResults.forEach((toolResult, index) => {
    const artifactDiv = document.createElement('div');
    artifactDiv.className = 'artifact';
    artifactDiv.setAttribute('data-tool', toolResult.tool);
    artifactDiv.setAttribute('data-index', index);

    const toolName = toolResult.tool;
    const result = toolResult.result || {};
    const success = result.success !== false;

    let artifactHTML = `
      <div class="artifact-header">
        <div class="artifact-title">
          <span class="artifact-icon">${getToolIcon(toolName)}</span>
          <span class="artifact-name">${getToolDisplayName(toolName)}</span>
          <span class="artifact-status ${success ? 'success' : 'error'}">
            ${success ? '✓' : '✗'}
          </span>
        </div>
      </div>
      <div class="artifact-content">
    `;

    if (success) {
      artifactHTML += renderToolResult(toolName, result);
    } else {
      artifactHTML += `
        <div class="artifact-error">
          <strong>오류:</strong> ${result.error || '알 수 없는 오류'}
        </div>
      `;
    }

    artifactHTML += `</div>`;
    artifactDiv.innerHTML = artifactHTML;
    artifactsContainer.appendChild(artifactDiv);
  });

  // 스크롤을 맨 아래로
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Prism.js 하이라이팅 적용
  if (window.Prism) {
    artifactsContainer.querySelectorAll('pre code').forEach((block) => {
      Prism.highlightElement(block);
    });
  }
}

// 도구별 결과 렌더링
function renderToolResult(toolName, result) {
  switch (toolName) {
    case 'read_file':
      const filePath = result.file_path || '파일';
      const fileContent = result.content || '';
      const language = detectLanguageFromPath(filePath);
      
      return `
        <div class="artifact-file-info">
          <div class="file-path">📄 ${filePath}</div>
          <div class="artifact-actions">
            <button class="artifact-btn edit-btn" onclick="editFile('${escapeHtml(filePath)}', ${JSON.stringify(fileContent).replace(/"/g, '&quot;')})" title="파일 편집">
              ✏️ 편집
            </button>
            <button class="artifact-btn download-btn" onclick="downloadFile('${escapeHtml(filePath)}', ${JSON.stringify(fileContent).replace(/"/g, '&quot;')})" title="파일 다운로드">
              💾 다운로드
            </button>
          </div>
        </div>
        <div class="artifact-code-block">
          <pre><code class="language-${language}">${escapeHtml(fileContent)}</code></pre>
        </div>
      `;

    case 'write_file':
      return `
        <div class="artifact-success-message">
          ✓ 파일이 성공적으로 작성되었습니다
        </div>
        <div class="artifact-file-info">
          <div class="file-path">📄 ${result.file_path || '파일'}</div>
        </div>
      `;

    case 'list_directory':
      const items = result.items || [];
      const itemsHTML = items.map(item => `
        <div class="directory-item">
          <span class="item-icon">${item.type === 'directory' ? '📁' : '📄'}</span>
          <span class="item-name">${item.name}</span>
          ${item.size ? `<span class="item-size">${formatFileSize(item.size)}</span>` : ''}
        </div>
      `).join('');
      return `
        <div class="artifact-file-info">
          <div class="file-path">📁 ${result.directory_path || '디렉토리'}</div>
        </div>
        <div class="artifact-directory-list">
          ${itemsHTML}
        </div>
      `;

    case 'delete_file':
      return `
        <div class="artifact-success-message">
          ✓ 파일이 성공적으로 삭제되었습니다
        </div>
        <div class="artifact-file-info">
          <div class="file-path">🗑️ ${result.file_path || '파일'}</div>
        </div>
      `;

    case 'execute_code':
      const stdout = result.stdout || '';
      const stderr = result.stderr || '';
      const codeLanguage = result.language || 'unknown';
      const codeContent = result.code || '';
      
      let codeResultHTML = `
        <div class="artifact-code-execution">
          <div class="code-language">${getLanguageDisplayName(codeLanguage)}</div>
      `;

      // 코드가 있으면 표시
      if (codeContent) {
        codeResultHTML += `
          <div class="code-input">
            <div class="code-label">코드:</div>
            <pre><code class="language-${codeLanguage}">${escapeHtml(codeContent)}</code></pre>
            <button class="artifact-btn" style="margin-top: 0.5rem;" onclick="executeCodeAgain('${codeLanguage}', ${JSON.stringify(codeContent).replace(/"/g, '&quot;')})" title="코드 다시 실행">
              ▶️ 다시 실행
            </button>
          </div>
        `;
      }

      if (stdout) {
        codeResultHTML += `
          <div class="code-output">
            <div class="output-label">출력:</div>
            <pre><code class="language-text">${escapeHtml(stdout)}</code></pre>
          </div>
        `;
      }

      if (stderr) {
        codeResultHTML += `
          <div class="code-error">
            <div class="error-label">오류:</div>
            <pre><code class="language-text">${escapeHtml(stderr)}</code></pre>
          </div>
        `;
      }

      codeResultHTML += `</div>`;
      return codeResultHTML;

    case 'call_api':
      const apiData = result.data || result.result?.data;
      const apiStatus = result.statusCode || result.result?.statusCode;
      const apiUrl = result.url || result.result?.url;
      
      let apiHTML = `
        <div class="artifact-api-result">
          <div class="api-header">
            <span class="api-method">${result.method || result.result?.method || 'GET'}</span>
            <span class="api-url">${escapeHtml(apiUrl || '')}</span>
            ${apiStatus ? `<span class="api-status status-${Math.floor(apiStatus / 100)}xx">${apiStatus}</span>` : ''}
          </div>
      `;

      if (apiData) {
        const dataStr = typeof apiData === 'string' ? apiData : JSON.stringify(apiData, null, 2);
        apiHTML += `
          <div class="api-response">
            <pre><code class="language-json">${escapeHtml(dataStr)}</code></pre>
          </div>
        `;
      }

      apiHTML += `</div>`;
      return apiHTML;

    case 'query_database':
      const dbRows = result.rows || result.result?.rows || [];
      const dbColumns = result.columns || result.result?.columns || [];
      
      if (dbRows.length === 0) {
        return '<div class="artifact-success-message">쿼리 결과가 없습니다.</div>';
      }

      let dbHTML = `
        <div class="artifact-database-result">
          <div class="db-header">
            <span class="db-row-count">${dbRows.length}개 행</span>
            <span class="db-column-count">${dbColumns.length}개 컬럼</span>
          </div>
          <div class="db-table-container">
            <table class="db-table">
              <thead>
                <tr>
                  ${dbColumns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
      `;

      dbRows.forEach(row => {
        dbHTML += '<tr>';
        dbColumns.forEach(col => {
          const value = row[col];
          const displayValue = value === null || value === undefined ? '<em>NULL</em>' : escapeHtml(String(value));
          dbHTML += `<td>${displayValue}</td>`;
        });
        dbHTML += '</tr>';
      });

      dbHTML += `
              </tbody>
            </table>
          </div>
        </div>
      `;
      return dbHTML;

    case 'process_image':
      const imageOutputPath = result.output_path || result.result?.output_path;
      const imageMetadata = result.metadata || result.result?.metadata;
      const imageOperation = result.operation || result.result?.operation;
      
      let imageHTML = `
        <div class="artifact-image-result">
          <div class="image-header">
            <span class="image-operation">${getImageOperationName(imageOperation)}</span>
            ${imageMetadata ? `<span class="image-size">${imageMetadata.width}×${imageMetadata.height}</span>` : ''}
          </div>
      `;

      if (imageOutputPath) {
        // 이미지 파일 경로를 상대 경로로 변환하여 표시
        const imageUrl = `/workspace/${imageOutputPath.replace(/^.*[\\\/]workspace[\\\/]/, '')}`;
        imageHTML += `
          <div class="image-preview">
            <img src="${escapeHtml(imageUrl)}" alt="처리된 이미지" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; padding: 1rem; background: var(--background-dark); border-radius: 8px; color: var(--text-secondary);">
              이미지를 불러올 수 없습니다: ${escapeHtml(imageOutputPath)}
            </div>
          </div>
          <div class="artifact-actions">
            <button class="artifact-btn download-btn" onclick="downloadImage('${escapeHtml(imageUrl)}', '${escapeHtml(imageOutputPath.split(/[\\\/]/).pop())}')" title="이미지 다운로드">
              💾 다운로드
            </button>
          </div>
        `;
      }

      if (imageMetadata) {
        imageHTML += `
          <div class="image-metadata">
            <div class="metadata-item"><strong>포맷:</strong> ${imageMetadata.format || 'N/A'}</div>
            <div class="metadata-item"><strong>크기:</strong> ${formatFileSize(imageMetadata.size || 0)}</div>
          </div>
        `;
      }

      imageHTML += `</div>`;
      return imageHTML;

    case 'send_email':
      const emailMessageId = result.messageId || result.result?.messageId;
      const emailAccepted = result.accepted || result.result?.accepted || [];
      const emailRejected = result.rejected || result.result?.rejected || [];
      
      return `
        <div class="artifact-email-result">
          <div class="email-success-message">
            ✓ 이메일이 성공적으로 전송되었습니다
          </div>
          <div class="email-details">
            ${emailMessageId ? `<div class="email-detail-item"><strong>메시지 ID:</strong> ${escapeHtml(emailMessageId)}</div>` : ''}
            ${emailAccepted.length > 0 ? `<div class="email-detail-item"><strong>수신자:</strong> ${emailAccepted.map(e => escapeHtml(e)).join(', ')}</div>` : ''}
            ${emailRejected.length > 0 ? `<div class="email-detail-item email-error"><strong>거부됨:</strong> ${emailRejected.map(e => escapeHtml(e)).join(', ')}</div>` : ''}
          </div>
        </div>
      `;

    default:
      return `
        <div class="artifact-raw-result">
          <pre><code class="language-json">${escapeHtml(JSON.stringify(result, null, 2))}</code></pre>
        </div>
      `;
  }
}

// 도구 아이콘 가져오기
function getToolIcon(toolName) {
  const icons = {
    'read_file': '📖',
    'write_file': '✍️',
    'list_directory': '📂',
    'delete_file': '🗑️',
    'execute_code': '⚡',
    'call_api': '🌐',
    'query_database': '🗄️',
    'process_image': '🖼️',
    'send_email': '📧'
  };
  return icons[toolName] || '🔧';
}

// 도구 표시 이름 가져오기
function getToolDisplayName(toolName) {
  const names = {
    'read_file': '파일 읽기',
    'write_file': '파일 쓰기',
    'list_directory': '디렉토리 목록',
    'delete_file': '파일 삭제',
    'execute_code': '코드 실행',
    'call_api': 'API 호출',
    'query_database': '데이터베이스 쿼리',
    'process_image': '이미지 처리',
    'send_email': '이메일 전송'
  };
  return names[toolName] || toolName;
}

// 이미지 작업 이름 가져오기
function getImageOperationName(operation) {
  const names = {
    'resize': '리사이즈',
    'convert': '포맷 변환',
    'metadata': '메타데이터',
    'crop': '크롭',
    'rotate': '회전',
    'grayscale': '그레이스케일',
    'blur': '블러'
  };
  return names[operation] || operation;
}

// 파일 크기 포맷팅
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 이미지 다운로드 함수
window.downloadImage = function(imageUrl, filename) {
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = filename || 'image.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// 언어 표시 이름 가져오기
function getLanguageDisplayName(language) {
  const names = {
    'python': 'Python',
    'javascript': 'JavaScript',
    'node': 'Node.js',
    'bash': 'Bash',
    'shell': 'Shell'
  };
  return names[language] || language;
}

// 파일 경로에서 언어 감지
function detectLanguageFromPath(filePath) {
  if (!filePath) return 'text';
  
  const ext = filePath.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'md': 'markdown',
    'markdown': 'markdown',
    'sql': 'sql',
    'r': 'r',
    'm': 'objectivec',
    'mm': 'objectivec',
    'vue': 'vue',
    'svelte': 'svelte',
    'dart': 'dart',
    'lua': 'lua',
    'perl': 'perl',
    'pl': 'perl',
    'dockerfile': 'docker',
    'docker': 'docker',
    'makefile': 'makefile',
    'mk': 'makefile',
    'cmake': 'cmake',
    'gradle': 'gradle',
    'maven': 'xml',
    'pom': 'xml',
    'txt': 'text',
    'log': 'text',
    'conf': 'text',
    'config': 'text',
    'env': 'text',
    'gitignore': 'text',
    'gitattributes': 'text',
    'editorconfig': 'text'
  };
  
  return languageMap[ext] || 'text';
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 파일 편집 함수
window.editFile = function(filePath, fileContent) {
  // 파일 편집 모달 생성
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  
  // 파일 경로와 내용을 안전하게 이스케이프
  const safeFilePath = escapeHtml(filePath);
  const safeFileContent = escapeHtml(fileContent);
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
      <div class="modal-header">
        <h3>파일 편집: ${safeFilePath}</h3>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 1rem;">
        <textarea id="fileEditContent" style="width: 100%; height: 400px; font-family: 'Courier New', monospace; padding: 1rem; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; resize: vertical;">${safeFileContent}</textarea>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="artifact-btn" onclick="this.closest('.modal').remove()">취소</button>
          <button class="artifact-btn" style="background: var(--primary-color);" onclick="saveFile('${safeFilePath.replace(/'/g, "\\'")}')">저장</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

// 파일 저장 함수
window.saveFile = async function(filePath) {
  const content = document.getElementById('fileEditContent').value;
  
  try {
    // MCP write_file 도구를 사용하여 파일 저장
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        userId: userId,
        sessionId: currentSessionId,
        message: `다음 파일을 저장해줘:\n\n파일 경로: ${filePath}\n\n내용:\n${content}`
      })
    });
    
    const data = await response.json();
    if (data.success) {
      alert('파일이 성공적으로 저장되었습니다.');
      // 모달 닫기
      document.querySelector('.modal').remove();
      // 페이지 새로고침 또는 메시지 다시 로드
      location.reload();
    } else {
      throw new Error(data.error || '파일 저장 실패');
    }
  } catch (error) {
    console.error('파일 저장 오류:', error);
    alert('파일 저장 중 오류가 발생했습니다: ' + error.message);
  }
};

// 파일 다운로드 함수
window.downloadFile = function(filePath, fileContent) {
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop() || 'file.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 코드 다시 실행 함수
window.executeCodeAgain = async function(language, code) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        userId: userId,
        sessionId: currentSessionId,
        message: `다음 ${language} 코드를 실행해줘:\n\n\`\`\`${language}\n${code}\n\`\`\``
      })
    });
    
    const data = await response.json();
    if (data.success) {
      // 메시지 추가
      addMessage('user', `다음 ${language} 코드를 실행해줘:\n\n\`\`\`${language}\n${code}\n\`\`\``);
      addMessage('assistant', data.response, data.metadata);
    } else {
      throw new Error(data.error || '코드 실행 실패');
    }
  } catch (error) {
    console.error('코드 실행 오류:', error);
    alert('코드 실행 중 오류가 발생했습니다: ' + error.message);
  }
};

// 메타데이터 렌더링 헬퍼 함수
function renderMetadata(metadataDiv, metadata) {
  if (metadata.strategy) {
    const badge = document.createElement('span');
    badge.className = 'metadata-badge';
    badge.textContent = `전략: ${translateStrategy(metadata.strategy)}`;
    metadataDiv.appendChild(badge);
  }

  if (metadata.agentsUsed && metadata.agentsUsed.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'metadata-badge';
    badge.textContent = `사용된 AI: ${metadata.agentsUsed.join(', ')}`;
    metadataDiv.appendChild(badge);
  }
}

// 메시지 추가
function addMessage(role, content, metadata = null) {
  // chatMessages 요소 확인
  if (!chatMessages) {
    console.error('chatMessages element not found!');
    return;
  }

  // content 검증 및 기본값 설정
  if (content === null || content === undefined) {
    console.warn('addMessage called with null/undefined content, using empty string');
    content = '';
  }
  content = String(content);

  // role 검증
  if (!role || (role !== 'user' && role !== 'assistant')) {
    console.warn('Invalid role:', role, 'defaulting to assistant');
    role = 'assistant';
  }

  console.log('addMessage called:', { 
    role, 
    contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''), 
    contentLength: content.length,
    hasMetadata: !!metadata 
  });

  const welcomeScreen = chatMessages.querySelector('.welcome-screen');
  if (welcomeScreen) {
    welcomeScreen.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🧠';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  const formattedContent = formatMessage(content, metadata?.searchResults || null);
  console.log('Formatted content:', formattedContent.substring(0, 100));
  contentDiv.innerHTML = formattedContent;

  // 메타데이터 표시
  if (metadata) {
    const metadataDiv = document.createElement('div');
    metadataDiv.className = 'message-metadata';

    if (metadata.strategy) {
      const badge = document.createElement('span');
      badge.className = 'metadata-badge';
      badge.textContent = `전략: ${translateStrategy(metadata.strategy)}`;
      metadataDiv.appendChild(badge);
    }

    if (metadata.agentsUsed && metadata.agentsUsed.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'metadata-badge';
      badge.textContent = `사용된 AI: ${metadata.agentsUsed.join(', ')}`;
      metadataDiv.appendChild(badge);
    }

    if (metadata.searchResults && metadata.searchResults.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'metadata-badge';
      badge.textContent = `🔍 웹 검색 활용됨`;
      metadataDiv.appendChild(badge);
      
      // 출처 섹션 추가
      const sourcesSection = document.createElement('div');
      sourcesSection.className = 'sources-section';
      
      // 출처 인용 통계 계산
      const citationStats = window.lastCitationStats || {};
      const totalCitations = Object.values(citationStats).reduce((sum, count) => sum + count, 0);
      
      const sourcesHeader = document.createElement('div');
      sourcesHeader.className = 'sources-header';
      sourcesHeader.innerHTML = `
        <span class="sources-toggle" onclick="toggleSources(this)">
          📚 출처 보기 (${metadata.searchResults.length}개${totalCitations > 0 ? `, 인용 ${totalCitations}회` : ''})
          <span class="toggle-icon">▼</span>
        </span>
      `;
      sourcesSection.appendChild(sourcesHeader);
      
      const sourcesList = document.createElement('div');
      sourcesList.className = 'sources-list';
      sourcesList.style.display = 'none';
      
      metadata.searchResults.forEach((result, index) => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.setAttribute('data-source-url', result.link);
        sourceItem.setAttribute('data-source-index', index);
        const reliability = getSourceReliability(result.link);
        const reliabilityClass = reliability.includes('높음') ? 'reliability-high' : 
                                 reliability.includes('낮음') ? 'reliability-low' : 'reliability-medium';
        const citationCount = citationStats[index] || 0;
        
        // 관련성 점수 표시 (있는 경우)
        const relevanceScore = result.relevanceScore !== undefined ? (result.relevanceScore * 100).toFixed(0) : null;
        const relevanceBadge = relevanceScore ? `<span class="relevance-score" title="관련성 점수">⭐ ${relevanceScore}%</span>` : '';
        
        // 출처 검증 상태 확인
        const isVerified = isSourceVerified(result.link);
        const verifiedBadge = isVerified 
          ? '<span class="verified-badge verified">✓ 확인됨</span>' 
          : '<span class="verified-badge unverified" onclick="toggleSourceVerification(this)" title="클릭하여 확인 상태 변경">○ 미확인</span>';
        
        sourceItem.innerHTML = `
          <div class="source-number">${index + 1}</div>
          <div class="source-content">
            <div class="source-header">
              <a href="${result.link}" target="_blank" rel="noopener noreferrer" class="source-title" onclick="markSourceAsVerified('${result.link.replace(/'/g, "\\'")}')">
                ${result.title || '제목 없음'}
              </a>
              <div class="source-badges">
                ${verifiedBadge}
                ${relevanceBadge}
                <span class="source-reliability ${reliabilityClass}">${reliability}</span>
                ${citationCount > 0 ? `<span class="citation-badge">인용 ${citationCount}회</span>` : ''}
              </div>
            </div>
            <div class="source-link">${result.link}</div>
            ${result.snippet ? `<div class="source-snippet">${result.snippet}</div>` : ''}
            <div class="source-feedback">
              <button class="feedback-btn useful-btn" onclick="submitSearchFeedback('${result.link.replace(/'/g, "\\'")}', 'useful', ${index})" title="유용함">
                👍 유용함
              </button>
              <button class="feedback-btn not-useful-btn" onclick="submitSearchFeedback('${result.link.replace(/'/g, "\\'")}', 'not_useful', ${index})" title="유용하지 않음">
                👎 유용하지 않음
              </button>
              <button class="feedback-btn refresh-btn" onclick="refreshSearchResult(${index})" title="검색 결과 새로고침">
                🔄 새로고침
              </button>
            </div>
          </div>
        `;
        sourcesList.appendChild(sourceItem);
      });
      
      // 검색 결과 요약 버튼 추가
      const summaryBtn = document.createElement('button');
      summaryBtn.className = 'summary-btn';
      summaryBtn.textContent = '📝 검색 결과 요약 보기';
      summaryBtn.onclick = () => showSearchSummary(metadata.searchResults, window.lastUserMessage || '');
      sourcesHeader.appendChild(summaryBtn);
      
      sourcesSection.appendChild(sourcesList);
      metadataDiv.appendChild(sourcesSection);
    }

    // Debate 모드일 때 세부 의견 링크 추가
    if (metadata.strategy === 'debate' && metadata.debates) {
      const debateLink = document.createElement('a');
      debateLink.className = 'decision-log-link';
      debateLink.textContent = '💬 각 AI의 의견 보기';
      debateLink.onclick = () => showDebateDetails(metadata);
      metadataDiv.appendChild(debateLink);
    }
    
    // Voting 모드일 때 투표 결과 링크 추가
    if (metadata.strategy === 'voting' && metadata.votes) {
      const votingLink = document.createElement('a');
      votingLink.className = 'decision-log-link';
      votingLink.textContent = '🗳️ 투표 결과 보기';
      votingLink.onclick = () => showVotingDetails(metadata);
      metadataDiv.appendChild(votingLink);
    }
    
    // 사고 과정 링크는 assistant 메시지에만 표시
    if (role === 'assistant') {
    const logLink = document.createElement('a');
    logLink.className = 'decision-log-link';
    logLink.textContent = '🧠 사고 과정 보기';
    logLink.onclick = () => showDecisionLog();
    metadataDiv.appendChild(logLink);
    }

    contentDiv.appendChild(metadataDiv);
  }

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  
  // DOM에 추가 (안전하게)
  try {
    if (!chatMessages) {
      console.error('chatMessages is null when trying to append!');
      return;
    }
    
    // 메시지가 제대로 생성되었는지 확인
    if (!messageDiv || !messageDiv.querySelector('.message-content')) {
      console.error('Message div structure is invalid!', messageDiv);
      return;
    }
    
  chatMessages.appendChild(messageDiv);

  // 스크롤 하단으로
    setTimeout(() => {
  chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 0);
    
    console.log('Message appended successfully:', {
      role,
      contentLength: content.length,
      hasMetadata: !!metadata
    });
  } catch (error) {
    console.error('Failed to append message to DOM:', error);
    console.error('chatMessages:', chatMessages);
    console.error('messageDiv:', messageDiv);
    console.error('messageDiv HTML:', messageDiv.outerHTML);
  }
}

// 메시지 포맷팅 (마크다운 간단 지원 + 출처 인라인 링크)
function formatMessage(text, searchResults = null) {
  if (!text && text !== 0) return '';
  
  // 문자열로 변환
  let formatted = String(text);
  
  // HTML 특수문자 이스케이프 (한글은 그대로 유지)
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // 출처 인라인 링크 처리 ([출처 N] 또는 [출처 N, 출처 M] 형식)
  if (searchResults && searchResults.length > 0) {
    // 출처 인용 통계 추적
    const citationStats = {};
    
    // [출처 1, 출처 2] 형식 처리
    formatted = formatted.replace(/\[출처\s+(\d+(?:\s*,\s*\d+)*)\]/g, (match, numbers) => {
      const indices = numbers.split(',').map(n => parseInt(n.trim()) - 1);
      const links = indices.map(idx => {
        if (idx >= 0 && idx < searchResults.length) {
          const result = searchResults[idx];
          const reliability = getSourceReliability(result.link);
          const reliabilityClass = getReliabilityClass(reliability);
          citationStats[idx] = (citationStats[idx] || 0) + 1;
          return `<a href="${result.link}" target="_blank" rel="noopener noreferrer" class="inline-citation ${reliabilityClass}" data-source-index="${idx}" onclick="if(event.ctrlKey || event.metaKey) return true; event.preventDefault(); showSourceModal(${idx}); return false;" title="${result.title || ''} (${reliability}) - 클릭: 상세 정보, Ctrl+클릭: 원문 열기">[출처 ${idx + 1}]</a>`;
        }
        return `[출처 ${idx + 1}]`;
      });
      return links.join(' ');
    });
    
    // [출처 N] 형식 처리 (위에서 처리되지 않은 경우)
    formatted = formatted.replace(/\[출처\s+(\d+)\]/g, (match, num) => {
      const idx = parseInt(num) - 1;
      if (idx >= 0 && idx < searchResults.length) {
        const result = searchResults[idx];
        const reliability = getSourceReliability(result.link);
        const reliabilityClass = getReliabilityClass(reliability);
        citationStats[idx] = (citationStats[idx] || 0) + 1;
        return `<a href="${result.link}" target="_blank" rel="noopener noreferrer" class="inline-citation ${reliabilityClass}" data-source-index="${idx}" onclick="if(event.ctrlKey || event.metaKey) return true; event.preventDefault(); showSourceModal(${idx}); return false;" title="${result.title || ''} (${reliability}) - 클릭: 상세 정보, Ctrl+클릭: 원문 열기">[출처 ${num}]</a>`;
      }
      return match;
    });
    
    // 출처 인용 통계를 전역 변수에 저장 (나중에 사용)
    window.lastCitationStats = citationStats;
  }
  
  // 마크다운 처리
  formatted = formatted
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  
  return formatted;
}

// 출처 신뢰도 판단 함수 (프론트엔드용)
function getSourceReliability(url) {
  if (!url) return '보통';
  
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('.gov') || urlLower.includes('.go.kr')) {
    return '높음 (공식)';
  }
  if (urlLower.includes('news.') || urlLower.includes('.news') || 
      urlLower.includes('bbc') || urlLower.includes('cnn') || 
      urlLower.includes('reuters') || urlLower.includes('ap.org') ||
      urlLower.includes('ytn') || urlLower.includes('sbs') || 
      urlLower.includes('kbs') || urlLower.includes('mbc')) {
    return '높음 (뉴스)';
  }
  if (urlLower.includes('.edu') || urlLower.includes('.ac.kr') ||
      urlLower.includes('scholar') || urlLower.includes('research') ||
      urlLower.includes('pubmed') || urlLower.includes('arxiv')) {
    return '높음 (학술)';
  }
  if (urlLower.includes('wikipedia')) {
    return '보통 (위키)';
  }
  if (urlLower.includes('youtube') || urlLower.includes('youtu.be')) {
    return '보통 (YouTube)';
  }
  if (urlLower.includes('blog') || urlLower.includes('tistory') ||
      urlLower.includes('naver.com/blog') || urlLower.includes('medium') ||
      urlLower.includes('reddit') || urlLower.includes('stackoverflow')) {
    return '낮음 (블로그/포럼)';
  }
  return '보통';
}

// 신뢰도별 CSS 클래스 반환
function getReliabilityClass(reliability) {
  if (reliability.includes('높음')) {
    return 'citation-high';
  } else if (reliability.includes('낮음')) {
    return 'citation-low';
  } else {
    return 'citation-medium';
  }
}

// 출처 검증 상태 확인
function isSourceVerified(url) {
  const verifiedSources = JSON.parse(localStorage.getItem('athena-verified-sources') || '[]');
  return verifiedSources.includes(url);
}

// 출처 검증 상태 토글
window.toggleSourceVerification = function(badgeElement) {
  const sourceItem = badgeElement.closest('.source-item');
  const sourceUrl = sourceItem.getAttribute('data-source-url');
  
  let verifiedSources = JSON.parse(localStorage.getItem('athena-verified-sources') || '[]');
  const isVerified = verifiedSources.includes(sourceUrl);
  
  if (isVerified) {
    verifiedSources = verifiedSources.filter(url => url !== sourceUrl);
    badgeElement.className = 'verified-badge unverified';
    badgeElement.textContent = '○ 미확인';
    badgeElement.title = '클릭하여 확인 상태 변경';
    badgeElement.onclick = () => toggleSourceVerification(badgeElement);
  } else {
    verifiedSources.push(sourceUrl);
    badgeElement.className = 'verified-badge verified';
    badgeElement.textContent = '✓ 확인됨';
    badgeElement.title = '';
    badgeElement.onclick = null;
  }
  
  localStorage.setItem('athena-verified-sources', JSON.stringify(verifiedSources));
  
  // 모든 출처 항목 업데이트
  updateAllSourceVerificationBadges();
};

// 출처를 확인된 것으로 표시 (링크 클릭 시)
window.markSourceAsVerified = function(url) {
  let verifiedSources = JSON.parse(localStorage.getItem('athena-verified-sources') || '[]');
  if (!verifiedSources.includes(url)) {
    verifiedSources.push(url);
    localStorage.setItem('athena-verified-sources', JSON.stringify(verifiedSources));
    updateAllSourceVerificationBadges();
  }
};

// 모든 출처 검증 배지 업데이트
function updateAllSourceVerificationBadges() {
  document.querySelectorAll('.source-item').forEach(sourceItem => {
    const sourceUrl = sourceItem.getAttribute('data-source-url');
    if (sourceUrl) {
      const isVerified = isSourceVerified(sourceUrl);
      const badge = sourceItem.querySelector('.verified-badge');
      if (badge) {
        if (isVerified) {
          badge.className = 'verified-badge verified';
          badge.textContent = '✓ 확인됨';
          badge.title = '';
          badge.onclick = null;
        } else {
          badge.className = 'verified-badge unverified';
          badge.textContent = '○ 미확인';
          badge.title = '클릭하여 확인 상태 변경';
          badge.onclick = () => toggleSourceVerification(badge);
        }
      }
    }
  });
}

// 출처 상세 정보 모달 표시
window.showSourceModal = function(sourceIndex) {
  // 현재 메시지의 searchResults 가져오기
  const currentMessage = document.querySelector('.message.assistant:last-child');
  if (!currentMessage) {
    console.error('메시지를 찾을 수 없습니다.');
    return;
  }
  
  const metadataDiv = currentMessage.querySelector('.message-metadata');
  if (!metadataDiv) {
    console.error('메타데이터를 찾을 수 없습니다.');
    return;
  }
  
  const sourcesSection = metadataDiv.querySelector('.sources-section');
  if (!sourcesSection) {
    console.error('출처 섹션을 찾을 수 없습니다.');
    return;
  }
  
  // 출처 데이터 재구성
  const sourceItems = sourcesSection.querySelectorAll('.source-item');
  if (sourceIndex < 0 || sourceIndex >= sourceItems.length) {
    return;
  }
  
  const sourceItem = sourceItems[sourceIndex];
  const sourceTitle = sourceItem.querySelector('.source-title').textContent;
  const sourceLink = sourceItem.querySelector('.source-title').href;
  const sourceSnippet = sourceItem.querySelector('.source-snippet')?.textContent || '';
  const reliability = sourceItem.querySelector('.source-reliability').textContent;
  const reliabilityClass = reliability.includes('높음') ? 'reliability-high' : 
                          reliability.includes('낮음') ? 'reliability-low' : 'reliability-medium';
  
  // 인용 횟수 가져오기
  const citationBadge = sourceItem.querySelector('.citation-badge');
  const citationCount = citationBadge ? parseInt(citationBadge.textContent.match(/\d+/)?.[0] || '0') : 0;
  
  // 검증 상태 가져오기
  const isVerified = isSourceVerified(sourceLink);
  const verifiedStatus = isVerified ? '✓ 확인됨' : '○ 미확인';
  const verifiedClass = isVerified ? 'verified' : 'unverified';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>📚 출처 상세 정보</h3>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="source-modal-content">
          <div class="source-modal-header">
            <h4>${escapeHtml(sourceTitle)}</h4>
            <div class="source-modal-badges">
              <span class="verified-badge ${verifiedClass}" onclick="toggleSourceVerificationInModal('${escapeHtml(sourceLink)}', this)">
                ${verifiedStatus}
              </span>
              <span class="source-reliability ${reliabilityClass}">${reliability}</span>
            </div>
          </div>
          <div class="source-modal-info">
            <div class="source-info-item">
              <strong>URL:</strong>
              <a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener noreferrer" class="source-link" onclick="markSourceAsVerified('${escapeHtml(sourceLink)}')">
                ${escapeHtml(sourceLink)}
              </a>
            </div>
            ${sourceSnippet ? `
              <div class="source-info-item">
                <strong>요약:</strong>
                <p>${escapeHtml(sourceSnippet)}</p>
              </div>
            ` : ''}
            ${citationCount > 0 ? `
              <div class="source-info-item">
                <strong>인용 횟수:</strong>
                <span class="citation-count">${citationCount}회</span>
              </div>
            ` : ''}
          </div>
          <div class="source-modal-actions">
            <button class="artifact-btn" onclick="window.open('${escapeHtml(sourceLink)}', '_blank'); markSourceAsVerified('${escapeHtml(sourceLink)}');">
              🔗 원문 보기
            </button>
            <button class="artifact-btn" onclick="this.closest('.modal').remove()">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

// 모달 내에서 출처 검증 상태 토글
window.toggleSourceVerificationInModal = function(url, badgeElement) {
  let verifiedSources = JSON.parse(localStorage.getItem('athena-verified-sources') || '[]');
  const isVerified = verifiedSources.includes(url);
  
  if (isVerified) {
    verifiedSources = verifiedSources.filter(u => u !== url);
    badgeElement.className = 'verified-badge unverified';
    badgeElement.textContent = '○ 미확인';
  } else {
    verifiedSources.push(url);
    badgeElement.className = 'verified-badge verified';
    badgeElement.textContent = '✓ 확인됨';
  }
  
  localStorage.setItem('athena-verified-sources', JSON.stringify(verifiedSources));
  updateAllSourceVerificationBadges();
};

// 전략 이름 번역
function translateStrategy(strategy) {
  const translations = {
    'single': '단일 AI',
    'parallel': '병렬 협업',
    'sequential': '순차 실행',
    'debate': '토론',
    'voting': '투표'
  };
  return translations[strategy] || strategy;
}

// 생각하는 중 표시
function showThinking(text = '생각하는 중...', subtext = '') {
  thinkingIndicator.style.display = 'flex';
  updateThinkingStatus(text, subtext);
  hideProgress();
}

function hideThinking() {
  thinkingIndicator.style.display = 'none';
  hideProgress();
}

function updateThinkingStatus(text, subtext = '') {
  const thinkingText = document.getElementById('thinkingText');
  if (thinkingText) {
    thinkingText.textContent = text;
  }
  
  const thinkingSubtext = document.getElementById('thinkingSubtext');
  if (subtext && thinkingSubtext) {
    thinkingSubtext.textContent = subtext;
    thinkingSubtext.style.display = 'block';
  } else if (thinkingSubtext) {
    thinkingSubtext.style.display = 'none';
  }
}

function showProgress(percentage) {
  const progressContainer = document.getElementById('thinkingProgress');
  const progressFill = document.getElementById('progressFill');
  if (progressContainer && progressFill) {
    progressContainer.style.display = 'block';
    progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }
}

function hideProgress() {
  const progressContainer = document.getElementById('thinkingProgress');
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
}

// 새 세션 생성
async function createNewSession() {
  try {
    const response = await fetch(`${API_BASE}/session/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    const data = await response.json();
    if (data.success) {
      currentSessionId = data.sessionId;
      chatMessages.innerHTML = `
        <div class="welcome-screen">
          <div class="welcome-icon">🧠</div>
          <h2>새로운 대화를 시작합니다</h2>
          <p>무엇을 도와드릴까요?</p>
        </div>
      `;
      document.getElementById('chatTitle').textContent = '새 대화';
      
      // 세션 목록 새로고침하여 새 대화가 바로 나타나도록
      await loadSessions();
    }
  } catch (error) {
    console.error('Failed to create session:', error);
  }
}

// 세션 목록 로드
async function loadSessions() {
  try {
    const response = await fetch(`${API_BASE}/sessions/${userId}`);
    const data = await response.json();

    if (data.success && data.sessions.length > 0) {
      sessionsList.innerHTML = data.sessions.map(session => {
        // 세션 ID를 안전하게 이스케이프
        const sessionId = session.id.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
        <div class="session-item ${session.id === currentSessionId ? 'active' : ''}" data-session-id="${session.id}">
          <div class="session-content">
          <h4>${session.title || '제목 없음'}</h4>
          <p>${new Date(session.updated_at).toLocaleDateString('ko-KR')}</p>
        </div>
          <button class="session-delete-btn" data-session-id="${session.id}" title="삭제">
            🗑️
          </button>
        </div>
      `;
      }).join('');
      
      // 이벤트 리스너 추가 (더 안전한 방식)
      sessionsList.querySelectorAll('.session-content').forEach(content => {
        content.addEventListener('click', (e) => {
          const sessionItem = e.target.closest('.session-item');
          const sessionId = sessionItem?.dataset.sessionId;
          if (sessionId) {
            window.loadSession(sessionId);
          }
        });
      });
      
      // 삭제 버튼 이벤트 리스너 추가
      sessionsList.querySelectorAll('.session-delete-btn').forEach((btn, index) => {
        // 기존 리스너 제거 (중복 방지)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          
          const sessionItem = newBtn.closest('.session-item');
          const sessionId = newBtn.dataset.sessionId || sessionItem?.dataset.sessionId;
          
          console.log('Delete button clicked:', {
            index,
            sessionId,
            hasDataset: !!newBtn.dataset.sessionId,
            sessionItem: !!sessionItem,
            sessionItemDataset: sessionItem?.dataset.sessionId
          });
          
          if (sessionId) {
            await window.deleteSession(sessionId, e);
          } else {
            console.error('Session ID not found', {
              btn: newBtn,
              dataset: newBtn.dataset,
              sessionItem: sessionItem,
              sessionItemDataset: sessionItem?.dataset
            });
            alert('세션 ID를 찾을 수 없습니다. 콘솔을 확인해주세요.');
          }
        }, { capture: true }); // capture phase에서 실행
      });
    } else {
      sessionsList.innerHTML = '<div class="no-sessions">세션이 없습니다</div>';
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}

// 세션 로드 (전역 함수로 등록)
window.loadSession = async function(sessionId) {
  try {
    console.log('Loading session:', sessionId);
    const response = await fetch(`${API_BASE}/session/${sessionId}`);
    const data = await response.json();
    console.log('Session data:', data);

    if (data.success) {
      currentSessionId = sessionId;
      
      // chatMessages 요소 확인
      if (!chatMessages) {
        console.error('chatMessages element not found!');
        return;
      }
      
      chatMessages.innerHTML = '';

      if (data.messages && data.messages.length > 0) {
        console.log('Loading messages:', data.messages.length);
        data.messages.forEach((msg, index) => {
          console.log(`Message ${index}:`, msg);
          // metadata가 이미 객체로 파싱되어 있거나 문자열일 수 있음
          let metadata = null;
          if (msg.metadata) {
            if (typeof msg.metadata === 'string') {
              try {
                metadata = JSON.parse(msg.metadata);
              } catch (e) {
                console.warn('Failed to parse metadata:', e);
                metadata = null;
              }
            } else {
              metadata = msg.metadata; // 이미 객체인 경우
            }
          }
          addMessage(msg.message_type, msg.content || '', metadata);
        });
      } else {
        chatMessages.innerHTML = `
          <div class="welcome-screen">
            <div class="welcome-icon">🧠</div>
            <h2>${data.session.title || '대화'}</h2>
            <p>이 세션에는 아직 메시지가 없습니다.</p>
          </div>
        `;
      }

      document.getElementById('chatTitle').textContent = data.session.title || '대화';

      // 세션 목록 업데이트
      await loadSessions();
    } else {
      alert('세션을 불러올 수 없습니다: ' + (data.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('Failed to load session:', error);
    alert('세션을 불러오는 중 오류가 발생했습니다: ' + error.message);
  }
};

// 세션 삭제 (전역 함수로 등록)
window.deleteSession = async function(sessionId, event) {
  // event가 있으면 전파 방지
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  if (!sessionId) {
    console.error('Session ID is required');
    alert('세션 ID가 필요합니다.');
    return;
  }
  
  console.log('Deleting session:', sessionId);
  
  if (!confirm('이 대화를 삭제하시겠습니까?')) {
    return;
  }

  try {
    console.log('Sending DELETE request to:', `${API_BASE}/session/${sessionId}`);
    const response = await fetch(`${API_BASE}/session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    if (data.success) {
      // 삭제된 세션이 현재 세션이면 새 세션 생성
      if (sessionId === currentSessionId) {
        await createNewSession();
      } else {
        // 세션 목록만 새로고침
        await loadSessions();
      }
    } else {
      alert('세션 삭제 실패: ' + (data.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('Failed to delete session:', error);
    alert('세션 삭제 중 오류가 발생했습니다: ' + error.message);
  }
};

// AI 상태 체크
async function checkAIStatus() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    if (data.success) {
      updateStatusIndicator('gptStatus', data.providers['ChatGPT']?.isAvailable);
      updateStatusIndicator('geminiStatus', data.providers['Gemini']?.isAvailable);
      updateStatusIndicator('claudeStatus', data.providers['Claude']?.isAvailable);
      updateStatusIndicator('grokStatus', data.providers['Grok']?.isAvailable);
    }
  } catch (error) {
    console.error('Failed to check AI status:', error);
  }
}

function updateStatusIndicator(elementId, isOnline) {
  const element = document.getElementById(elementId);
  if (element) {
    element.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
  }
}

// 의사결정 로그 표시
async function showDecisionLog() {
  if (!currentSessionId) return;

  try {
    const response = await fetch(`${API_BASE}/decision-log/${currentSessionId}`);
    const data = await response.json();

    if (data.success && data.log.length > 0) {
      const content = document.getElementById('decisionLogContent');
      content.innerHTML = data.log.map(entry => `
        <div class="memory-item">
          <h4>${entry.decision_type}</h4>
          <p><strong>입력:</strong> ${entry.input.substring(0, 100)}...</p>
          <p><strong>사용된 AI:</strong> ${JSON.parse(entry.ai_used).join(', ')}</p>
          <p><strong>시간:</strong> ${new Date(entry.created_at).toLocaleString('ko-KR')}</p>
        </div>
      `).join('');

      openModal('decisionLogModal');
    }
  } catch (error) {
    console.error('Failed to load decision log:', error);
  }
}

// 모달 관리
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    // 모달 열릴 때 body 스크롤 방지
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    // 모달 닫힐 때 body 스크롤 복원
    document.body.style.overflow = '';
  }
}

// 모달 닫기 버튼 이벤트 리스너 (DOMContentLoaded 시 실행)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModalHandlers);
} else {
  initModalHandlers();
}

function initModalHandlers() {
  // 닫기 버튼 이벤트
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.target.getAttribute('data-modal');
      if (modalId) {
        closeModal(modalId);
      }
    });
  });
  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        if (modal.style.display === 'flex') {
          closeModal(modal.id);
        }
      });
    }
  });
  
  // 모달 외부 클릭시 닫기
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// 검색 결과 피드백 제출
window.submitSearchFeedback = async function(resultUrl, feedbackType, sourceIndex) {
  try {
    const currentMessage = document.querySelector('.message.assistant:last-child');
    if (!currentMessage) return;
    
    const metadataDiv = currentMessage.querySelector('.message-metadata');
    if (!metadataDiv) return;
    
    const sourcesSection = metadataDiv.querySelector('.sources-section');
    if (!sourcesSection) return;
    
    const sourceItem = sourcesSection.querySelectorAll('.source-item')[sourceIndex];
    if (!sourceItem) return;
    
    const query = window.lastUserMessage || '';
    
    const response = await fetch(`${API_BASE}/search/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        resultUrl: resultUrl,
        feedbackType: feedbackType,
        userId: currentUserId
      })
    });
    
    if (response.ok) {
      // 피드백 버튼 업데이트
      const feedbackBtns = sourceItem.querySelectorAll('.feedback-btn');
      feedbackBtns.forEach(btn => {
        btn.classList.remove('active');
        if ((feedbackType === 'useful' && btn.classList.contains('useful-btn')) ||
            (feedbackType === 'not_useful' && btn.classList.contains('not-useful-btn'))) {
          btn.classList.add('active');
        }
      });
      
      // 피드백 통계 업데이트
      updateSearchFeedbackStats(resultUrl, sourceIndex);
    }
  } catch (error) {
    console.error('Failed to submit search feedback:', error);
  }
};

// 검색 결과 피드백 통계 업데이트
async function updateSearchFeedbackStats(resultUrl, sourceIndex) {
  try {
    const encodedUrl = encodeURIComponent(resultUrl);
    const response = await fetch(`${API_BASE}/search/feedback/${encodedUrl}`);
    const data = await response.json();
    
    if (data.success && data.stats) {
      const currentMessage = document.querySelector('.message.assistant:last-child');
      if (!currentMessage) return;
      
      const metadataDiv = currentMessage.querySelector('.message-metadata');
      if (!metadataDiv) return;
      
      const sourcesSection = metadataDiv.querySelector('.sources-section');
      if (!sourcesSection) return;
      
      const sourceItem = sourcesSection.querySelectorAll('.source-item')[sourceIndex];
      if (!sourceItem) return;
      
      const feedbackDiv = sourceItem.querySelector('.source-feedback');
      if (feedbackDiv && (data.stats.useful > 0 || data.stats.notUseful > 0)) {
        const statsText = `(${data.stats.useful}👍 ${data.stats.notUseful}👎)`;
        if (!feedbackDiv.querySelector('.feedback-stats')) {
          const statsSpan = document.createElement('span');
          statsSpan.className = 'feedback-stats';
          statsSpan.textContent = statsText;
          feedbackDiv.appendChild(statsSpan);
        } else {
          feedbackDiv.querySelector('.feedback-stats').textContent = statsText;
        }
      }
    }
  } catch (error) {
    console.error('Failed to update feedback stats:', error);
  }
}

// 검색 결과 새로고침 (단일)
window.refreshSearchResult = async function(sourceIndex) {
  try {
    const currentMessage = document.querySelector('.message.assistant:last-child');
    if (!currentMessage) return;
    
    const metadataDiv = currentMessage.querySelector('.message-metadata');
    if (!metadataDiv) return;
    
    const sourcesSection = metadataDiv.querySelector('.sources-section');
    if (!sourcesSection) return;
    
    const sourceItem = sourcesSection.querySelectorAll('.source-item')[sourceIndex];
    if (!sourceItem) return;
    
    const query = sourceItem.getAttribute('data-query') || window.lastUserMessage || '';
    const resultUrl = sourceItem.getAttribute('data-source-url');
    
    if (!query) {
      alert('검색어를 찾을 수 없습니다.');
      return;
    }
    
    // 검색 재실행
    const response = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults: 5 })
    });
    
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      // 해당 인덱스의 결과 업데이트
      const newResult = data.results[sourceIndex] || data.results[0];
      
      // UI 업데이트
      const titleLink = sourceItem.querySelector('.source-title');
      const snippetDiv = sourceItem.querySelector('.source-snippet');
      
      if (titleLink) {
        titleLink.textContent = newResult.title || '제목 없음';
        titleLink.href = newResult.link;
      }
      
      if (snippetDiv && newResult.snippet) {
        snippetDiv.textContent = newResult.snippet;
      }
      
      // 관련성 점수 업데이트
      if (newResult.relevanceScore !== undefined) {
        const relevanceScore = (newResult.relevanceScore * 100).toFixed(0);
        const badgesDiv = sourceItem.querySelector('.source-badges');
        const existingRelevance = badgesDiv.querySelector('.relevance-score');
        
        if (existingRelevance) {
          existingRelevance.textContent = `⭐ ${relevanceScore}%`;
        } else {
          const relevanceBadge = document.createElement('span');
          relevanceBadge.className = 'relevance-score';
          relevanceBadge.title = '관련성 점수';
          relevanceBadge.textContent = `⭐ ${relevanceScore}%`;
          badgesDiv.insertBefore(relevanceBadge, badgesDiv.firstChild.nextSibling);
        }
      }
      
      alert('검색 결과가 업데이트되었습니다.');
    } else {
      alert('검색 결과를 가져올 수 없습니다.');
    }
  } catch (error) {
    console.error('Failed to refresh search result:', error);
    alert('검색 결과를 새로고침하는 중 오류가 발생했습니다.');
  }
};

// 모든 검색 결과 새로고침
async function refreshAllSearchResults(results, query) {
  if (!query) {
    alert('검색어를 찾을 수 없습니다.');
    return;
  }
  
  if (!confirm('모든 검색 결과를 새로고침하시겠습니까?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults: results.length || 5 })
    });
    
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      // 현재 메시지의 검색 결과 업데이트
      const currentMessage = document.querySelector('.message.assistant:last-child');
      if (!currentMessage) return;
      
      const metadataDiv = currentMessage.querySelector('.message-metadata');
      if (!metadataDiv) return;
      
      const sourcesSection = metadataDiv.querySelector('.sources-section');
      if (!sourcesSection) return;
      
      const sourceItems = sourcesSection.querySelectorAll('.source-item');
      
      data.results.forEach((newResult, index) => {
        if (index < sourceItems.length) {
          const sourceItem = sourceItems[index];
          const titleLink = sourceItem.querySelector('.source-title');
          const snippetDiv = sourceItem.querySelector('.source-snippet');
          
          if (titleLink) {
            titleLink.textContent = newResult.title || '제목 없음';
            titleLink.href = newResult.link;
          }
          
          if (snippetDiv) {
            snippetDiv.textContent = newResult.snippet || '';
          }
          
          // 관련성 점수 업데이트
          if (newResult.relevanceScore !== undefined) {
            const relevanceScore = (newResult.relevanceScore * 100).toFixed(0);
            const badgesDiv = sourceItem.querySelector('.source-badges');
            const existingRelevance = badgesDiv.querySelector('.relevance-score');
            
            if (existingRelevance) {
              existingRelevance.textContent = `⭐ ${relevanceScore}%`;
            } else {
              const relevanceBadge = document.createElement('span');
              relevanceBadge.className = 'relevance-score';
              relevanceBadge.title = '관련성 점수';
              relevanceBadge.textContent = `⭐ ${relevanceScore}%`;
              badgesDiv.insertBefore(relevanceBadge, badgesDiv.firstChild.nextSibling);
            }
          }
        }
      });
      
      alert('모든 검색 결과가 업데이트되었습니다.');
    } else {
      alert('검색 결과를 가져올 수 없습니다.');
    }
  } catch (error) {
    console.error('Failed to refresh search results:', error);
    alert('검색 결과를 새로고침하는 중 오류가 발생했습니다.');
  }
}

// 검색 결과 요약 표시
async function showSearchSummary(results, query) {
  try {
    const response = await fetch(`${API_BASE}/search/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, results })
    });
    
    const data = await response.json();
    
    if (data.success && data.summary) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3>📝 검색 결과 요약</h3>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="search-summary-content">
              <div class="summary-query">
                <strong>검색어:</strong> ${escapeHtml(query)}
              </div>
              <div class="summary-text">
                ${formatMessage(data.summary, null)}
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // 모달 외부 클릭시 닫기
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } else {
      alert('검색 결과 요약을 생성할 수 없습니다.');
    }
  } catch (error) {
    console.error('Failed to get search summary:', error);
    alert('검색 결과 요약을 불러오는 중 오류가 발생했습니다.');
  }
}

// 출처 토글 함수
function toggleSources(element) {
  const sourcesSection = element.closest('.sources-section');
  const sourcesList = sourcesSection.querySelector('.sources-list');
  const toggleIcon = element.querySelector('.toggle-icon');
  
  if (sourcesList.style.display === 'none') {
    sourcesList.style.display = 'block';
    toggleIcon.textContent = '▲';
  } else {
    sourcesList.style.display = 'none';
    toggleIcon.textContent = '▼';
  }
}

// Debate 모드 세부 의견 표시
function showDebateDetails(metadata) {
  if (!metadata.debates) {
    console.warn('Debate metadata not found');
    return;
  }
  
  const content = document.getElementById('debateContent');
  let html = '<div class="debate-container">';
  
  // 의견 비교 뷰 추가
  html += `
    <div class="debate-controls">
      <button class="debate-view-btn active" onclick="switchDebateView('round')" data-view="round">
        📋 라운드별 보기
      </button>
      <button class="debate-view-btn" onclick="switchDebateView('compare')" data-view="compare">
        🔄 의견 비교
      </button>
      <button class="debate-view-btn" onclick="switchDebateView('timeline')" data-view="timeline">
        📈 변화 추적
      </button>
    </div>
  `;
  
  // 라운드별 뷰
  html += '<div id="debate-round-view" class="debate-view">';
  metadata.debates.forEach((round, roundIndex) => {
    const roundId = `round-${roundIndex + 1}`;
    html += `
      <div class="debate-round-wrapper">
        <div class="debate-round-header" onclick="toggleDebateRound('${roundId}')">
          <h4>Round ${roundIndex + 1}</h4>
          <span class="round-toggle-icon" id="icon-${roundId}">▼</span>
        </div>
        <div class="debate-round-content" id="${roundId}" style="display: ${roundIndex === 0 ? 'block' : 'none'};">
          <div class="debate-opinions">`;
    
    round.forEach((debate, opinionIndex) => {
      const agentIcon = getAgentIcon(debate.agent);
      const opinionId = `opinion-${roundIndex}-${opinionIndex}`;
      html += `
        <div class="debate-opinion" data-agent="${debate.agent}" data-round="${roundIndex + 1}">
          <div class="opinion-header">
            <span class="opinion-agent">
              ${agentIcon} ${debate.agent}
            </span>
            <div class="opinion-actions">
              <button class="opinion-feedback-btn" onclick="toggleOpinionFeedback('${opinionId}', 'like')" title="좋아요">
                👍 <span class="feedback-count" id="like-${opinionId}">0</span>
              </button>
              <button class="opinion-feedback-btn" onclick="toggleOpinionFeedback('${opinionId}', 'dislike')" title="싫어요">
                👎 <span class="feedback-count" id="dislike-${opinionId}">0</span>
              </button>
            </div>
          </div>
          <div class="opinion-content" id="${opinionId}">${formatMessage(debate.opinion, metadata.searchResults || null)}</div>
        </div>
      `;
    });
    
    html += `</div></div></div>`;
  });
  html += '</div>';
  
  // 의견 비교 뷰 - 개선된 병렬 비교
  html += '<div id="debate-compare-view" class="debate-view" style="display: none;">';
  const agents = new Set();
  metadata.debates.forEach(round => {
    round.forEach(debate => agents.add(debate.agent));
  });
  
  // 병렬 비교 테이블 형식으로 개선
  html += '<div class="compare-table-container">';
  html += '<table class="compare-table">';
  html += '<thead><tr><th>AI</th>';
  metadata.debates.forEach((round, idx) => {
    html += `<th>Round ${idx + 1}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  Array.from(agents).forEach(agent => {
    const agentIcon = getAgentIcon(agent);
    html += `<tr><td class="compare-agent-cell">${agentIcon} ${agent}</td>`;
    
    metadata.debates.forEach((round, roundIndex) => {
      const opinion = round.find(d => d.agent === agent);
      const prevOpinion = roundIndex > 0 ? metadata.debates[roundIndex - 1].find(d => d.agent === agent) : null;
      const hasChanged = prevOpinion && prevOpinion.opinion !== opinion?.opinion;
      
      if (opinion) {
        html += `<td class="compare-opinion-cell ${hasChanged ? 'opinion-changed' : ''}">`;
        if (hasChanged) {
          html += '<span class="change-indicator">🔄</span>';
        }
        html += `<div class="compare-opinion-text">${formatMessage(opinion.opinion.substring(0, 200) + (opinion.opinion.length > 200 ? '...' : ''), metadata.searchResults || null)}</div>`;
        html += '</td>';
      } else {
        html += '<td class="compare-opinion-cell no-opinion">-</td>';
      }
    });
    
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  html += '</div>';
  
  // 변화 추적 뷰 - 개선된 변경 내용 표시
  html += '<div id="debate-timeline-view" class="debate-view" style="display: none;">';
  html += '<div class="timeline-container">';
  
  metadata.debates.forEach((round, roundIndex) => {
    html += `
      <div class="timeline-item">
        <div class="timeline-marker">Round ${roundIndex + 1}</div>
        <div class="timeline-content">
          <div class="timeline-opinions">`;
    
    round.forEach(debate => {
      const agentIcon = getAgentIcon(debate.agent);
      const prevRound = roundIndex > 0 ? metadata.debates[roundIndex - 1].find(d => d.agent === debate.agent) : null;
      const hasChanged = prevRound && prevRound.opinion !== debate.opinion;
      
      // 변경 내용 추출 (간단한 diff)
      let changeSummary = '';
      if (hasChanged && prevRound) {
        const prevWords = prevRound.opinion.split(/\s+/).slice(0, 10).join(' ');
        const currWords = debate.opinion.split(/\s+/).slice(0, 10).join(' ');
        if (prevWords !== currWords) {
          changeSummary = `<div class="change-summary">
            <strong>변경 전:</strong> ${prevWords}...
            <br><strong>변경 후:</strong> ${currWords}...
          </div>`;
        }
      }
      
      html += `
        <div class="timeline-opinion ${hasChanged ? 'opinion-changed' : ''}">
          <div class="timeline-opinion-header">
            <span class="opinion-agent">${agentIcon} ${debate.agent}</span>
            ${hasChanged ? '<span class="change-badge">🔄 변화 있음</span>' : '<span class="change-badge no-change">✓ 변화 없음</span>'}
          </div>
          ${changeSummary}
          <div class="timeline-opinion-content">${formatMessage(debate.opinion, metadata.searchResults || null)}</div>
        </div>
      `;
    });
    
    html += `</div></div></div>`;
  });
  
  html += '</div></div>';
  
  if (metadata.moderator) {
    html += `<div class="debate-moderator">
      <div class="moderator-header">
        <span class="moderator-icon">⚖️</span>
        <strong>총괄 AI (${metadata.moderator})</strong>가 위 의견들을 종합하여 최종 결론을 도출했습니다.
      </div>
    </div>`;
  }
  
  html += '</div>';
  content.innerHTML = html;
  openModal('debateModal');
  
  // 피드백 데이터 로드
  loadOpinionFeedback();
}

// Debate 뷰 전환 함수
window.switchDebateView = function(view) {
  document.querySelectorAll('.debate-view').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.debate-view-btn').forEach(btn => btn.classList.remove('active'));
  
  document.getElementById(`debate-${view}-view`).style.display = 'block';
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
};

// 의견 피드백 토글 함수 (서버 연동)
window.toggleOpinionFeedback = async function(opinionId, type) {
  try {
    const currentMessage = document.querySelector('.message.assistant:last-child');
    if (!currentMessage) return;
    
    const metadataDiv = currentMessage.querySelector('.message-metadata');
    if (!metadataDiv) return;
    
    // debateId 생성 (round + agent 조합)
    const opinionElement = document.getElementById(opinionId);
    if (!opinionElement) return;
    
    const debateOpinion = opinionElement.closest('.debate-opinion');
    if (!debateOpinion) return;
    
    const round = debateOpinion.getAttribute('data-round');
    const agent = debateOpinion.getAttribute('data-agent');
    const debateId = `${round}-${agent}`;
    
    const response = await fetch(`${API_BASE}/debate/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        debateId: debateId,
        feedbackType: type,
        userId: currentUserId
      })
    });
    
    if (response.ok) {
      // 피드백 통계 업데이트
      await updateOpinionFeedback(opinionId, debateId, type);
    }
  } catch (error) {
    console.error('Failed to submit opinion feedback:', error);
  }
};

// 의견 피드백 통계 업데이트
async function updateOpinionFeedback(opinionId, debateId, type) {
  try {
    const response = await fetch(`${API_BASE}/debate/feedback/${currentSessionId}/${debateId}`);
    const data = await response.json();
    
    if (data.success && data.stats) {
      const likeCount = document.getElementById(`like-${opinionId}`);
      const dislikeCount = document.getElementById(`dislike-${opinionId}`);
      
      if (likeCount) {
        likeCount.textContent = data.stats.like || 0;
      }
      if (dislikeCount) {
        dislikeCount.textContent = data.stats.dislike || 0;
      }
      
      // 버튼 활성화 상태 업데이트
      const button = event.target.closest('.opinion-feedback-btn');
      if (button) {
        const allButtons = button.parentElement.querySelectorAll('.opinion-feedback-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        if (type === 'like' && data.stats.like > 0) {
          button.classList.add('active');
        } else if (type === 'dislike' && data.stats.dislike > 0) {
          button.classList.add('active');
        }
      }
    }
  } catch (error) {
    console.error('Failed to update opinion feedback:', error);
  }
}

// 피드백 데이터 로드 (서버에서)
async function loadOpinionFeedback() {
  try {
    const debateOpinions = document.querySelectorAll('.debate-opinion');
    
    for (const opinion of debateOpinions) {
      const round = opinion.getAttribute('data-round');
      const agent = opinion.getAttribute('data-agent');
      const debateId = `${round}-${agent}`;
      const opinionId = opinion.querySelector('.opinion-content')?.id;
      
      if (!opinionId) continue;
      
      const response = await fetch(`${API_BASE}/debate/feedback/${currentSessionId}/${debateId}`);
      const data = await response.json();
      
      if (data.success && data.stats) {
        const likeCount = document.getElementById(`like-${opinionId}`);
        const dislikeCount = document.getElementById(`dislike-${opinionId}`);
        
        if (likeCount) {
          likeCount.textContent = data.stats.like || 0;
        }
        if (dislikeCount) {
          dislikeCount.textContent = data.stats.dislike || 0;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load opinion feedback:', error);
  }
}

// Debate 라운드 토글 함수
function toggleDebateRound(roundId) {
  const content = document.getElementById(roundId);
  const icon = document.getElementById(`icon-${roundId}`);
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.textContent = '▲';
  } else {
    content.style.display = 'none';
    icon.textContent = '▼';
  }
}

// AI 아이콘 반환 함수
function getAgentIcon(agentName) {
  const icons = {
    'ChatGPT': '🧠',
    'Gemini': '💎',
    'Claude': '🤖',
    'Grok': '🚀'
  };
  return icons[agentName] || '🤖';
}

// Voting 모드 투표 결과 표시
function showVotingDetails(metadata) {
  if (!metadata.votes) {
    console.warn('Voting metadata not found');
    return;
  }
  
  const content = document.getElementById('votingContent');
  let html = '<div class="voting-container">';
  
  // 투표 결과 파싱 및 집계
  const voteCounts = {};
  const voteDetails = [];
  
  metadata.votes.forEach(vote => {
    const response = vote.response || '';
    // 더 정확한 선택 파싱
    const choiceMatch = response.match(/(?:선택|결정|추천|권장)[:\s]*([A-Z]|[\d]+|[\w가-힣]+|Python|JavaScript|Go|Java|C\+\+)/i) ||
                       response.match(/^([A-Z]|[\d]+|[\w가-힣]+)/);
    const choice = choiceMatch ? choiceMatch[1].trim() : null;
    
    if (choice) {
      voteCounts[choice] = (voteCounts[choice] || 0) + 1;
    }
    
    voteDetails.push({
      agent: vote.agent,
      response: response,
      choice: choice,
      agentIcon: getAgentIcon(vote.agent)
    });
  });
  
  // 투표 통계 표시 (개선된 시각화 및 통계)
  if (Object.keys(voteCounts).length > 0) {
    html += '<div class="voting-stats">';
    html += '<h4>📊 투표 집계</h4>';
    
    // 통계 요약 추가
    const sortedVotes = Object.entries(voteCounts)
      .sort((a, b) => b[1] - a[1]);
    const maxVotes = Math.max(...Object.values(voteCounts));
    const totalVotes = metadata.votes.length;
    const consensus = maxVotes === totalVotes;
    const majority = maxVotes > totalVotes / 2;
    
    html += '<div class="vote-summary-header">';
    html += `<div class="summary-stat">
      <span class="stat-label">총 투표:</span>
      <span class="stat-value">${totalVotes}표</span>
    </div>`;
    html += `<div class="summary-stat">
      <span class="stat-label">선택지:</span>
      <span class="stat-value">${Object.keys(voteCounts).length}개</span>
    </div>`;
    html += `<div class="summary-stat">
      <span class="stat-label">합의:</span>
      <span class="stat-value ${consensus ? 'consensus-yes' : 'consensus-no'}">${consensus ? '✅ 만장일치' : majority ? '✅ 과반수' : '⚠️ 분산'}</span>
    </div>`;
    html += '</div>';
    
    html += '<div class="vote-chart">';
    
    sortedVotes.forEach(([choice, count], index) => {
      const percentage = (count / totalVotes) * 100;
      const barWidth = (count / maxVotes) * 100;
      const isWinner = index === 0;
      const colorClass = isWinner ? 'vote-winner' : `vote-color-${index % 4}`;
      
      html += `
        <div class="vote-bar-item ${isWinner ? 'vote-winner-item' : ''}">
          <div class="vote-bar-label">
            <span class="vote-choice">${choice}</span>
            <span class="vote-count">${count}표 (${percentage.toFixed(1)}%)</span>
            ${isWinner ? '<span class="winner-badge">🏆 승리</span>' : ''}
          </div>
          <div class="vote-bar">
            <div class="vote-bar-fill ${colorClass}" style="width: ${barWidth}%" data-count="${count}">
              ${count > 0 ? count : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // 승리자 강조
    if (sortedVotes.length > 0 && sortedVotes[0][1] > 0) {
      const winner = sortedVotes[0];
      const winnerPercentage = (winner[1] / totalVotes) * 100;
      html += `
        <div class="vote-summary">
          <div class="summary-item">
            <strong>승리 선택:</strong> <span class="winner-choice">${winner[0]}</span> (${winnerPercentage.toFixed(1)}%)
          </div>
          ${consensus ? '<div class="summary-item consensus-note">✅ 모든 AI가 동일한 선택을 했습니다.</div>' : ''}
        </div>
      `;
    }
    
    html += '</div>';
  }
  
  // 각 AI의 상세 의견 (개선된 UI)
  html += '<div class="voting-details">';
  html += '<h4>💭 각 AI의 의견</h4>';
  
  voteDetails.forEach((vote, index) => {
    const voteId = `vote-${index}`;
    const choice = vote.choice || voteId;
    html += `
      <div class="vote-item" data-vote-id="${voteId}" data-choice="${choice}">
        <div class="vote-header">
          <span class="vote-agent">${vote.agentIcon} ${vote.agent}</span>
          ${vote.choice ? `<span class="vote-badge">선택: ${vote.choice}</span>` : '<span class="vote-badge no-choice">선택 없음</span>'}
          <div class="vote-actions">
            <button class="vote-feedback-btn" onclick="toggleVoteFeedback('${voteId}', 'like', '${choice}')" title="좋아요">
              👍 <span class="feedback-count" id="like-${voteId}">0</span>
            </button>
            <button class="vote-feedback-btn" onclick="toggleVoteFeedback('${voteId}', 'dislike', '${choice}')" title="싫어요">
              👎 <span class="feedback-count" id="dislike-${voteId}">0</span>
            </button>
          </div>
        </div>
        <div class="vote-content">${formatMessage(vote.response, metadata.searchResults || null)}</div>
        ${vote.choice ? `<div class="vote-choice-badge">선택: <strong>${vote.choice}</strong></div>` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  
  if (metadata.counter) {
    html += `<div class="vote-counter">
      <div class="counter-header">
        <span class="counter-icon">⚖️</span>
        <strong>총괄 AI (${metadata.counter})</strong>가 위 투표들을 집계하여 최종 결론을 도출했습니다.
      </div>
    </div>`;
  }
  
  html += '</div>';
  content.innerHTML = html;
  openModal('votingModal');
  
  // 투표 바 애니메이션
  setTimeout(() => {
    document.querySelectorAll('.vote-bar-fill').forEach(bar => {
      const width = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => {
        bar.style.width = width;
      }, 100);
    });
  }, 100);
  
  // 피드백 데이터 로드
  loadVoteFeedback();
}

// 투표 피드백 토글 함수 (서버 연동)
window.toggleVoteFeedback = async function(voteId, type, choice) {
  try {
    const voteItem = document.querySelector(`[data-vote-id="${voteId}"]`);
    if (!voteItem) return;
    
    const voteChoice = choice || voteItem.getAttribute('data-choice') || voteId;
    
    const response = await fetch(`${API_BASE}/voting/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        voteId: voteChoice,
        feedbackType: type,
        userId: currentUserId
      })
    });
    
    if (response.ok) {
      // 피드백 통계 업데이트
      await updateVoteFeedback(voteId, voteChoice, type);
    }
  } catch (error) {
    console.error('Failed to submit vote feedback:', error);
  }
};

// 투표 피드백 통계 업데이트
async function updateVoteFeedback(voteId, choice, type) {
  try {
    const response = await fetch(`${API_BASE}/voting/feedback/${currentSessionId}/${choice}`);
    const data = await response.json();
    
    if (data.success && data.stats) {
      const likeCount = document.getElementById(`like-${voteId}`);
      const dislikeCount = document.getElementById(`dislike-${voteId}`);
      
      if (likeCount) {
        likeCount.textContent = data.stats.like || 0;
      }
      if (dislikeCount) {
        dislikeCount.textContent = data.stats.dislike || 0;
      }
      
      // 버튼 활성화 상태 업데이트
      const button = event.target.closest('.vote-feedback-btn');
      if (button) {
        const allButtons = button.parentElement.querySelectorAll('.vote-feedback-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        if (type === 'like' && data.stats.like > 0) {
          button.classList.add('active');
        } else if (type === 'dislike' && data.stats.dislike > 0) {
          button.classList.add('active');
        }
      }
    }
  } catch (error) {
    console.error('Failed to update vote feedback:', error);
  }
}

// 투표 피드백 데이터 로드 (서버에서)
async function loadVoteFeedback() {
  try {
    const voteItems = document.querySelectorAll('.vote-item');
    
    for (const voteItem of voteItems) {
      const voteId = voteItem.getAttribute('data-vote-id');
      const choice = voteItem.getAttribute('data-choice') || voteId;
      
      if (!voteId) continue;
      
      const response = await fetch(`${API_BASE}/voting/feedback/${currentSessionId}/${choice}`);
      const data = await response.json();
      
      if (data.success && data.stats) {
        const likeCount = document.getElementById(`like-${voteId}`);
        const dislikeCount = document.getElementById(`dislike-${voteId}`);
        
        if (likeCount) {
          likeCount.textContent = data.stats.like || 0;
        }
        if (dislikeCount) {
          dislikeCount.textContent = data.stats.dislike || 0;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load vote feedback:', error);
  }
}

// Textarea 자동 높이 조절
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = messageInput.scrollHeight + 'px';
}

// 모달 외부 클릭시 닫기
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// 테마 토글 함수
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('athena-theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

// 성능 대시보드 표시
async function showPerformanceDashboard() {
  try {
    // 전체 요약 가져오기
    const summaryResponse = await fetch(`${API_BASE}/performance/summary`);
    const summaryData = await summaryResponse.json();
    
    // 상세 통계 가져오기
    const statsResponse = await fetch(`${API_BASE}/performance/stats`);
    const statsData = await statsResponse.json();
    
    // 사용량 통계 가져오기
    const usageResponse = await fetch(`${API_BASE}/performance/usage`);
    const usageData = await usageResponse.json();
    
    // 비용 통계 가져오기
    const costResponse = await fetch(`${API_BASE}/performance/cost`);
    const costData = await costResponse.json();
    
    // 성능 히스토리 가져오기
    const historyResponse = await fetch(`${API_BASE}/performance/history?hours=24`);
    const historyData = await historyResponse.json();
    
    // 성능 경고 가져오기
    const alertsResponse = await fetch(`${API_BASE}/performance/alerts`);
    const alertsData = await alertsResponse.json();
    
    const content = document.getElementById('performanceContent');
    if (!content) return;
    
    let html = '<div class="performance-dashboard">';
    
    // 성능 경고 표시
    if (alertsData.success && alertsData.alerts && alertsData.alerts.length > 0) {
      html += '<div class="performance-alerts">';
      html += '<h4>⚠️ 성능 경고</h4>';
      alertsData.alerts.forEach(alert => {
        const alertClass = alert.severity === 'error' ? 'alert-error' : 'alert-warning';
        html += `
          <div class="alert-item ${alertClass}">
            <span class="alert-icon">${alert.severity === 'error' ? '🔴' : '⚠️'}</span>
            <span class="alert-message">${alert.message}</span>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // 전체 요약
    if (summaryData.success && summaryData.summary && summaryData.summary.length > 0) {
      html += '<div class="performance-summary">';
      html += '<h4>📈 전체 성능 요약</h4>';
      html += '<div class="summary-grid">';
      
      summaryData.summary.forEach(stat => {
        html += `
          <div class="summary-card">
            <div class="summary-header">
              <span class="summary-provider">${getAgentIcon(stat.provider)} ${stat.provider}</span>
            </div>
            <div class="summary-stats">
              <div class="stat-item">
                <span class="stat-label">총 호출</span>
                <span class="stat-value">${stat.totalCalls || 0}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">평균 성공률</span>
                <span class="stat-value">${((stat.avgSuccessRate || 0) * 100).toFixed(1)}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">평균 응답 시간</span>
                <span class="stat-value">${(stat.avgResponseTime || 0).toFixed(0)}ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">작업 유형</span>
                <span class="stat-value">${stat.taskTypes || 0}개</span>
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div></div>';
    }
    
    // 사용량 및 비용 통계
    if (usageData.success && usageData.totalCalls > 0) {
      html += '<div class="usage-stats">';
      html += '<h4>💰 API 사용량 및 비용</h4>';
      html += '<div class="usage-grid">';
      html += `
        <div class="usage-card">
          <div class="usage-label">총 API 호출</div>
          <div class="usage-value">${usageData.totalCalls.toLocaleString()}</div>
        </div>
        <div class="usage-card">
          <div class="usage-label">총 토큰 사용</div>
          <div class="usage-value">${usageData.totalTokens.toLocaleString()}</div>
          <div class="usage-detail">입력: ${usageData.totalInputTokens.toLocaleString()} / 출력: ${usageData.totalOutputTokens.toLocaleString()}</div>
        </div>
        <div class="usage-card">
          <div class="usage-label">예상 총 비용</div>
          <div class="usage-value">$${usageData.totalCost.toFixed(4)}</div>
        </div>
        <div class="usage-card">
          <div class="usage-label">평균 응답 시간</div>
          <div class="usage-value">${usageData.avgResponseTime.toFixed(0)}ms</div>
        </div>
      `;
      html += '</div></div>';
      
      // 비용 통계 상세
      if (costData.success && costData.costStats && costData.costStats.length > 0) {
        html += '<div class="cost-breakdown">';
        html += '<h5>모델별 비용 상세</h5>';
        html += '<div class="cost-table">';
        html += '<table>';
        html += '<thead><tr><th>AI</th><th>모델</th><th>비용</th><th>토큰</th><th>호출 수</th></tr></thead>';
        html += '<tbody>';
        costData.costStats.forEach(stat => {
          html += `
            <tr>
              <td>${getAgentIcon(stat.provider)} ${stat.provider}</td>
              <td>${stat.model}</td>
              <td>$${stat.totalCost.toFixed(4)}</td>
              <td>${stat.totalTokens.toLocaleString()}</td>
              <td>${stat.callCount}</td>
            </tr>
          `;
        });
        html += '</tbody></table></div></div>';
      }
    }
    
    // 성능 히스토리 그래프
    if (historyData.success && historyData.history && historyData.history.length > 0) {
      html += '<div class="performance-history">';
      html += '<h4>📊 성능 히스토리 (24시간)</h4>';
      html += '<div class="chart-container">';
      html += '<canvas id="performanceHistoryChart"></canvas>';
      html += '</div></div>';
    }
    
    // AI별 성능 비교 차트
    if (summaryData.success && summaryData.summary && summaryData.summary.length > 0) {
      html += '<div class="performance-comparison">';
      html += '<h4>📊 AI별 성능 비교</h4>';
      html += '<div class="chart-container">';
      html += '<canvas id="performanceComparisonChart"></canvas>';
      html += '</div></div>';
    }
    
    // 상세 통계
    if (statsData.success && statsData.stats && statsData.stats.length > 0) {
      html += '<div class="performance-details">';
      html += '<h4>📋 작업 유형별 상세 통계</h4>';
      html += '<div class="stats-table">';
      html += '<table>';
      html += '<thead><tr><th>AI</th><th>작업 유형</th><th>성공률</th><th>평균 응답 시간</th><th>총 사용</th></tr></thead>';
      html += '<tbody>';
      
      statsData.stats.forEach(stat => {
        html += `
          <tr>
            <td>${getAgentIcon(stat.provider)} ${stat.provider}</td>
            <td>${stat.taskType}</td>
            <td>${((stat.successRate || 0) * 100).toFixed(1)}%</td>
            <td>${(stat.avgResponseTime || 0).toFixed(0)}ms</td>
            <td>${stat.totalUses || 0}</td>
          </tr>
        `;
      });
      
      html += '</tbody></table></div></div>';
    } else {
      html += '<div class="no-data">아직 성능 데이터가 없습니다. AI를 사용하면 통계가 수집됩니다.</div>';
    }
    
    html += '</div>';
    content.innerHTML = html;
    openModal('performanceModal');
    
    // 차트 렌더링 (Chart.js 사용)
    if (typeof Chart !== 'undefined') {
      // 성능 히스토리 그래프
      if (historyData.success && historyData.history && historyData.history.length > 0) {
        renderPerformanceHistoryChart(historyData.history);
      }
      
      // AI별 성능 비교 차트
      if (summaryData.success && summaryData.summary && summaryData.summary.length > 0) {
        renderPerformanceComparisonChart(summaryData.summary);
      }
    } else {
      console.warn('Chart.js가 로드되지 않았습니다. 그래프를 표시할 수 없습니다.');
    }
  } catch (error) {
    console.error('Failed to load performance dashboard:', error);
    alert('성능 대시보드를 불러오는 중 오류가 발생했습니다.');
  }
}

// 성능 히스토리 그래프 렌더링
function renderPerformanceHistoryChart(history) {
  const ctx = document.getElementById('performanceHistoryChart');
  if (!ctx) return;
  
  // 시간별로 그룹화
  const timeGroups = {};
  history.forEach(item => {
    const time = new Date(item.hourTimestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (!timeGroups[time]) {
      timeGroups[time] = { responseTime: [], successRate: [] };
    }
    timeGroups[time].responseTime.push(item.responseTime);
    timeGroups[time].successRate.push(item.successRate);
  });
  
  const labels = Object.keys(timeGroups).sort();
  const avgResponseTime = labels.map(time => {
    const times = timeGroups[time].responseTime;
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  });
  const avgSuccessRate = labels.map(time => {
    const rates = timeGroups[time].successRate;
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  });
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '평균 응답 시간 (ms)',
          data: avgResponseTime,
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          yAxisID: 'y',
          tension: 0.4
        },
        {
          label: '성공률 (%)',
          data: avgSuccessRate.map(r => r * 100),
          borderColor: 'rgb(76, 175, 80)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '응답 시간 (ms)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '성공률 (%)'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      }
    }
  });
}

// AI별 성능 비교 차트 렌더링
function renderPerformanceComparisonChart(summary) {
  const ctx = document.getElementById('performanceComparisonChart');
  if (!ctx) return;
  
  const providers = summary.map(s => s.provider);
  const successRates = summary.map(s => (s.avgSuccessRate || 0) * 100);
  const responseTimes = summary.map(s => s.avgResponseTime || 0);
  const totalCalls = summary.map(s => s.totalCalls || 0);
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: providers,
      datasets: [
        {
          label: '성공률 (%)',
          data: successRates,
          backgroundColor: 'rgba(76, 175, 80, 0.6)',
          borderColor: 'rgb(76, 175, 80)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: '평균 응답 시간 (ms)',
          data: responseTimes,
          backgroundColor: 'rgba(102, 126, 234, 0.6)',
          borderColor: 'rgb(102, 126, 234)',
          borderWidth: 1,
          yAxisID: 'y1',
          type: 'line'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '성공률 (%)'
          },
          max: 100
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '응답 시간 (ms)'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              const index = context.dataIndex;
              return `총 호출: ${totalCalls[index]}`;
            }
          }
        }
      }
    }
  });
}

// ==================== 음성 입출력 기능 ====================

// 음성 입력 초기화
function initVoiceInput() {
  // Web Speech API 지원 확인
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('음성 인식 API를 지원하지 않는 브라우저입니다.');
    if (voiceInputBtn) {
      voiceInputBtn.style.display = 'none';
    }
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = voiceSettings.language;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    if (voiceIcon) {
      voiceIcon.textContent = '🔴';
    }
    if (voiceInputBtn) {
      voiceInputBtn.classList.add('listening');
    }
    updateThinkingStatus('듣는 중...', '말씀해주세요');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = transcript;
    autoResizeTextarea();
    stopVoiceInput();
  };

  recognition.onerror = (event) => {
    console.error('음성 인식 오류:', event.error);
    stopVoiceInput();
    
    let errorMessage = '음성 인식 중 오류가 발생했습니다.';
    if (event.error === 'no-speech') {
      errorMessage = '음성이 감지되지 않았습니다. 다시 시도해주세요.';
    } else if (event.error === 'not-allowed') {
      errorMessage = '마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
    }
    
    alert(errorMessage);
  };

  recognition.onend = () => {
    stopVoiceInput();
  };
}

// 음성 입력 토글
function toggleVoiceInput() {
  if (!recognition) {
    alert('음성 인식 기능을 사용할 수 없습니다.');
    return;
  }

  if (isListening) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

// 음성 입력 시작
function startVoiceInput() {
  if (!recognition || isListening) return;
  
  try {
    recognition.start();
  } catch (error) {
    console.error('음성 입력 시작 오류:', error);
    alert('음성 입력을 시작할 수 없습니다.');
  }
}

// 음성 입력 중지
function stopVoiceInput() {
  if (!recognition || !isListening) return;
  
  try {
    recognition.stop();
  } catch (error) {
    console.error('음성 입력 중지 오류:', error);
  }
  
  isListening = false;
  if (voiceIcon) {
    voiceIcon.textContent = '🎤';
  }
  if (voiceInputBtn) {
    voiceInputBtn.classList.remove('listening');
  }
  hideThinking();
}

// 음성 출력 (Text-to-Speech)
function speakText(text, options = {}) {
  if (!voiceSettings.enabled) {
    return;
  }

  // 기존 음성 출력 중지
  if (currentUtterance) {
    speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.language || voiceSettings.language;
  utterance.rate = options.rate || voiceSettings.rate;
  utterance.pitch = options.pitch || voiceSettings.pitch;
  utterance.volume = (options.volume !== undefined ? options.volume : voiceSettings.volume) / 100;

  // 목소리 선택
  if (voiceSettings.voiceName) {
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === voiceSettings.voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  utterance.onstart = () => {
    console.log('음성 출력 시작');
    updateTTSPauseButton(true);
  };

  utterance.onend = () => {
    console.log('음성 출력 완료');
    currentUtterance = null;
    isPaused = false;
    pausedUtterance = null;
    updateTTSPauseButton(false);
  };

  utterance.onerror = (event) => {
    console.error('음성 출력 오류:', event.error);
    currentUtterance = null;
    isPaused = false;
    pausedUtterance = null;
    updateTTSPauseButton(false);
  };

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

// 음성 출력 중지
function stopSpeaking() {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    currentUtterance = null;
    isPaused = false;
    pausedUtterance = null;
    updateTTSPauseButton(false);
  }
}

// 음성 출력 일시정지/재개
function toggleTTSPause() {
  if (!speechSynthesis.speaking && !isPaused) {
    return;
  }

  if (isPaused) {
    // 재개
    speechSynthesis.resume();
    isPaused = false;
    updateTTSPauseButton(true);
  } else {
    // 일시정지
    speechSynthesis.pause();
    isPaused = true;
    updateTTSPauseButton(false, true);
  }
}

// TTS 일시정지 버튼 상태 업데이트
function updateTTSPauseButton(isSpeaking, isPausedState = false) {
  const ttsPauseBtn = document.getElementById('ttsPauseBtn');
  if (!ttsPauseBtn) return;

  if (isSpeaking && !isPausedState) {
    ttsPauseBtn.style.display = 'block';
    ttsPauseBtn.textContent = '⏸️';
    ttsPauseBtn.title = '음성 출력 일시정지';
  } else if (isPausedState) {
    ttsPauseBtn.style.display = 'block';
    ttsPauseBtn.textContent = '▶️';
    ttsPauseBtn.title = '음성 출력 재개';
  } else {
    ttsPauseBtn.style.display = 'none';
  }
}

// 음성 설정 로드
function loadVoiceSettings() {
  const saved = localStorage.getItem('athena-voice-settings');
  if (saved) {
    try {
      voiceSettings = { ...voiceSettings, ...JSON.parse(saved) };
    } catch (error) {
      console.error('음성 설정 로드 오류:', error);
    }
  }
  // 설정 로드 후 버튼 상태 업데이트
  updateTTSButton();
}

// 음성 설정 저장
function saveVoiceSettings() {
  localStorage.setItem('athena-voice-settings', JSON.stringify(voiceSettings));
  updateTTSButton();
}

// 음성 설정 모달 열기
function openVoiceSettingsModal() {
  const modal = document.getElementById('voiceSettingsModal');
  if (!modal) return;

  // 현재 설정 로드
  const languageSelect = document.getElementById('voiceLanguage');
  const voiceNameSelect = document.getElementById('voiceName');
  const rateSlider = document.getElementById('voiceRate');
  const pitchSlider = document.getElementById('voicePitch');
  const volumeSlider = document.getElementById('voiceVolume');

  if (languageSelect) languageSelect.value = voiceSettings.language;
  if (rateSlider) rateSlider.value = voiceSettings.rate;
  if (pitchSlider) pitchSlider.value = voiceSettings.pitch;
  if (volumeSlider) volumeSlider.value = voiceSettings.volume * 100;

  // 사용 가능한 목소리 목록 로드
  loadVoices();

  // 슬라이더 값 표시 업데이트
  updateSliderValues();

  openModal('voiceSettingsModal');

  // 이벤트 리스너 설정
  setupVoiceSettingsListeners();
}

// 사용 가능한 목소리 목록 로드
function loadVoices() {
  const voiceNameSelect = document.getElementById('voiceName');
  if (!voiceNameSelect) return;

  // 기존 옵션 제거 (기본 목소리 제외)
  while (voiceNameSelect.children.length > 1) {
    voiceNameSelect.removeChild(voiceNameSelect.lastChild);
  }

  const voices = speechSynthesis.getVoices();
  const currentLanguage = voiceSettings.language;

  // 현재 언어에 맞는 목소리만 필터링
  const filteredVoices = voices.filter(voice => voice.lang.startsWith(currentLanguage.split('-')[0]));

  filteredVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === voiceSettings.voiceName) {
      option.selected = true;
    }
    voiceNameSelect.appendChild(option);
  });

  // 목소리가 없으면 기본 목소리 사용
  if (filteredVoices.length === 0) {
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceNameSelect.appendChild(option);
    });
  }
}

// 슬라이더 값 표시 업데이트
function updateSliderValues() {
  const rateValue = document.getElementById('rateValue');
  const pitchValue = document.getElementById('pitchValue');
  const volumeValue = document.getElementById('volumeValue');
  const rateSlider = document.getElementById('voiceRate');
  const pitchSlider = document.getElementById('voicePitch');
  const volumeSlider = document.getElementById('voiceVolume');

  if (rateValue && rateSlider) {
    rateValue.textContent = parseFloat(rateSlider.value).toFixed(1);
  }
  if (pitchValue && pitchSlider) {
    pitchValue.textContent = parseFloat(pitchSlider.value).toFixed(1);
  }
  if (volumeValue && volumeSlider) {
    volumeValue.textContent = parseInt(volumeSlider.value);
  }
}

// 음성 설정 이벤트 리스너 설정
function setupVoiceSettingsListeners() {
  const languageSelect = document.getElementById('voiceLanguage');
  const voiceNameSelect = document.getElementById('voiceName');
  const rateSlider = document.getElementById('voiceRate');
  const pitchSlider = document.getElementById('voicePitch');
  const volumeSlider = document.getElementById('voiceVolume');
  const testBtn = document.getElementById('testVoiceBtn');

  // 언어 변경 시 목소리 목록 업데이트
  if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
      voiceSettings.language = e.target.value;
      loadVoices();
      saveVoiceSettings();
    });
  }

  // 목소리 선택
  if (voiceNameSelect) {
    voiceNameSelect.addEventListener('change', (e) => {
      voiceSettings.voiceName = e.target.value;
      saveVoiceSettings();
    });
  }

  // 속도 조절
  if (rateSlider) {
    rateSlider.addEventListener('input', (e) => {
      voiceSettings.rate = parseFloat(e.target.value);
      updateSliderValues();
      saveVoiceSettings();
    });
  }

  // 음높이 조절
  if (pitchSlider) {
    pitchSlider.addEventListener('input', (e) => {
      voiceSettings.pitch = parseFloat(e.target.value);
      updateSliderValues();
      saveVoiceSettings();
    });
  }

  // 볼륨 조절
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      voiceSettings.volume = parseInt(e.target.value) / 100;
      updateSliderValues();
      saveVoiceSettings();
    });
  }

  // 테스트 버튼
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      const testText = languageSelect?.value.startsWith('ko') 
        ? '안녕하세요, 음성 출력 테스트입니다.'
        : 'Hello, this is a voice output test.';
      speakText(testText);
    });
  }
}

// 브라우저가 목소리 목록을 로드할 때까지 대기
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {
    // 목소리 목록이 로드되면 업데이트
    if (document.getElementById('voiceSettingsModal')?.style.display === 'flex') {
      loadVoices();
    }
  };
}

// TTS 토글 함수
function toggleTTS() {
  voiceSettings.enabled = !voiceSettings.enabled;
  saveVoiceSettings();
  
  // 현재 재생 중인 음성 중지
  if (!voiceSettings.enabled) {
    stopSpeaking();
  }
  
  // 사용자에게 알림
  const status = voiceSettings.enabled ? '켜짐' : '꺼짐';
  console.log(`TTS ${status}`);
}

// TTS 버튼 상태 업데이트
function updateTTSButton() {
  const ttsToggle = document.getElementById('ttsToggle');
  if (ttsToggle) {
    if (voiceSettings.enabled) {
      ttsToggle.textContent = '🔊';
      ttsToggle.title = '음성 출력 (TTS) 끄기';
      ttsToggle.classList.add('active');
    } else {
      ttsToggle.textContent = '🔇';
      ttsToggle.title = '음성 출력 (TTS) 켜기';
      ttsToggle.classList.remove('active');
    }
  }
}

// AI 응답에 음성 출력 추가
function addMessageWithVoice(role, content, metadata = null) {
  addMessage(role, content, metadata);
  
  // Assistant 응답인 경우 음성 출력
  if (role === 'assistant' && voiceSettings.enabled) {
    // HTML 태그 제거하고 텍스트만 추출
    const textContent = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (textContent.length > 0) {
      // 약간의 지연 후 음성 출력 (UI 업데이트 후)
      setTimeout(() => {
        speakText(textContent);
      }, 500);
    }
  }
}

// 스트리밍 응답 완료 시 음성 출력
function handleStreamingComplete(fullContent) {
  if (voiceSettings.enabled && fullContent) {
    // HTML 태그 제거하고 텍스트만 추출
    const textContent = fullContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (textContent.length > 0) {
      setTimeout(() => {
        speakText(textContent);
      }, 500);
    }
  }
}

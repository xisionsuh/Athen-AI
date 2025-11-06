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
});

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
      addMessage('assistant', data.response, data.metadata);
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
              }
            } else if (parsed.type === 'chunk') {
              // 한글 콘텐츠 안전하게 처리
              const chunkContent = parsed.content || '';
              fullContent += chunkContent;
              const streamingContentDiv = assistantMessageDiv.querySelector('.streaming-content');
              if (streamingContentDiv) {
                streamingContentDiv.innerHTML = formatMessage(fullContent);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } else if (parsed.type === 'agent_response') {
              // Parallel 모드: 각 AI의 응답
              console.log(`📝 ${parsed.agent}의 응답 수신됨`);
            } else if (parsed.type === 'step_start') {
              // Sequential 모드: 단계 시작
              console.log(`📌 단계 ${parsed.step} 시작 (${parsed.agent})`);
            } else if (parsed.type === 'debate_round') {
              // Debate 모드: 라운드 시작
              console.log(`💬 토론 라운드 ${parsed.round} 시작`);
            } else if (parsed.type === 'debate_opinion_start') {
              // Debate 모드: 의견 시작
              console.log(`💭 ${parsed.agent}의 의견 시작`);
            } else if (parsed.type === 'debate_conclusion_start') {
              // Debate 모드: 결론 시작
              console.log(`📊 결론 도출 시작`);
            } else if (parsed.type === 'vote_start') {
              // Voting 모드: 투표 시작
              console.log(`🗳️ ${parsed.agent}의 투표 시작`);
            } else if (parsed.type === 'voting_tally_start') {
              // Voting 모드: 집계 시작
              console.log(`📊 투표 집계 시작`);
            } else if (parsed.type === 'synthesis_start') {
              // Parallel 모드: 종합 시작
              console.log(`🔄 응답 종합 시작`);
            } else if (parsed.type === 'done') {
              // 스트리밍 완료
              if (metadata) {
                renderMetadata(metadataDiv, metadata);
              }
              // 최종 메시지 저장
              if (fullContent) {
                const finalContentDiv = assistantMessageDiv.querySelector('.streaming-content');
                if (finalContentDiv) {
                  finalContentDiv.innerHTML = formatMessage(fullContent);
                }
              }
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
  const formattedContent = formatMessage(content);
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
      
      const sourcesHeader = document.createElement('div');
      sourcesHeader.className = 'sources-header';
      sourcesHeader.innerHTML = `
        <span class="sources-toggle" onclick="toggleSources(this)">
          📚 출처 보기 (${metadata.searchResults.length}개)
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
        sourceItem.innerHTML = `
          <div class="source-number">${index + 1}</div>
          <div class="source-content">
            <a href="${result.link}" target="_blank" rel="noopener noreferrer" class="source-title">
              ${result.title || '제목 없음'}
            </a>
            <div class="source-link">${result.link}</div>
            ${result.snippet ? `<div class="source-snippet">${result.snippet}</div>` : ''}
          </div>
        `;
        sourcesList.appendChild(sourceItem);
      });
      
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

// 메시지 포맷팅 (마크다운 간단 지원)
function formatMessage(text) {
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
  
  // 마크다운 처리
  formatted = formatted
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  
  return formatted;
}

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
function showThinking(text = '생각하는 중...') {
  thinkingIndicator.style.display = 'flex';
  document.getElementById('thinkingText').textContent = text;
}

function hideThinking() {
  thinkingIndicator.style.display = 'none';
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
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
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
  if (!metadata.debates) return;
  
  const content = document.getElementById('debateContent');
  let html = '';
  
  metadata.debates.forEach((round, roundIndex) => {
    html += `<div class="debate-round">
      <h4>Round ${roundIndex + 1}</h4>
      <div class="debate-opinions">`;
    
    round.forEach(debate => {
      html += `
        <div class="debate-opinion">
          <div class="opinion-header">
            <span class="opinion-agent">${debate.agent}</span>
          </div>
          <div class="opinion-content">${formatMessage(debate.opinion)}</div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  });
  
  if (metadata.moderator) {
    html += `<div class="debate-moderator">
      <strong>총괄 AI (${metadata.moderator})</strong>가 위 의견들을 종합하여 최종 결론을 도출했습니다.
    </div>`;
  }
  
  content.innerHTML = html;
  openModal('debateModal');
}

// Voting 모드 투표 결과 표시
function showVotingDetails(metadata) {
  if (!metadata.votes) return;
  
  const content = document.getElementById('votingContent');
  let html = '<div class="voting-results">';
  
  metadata.votes.forEach(vote => {
    html += `
      <div class="vote-item">
        <div class="vote-header">
          <span class="vote-agent">${vote.agent}</span>
        </div>
        <div class="vote-content">${formatMessage(vote.response)}</div>
      </div>
    `;
  });
  
  if (metadata.counter) {
    html += `<div class="vote-counter">
      <strong>총괄 AI (${metadata.counter})</strong>가 위 투표들을 집계하여 최종 결론을 도출했습니다.
    </div>`;
  }
  
  html += '</div>';
  content.innerHTML = html;
  openModal('votingModal');
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

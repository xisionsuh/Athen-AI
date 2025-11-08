// Service Worker for Athena AI PWA
const CACHE_NAME = 'athena-ai-v1';
const RUNTIME_CACHE = 'athena-runtime-v1';

// 정적 자산 캐싱
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/app.js',
  '/styles.css',
  '/manifest.json'
];

// 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// fetch 이벤트 - 네트워크 우선, 캐시 폴백 전략
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // chrome-extension, chrome, data 등은 캐싱하지 않음
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:' || url.protocol === 'data:') {
    return;
  }

  // API 요청은 네트워크만 사용 (캐싱 안 함)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.' }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        );
      })
    );
    return;
  }

  // 정적 자산은 캐시 우선, 네트워크 폴백
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // 유효한 응답만 캐시 (chrome-extension, chrome, data 등은 제외)
          const url = new URL(request.url);
          const isValidScheme = url.protocol === 'http:' || url.protocol === 'https:';
          
          if (response && response.status === 200 && response.type === 'basic' && isValidScheme) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              try {
                cache.put(request, responseToCache);
              } catch (error) {
                // 캐시 실패 시 무시 (chrome-extension 등 지원하지 않는 스킴)
                console.warn('[Service Worker] Cache put failed:', error);
              }
            });
          }
          return response;
        }).catch(() => {
          // 오프라인일 때 기본 페이지 반환
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

// 백그라운드 동기화 (선택사항)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    console.log('[Service Worker] Background sync triggered');
    // 향후 오프라인 메시지 동기화 구현 가능
  }
});

// 푸시 알림 (선택사항)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  // 향후 푸시 알림 구현 가능
});


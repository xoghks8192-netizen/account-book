const CACHE_NAME = 'household-budget-v2'
const PRECACHE_URLS = ['/manifest.json', '/icon-192.png', '/icon-512.png']

// 캐시도 없고 네트워크도 실패했을 때 마지막으로 돌려줄 안전한 응답
function offlineFallback() {
  return new Response('오프라인 상태입니다. 네트워크 연결을 확인해주세요.', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return

  // HTML 페이지는 항상 최신 버전을 우선 받아온다 (오래된 캐시가 새 빌드의
  // 해시된 JS/CSS 파일명과 어긋나서 빈 화면이 뜨는 문제를 막기 위함)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          // 캐시에도 없으면 index.html이라도 반환 시도, 그마저 없으면 오프라인 응답
          return cached || (await caches.match('/index.html')) || offlineFallback()
        })
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(() => cached || offlineFallback())
      return cached || fetchPromise
    })
  )
})

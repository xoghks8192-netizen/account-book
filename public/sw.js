const CACHE_NAME = 'household-budget-v3'
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
  // 우리 사이트(같은 origin) 요청만 처리한다.
  // Supabase 등 외부(cross-origin) API 호출은 절대 가로채지 않고 그대로 통과시킨다.
  if (url.origin !== self.location.origin) return
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

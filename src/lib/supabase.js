import { createClient } from '@supabase/supabase-js'
import { reportProblem } from './diagnostics'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Keep the existing query-builder interface, but never send ledger requests
// directly to the public Supabase REST API. Identity comes from the HttpOnly cookie.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  global: {
    fetch: async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url)
      const match = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)
      if (!match) throw new Error('지원하지 않는 요청입니다.')
      const headers = new Headers(init.headers)
      let response
      try { response = await fetch('/api/data', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        signal:init.signal,
        body:JSON.stringify({ table:match[1], method:init.method || 'GET',
          params:[...url.searchParams], body:init.body ? JSON.parse(init.body) : null,
          accept:headers.get('Accept') || '', prefer:headers.get('Prefer') || '' }),
      }) } catch(e) { reportProblem('data'); throw e }
      if (!response.ok && response.status !== 406) reportProblem('data',response.status)
      if (response.status === 401) window.dispatchEvent(new Event('hb-session-expired'))
      return response
    },
  },
})

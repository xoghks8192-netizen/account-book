import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AUTH_KEY } from '../users'

export default function Login({ onLogin }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('app_users')
      .select('username, password')
      .eq('username', id)
      .maybeSingle()
    setLoading(false)
    if (error || !data || data.password !== pw) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    localStorage.setItem(AUTH_KEY, id)
    onLogin(id)
  }

  return (
    <div>
      <div className="brand-header" style={{ borderRadius: '0 0 28px 28px', paddingBottom: 24 }}>
        <h1>태환 ❤️ 진주</h1>
        <span>가계부 로그인</span>
      </div>
      <div className="container" style={{ paddingTop: 40 }}>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>아이디</label>
            <input type="text" value={id} onChange={(e) => setId(e.target.value)} required autoFocus />
          </div>
          <div className="form-row">
            <label>비밀번호</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </div>
          {error && <div style={{ color: '#ff8fab', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '확인 중...' : '로그인 💗'}
          </button>
        </form>
      </div>
    </div>
  )
}

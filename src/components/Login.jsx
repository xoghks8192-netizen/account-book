import { useState } from 'react'
import { saveSession } from '../users'
import Signup from './Signup'

export default function Login({ onLogin }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSignup, setShowSignup] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: id, password: pw }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '아이디 또는 비밀번호가 올바르지 않습니다.')
        return
      }
      saveSession(data)
      onLogin(data)
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (showSignup) {
    return <Signup onDone={() => setShowSignup(false)} />
  }

  return (
    <div>
      <div className="brand-header" style={{ borderRadius: '0 0 28px 28px', paddingBottom: 24 }}>
        <h1>가계부</h1>
        <span>로그인</span>
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
          <button
            type="button"
            onClick={() => setShowSignup(true)}
            style={{
              marginTop: 10,
              width: '100%',
              border: 'none',
              background: 'none',
              color: '#b896ff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            계정이 없으신가요? 회원가입
          </button>
        </form>
      </div>
    </div>
  )
}

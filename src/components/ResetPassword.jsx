import { useState } from 'react'

export default function ResetPassword({ onDone }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [anniversaryType, setAnniversaryType] = useState('dating')
  const [anniversaryDate, setAnniversaryDate] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 4) {
      setError('새 비밀번호는 4자 이상으로 입력해주세요.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          displayName,
          partnerName,
          anniversaryType,
          anniversaryDate,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '비밀번호 재설정에 실패했습니다.')
        return
      }
      setSuccess('비밀번호가 변경되었습니다. 로그인해주세요.')
      setUsername('')
      setDisplayName('')
      setPartnerName('')
      setAnniversaryDate('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('비밀번호 재설정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="brand-header" style={{ borderRadius: '0 0 28px 28px', paddingBottom: 24 }}>
        <h1>비밀번호 찾기</h1>
        <span>가입 시 입력한 정보를 입력해주세요</span>
      </div>
      <div className="container" style={{ paddingTop: 40 }}>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>아이디</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>내 이름</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>상대방 이름</label>
            <input type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>기념일 종류</label>
            <select value={anniversaryType} onChange={(e) => setAnniversaryType(e.target.value)}>
              <option value="dating">연애 시작일</option>
              <option value="wedding">결혼일</option>
            </select>
          </div>
          <div className="form-row">
            <label>기념일 날짜</label>
            <input type="date" value={anniversaryDate} onChange={(e) => setAnniversaryDate(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>새 비밀번호</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>새 비밀번호 확인</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          {error && <div style={{ color: '#ff8fab', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          {success && <div style={{ color: '#6cb6ff', fontSize: 13, marginBottom: 10 }}>{success}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="submit-btn" disabled={loading} style={{ flex: 1 }}>
              {loading ? '확인 중...' : '비밀번호 변경'}
            </button>
            <button
              type="button"
              onClick={onDone}
              style={{
                flex: 1,
                padding: 13,
                border: 'none',
                borderRadius: 999,
                background: '#fdeef3',
                color: '#b88a9c',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: '"Jua", sans-serif',
                cursor: 'pointer',
              }}
            >
              로그인으로
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

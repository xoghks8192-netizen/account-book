import { useState } from 'react'

export default function ChangePassword({ user, onClose, onUpdateSession }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [invite, setInvite] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)

  async function createInvite() {
    setInviting(true)
    setInviteError('')
    try {
      const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'invite'}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '초대 코드 생성에 실패했습니다.')
      setInvite(data.code)
    } catch(e) { setInviteError(e.message) }
    finally { setInviting(false) }
  }

  const [datingStart, setDatingStart] = useState(user.datingStart || '')
  const [weddingDate, setWeddingDate] = useState(user.weddingDate || '')
  const [annivError, setAnnivError] = useState('')
  const [annivSuccess, setAnnivSuccess] = useState('')
  const [annivSaving, setAnnivSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!next || next.length < 8) {
      setError('새 비밀번호는 8자 이상으로 입력해주세요.')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/change-pw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '비밀번호 변경에 실패했습니다.')
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      setSuccess('비밀번호가 변경되었습니다.')
    } catch {
      setError('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAnniversarySave() {
    setAnnivError('')
    setAnnivSuccess('')
    setAnnivSaving(true)
    try {
      const res = await fetch('/api/update-household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          datingStart: datingStart || null,
          weddingDate: weddingDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnnivError(data.error || '기념일 저장에 실패했습니다.')
        return
      }
      onUpdateSession(data)
      setAnnivSuccess('기념일이 저장되었습니다.')
    } catch (e) {
      setAnnivError(e.message)
    } finally {
      setAnnivSaving(false)
    }
  }

  return (
    <div className="form">
      <h3>내 정보 변경</h3>
      {user.members.length === 1 && (
        <section style={{marginBottom:24}}>
          <h4>배우자 초대</h4>
          <p>코드를 배우자에게만 전달해주세요. 24시간 동안 한 번 사용할 수 있으며, 상대방이 회원가입할 때 입력하면 연결됩니다.</p>
          <button type="button" className="submit-btn" disabled={inviting} onClick={createInvite}>{inviting ? '생성 중…' : '초대 코드 만들기'}</button>
          {invite && <div className="form-row"><label>코드 (눌러서 전체 선택)</label><input readOnly value={invite} onFocus={e => e.target.select()} /></div>}
          {inviteError && <p role="alert">{inviteError}</p>}
        </section>
      )}
      <h4 style={{ marginTop: 0 }}>비밀번호 변경</h4>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>현재 비밀번호</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>새 비밀번호</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>새 비밀번호 확인</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <div style={{ color: '#ff8fab', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ color: '#6cb6ff', fontSize: 13, marginBottom: 10 }}>{success}</div>}
        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? '변경 중...' : '변경하기'}
        </button>
      </form>

      <h3 style={{ marginTop: 24 }}>기념일 설정</h3>
      <div className="form-row">
        <label>연애 시작일</label>
        <input type="date" value={datingStart} onChange={(e) => setDatingStart(e.target.value)} />
      </div>
      <div className="form-row">
        <label>결혼일</label>
        <input type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
      </div>
      {annivError && <div style={{ color: '#ff8fab', fontSize: 13, marginBottom: 10 }}>{annivError}</div>}
      {annivSuccess && <div style={{ color: '#6cb6ff', fontSize: 13, marginBottom: 10 }}>{annivSuccess}</div>}
      <button type="button" onClick={handleAnniversarySave} className="submit-btn" disabled={annivSaving}>
        {annivSaving ? '저장 중...' : '기념일 저장'}
      </button>

      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 12,
          width: '100%',
          border: 'none',
          borderRadius: 999,
          background: '#fdeef3',
          color: '#b88a9c',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          padding: 13,
        }}
      >
        닫기
      </button>
    </div>
  )
}

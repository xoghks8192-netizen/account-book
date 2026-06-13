import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ChangePassword({ user, onClose }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!next || next.length < 4) {
      setError('새 비밀번호는 4자 이상으로 입력해주세요.')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setSaving(true)
    const { data, error: fetchError } = await supabase
      .from('app_users')
      .select('password')
      .eq('username', user)
      .maybeSingle()

    if (fetchError || !data || data.password !== current) {
      setSaving(false)
      setError('현재 비밀번호가 올바르지 않습니다.')
      return
    }

    const { error: updateError } = await supabase
      .from('app_users')
      .update({ password: next })
      .eq('username', user)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setCurrent('')
    setNext('')
    setConfirm('')
    setSuccess('비밀번호가 변경되었습니다.')
  }

  return (
    <div className="form">
      <h3>비밀번호 변경</h3>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="submit-btn" disabled={saving} style={{ flex: 1 }}>
            {saving ? '변경 중...' : '변경하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 999,
              background: '#fdeef3',
              color: '#b88a9c',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </form>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinLock({ onUnlock, onCancel, mode = 'unlock' }) {
  const [digits, setDigits] = useState([])
  const [shake, setShake] = useState(false)
  const [setupStep, setSetupStep] = useState(1)
  const [firstPin, setFirstPin] = useState('')

  useEffect(() => {
    if (mode === 'unlock' && digits.length === 4) {
      const stored = localStorage.getItem('app_pin')
      if (digits.join('') === stored) {
        onUnlock()
      } else {
        setShake(true)
        setTimeout(() => { setShake(false); setDigits([]) }, 500)
      }
    }

    if (mode === 'setup' && digits.length === 4) {
      if (setupStep === 1) {
        setFirstPin(digits.join(''))
        setDigits([])
        setSetupStep(2)
      } else {
        if (digits.join('') === firstPin) {
          localStorage.setItem('app_pin', digits.join(''))
          onUnlock()
        } else {
          setShake(true)
          setTimeout(() => { setShake(false); setDigits([]); setSetupStep(1); setFirstPin('') }, 500)
        }
      }
    }
  }, [digits])

  function press(key) {
    if (key === '⌫') { setDigits((p) => p.slice(0, -1)); return }
    if (key === '' || digits.length >= 4) return
    setDigits((p) => [...p, key])
  }

  const title = mode === 'unlock'
    ? 'PIN 입력'
    : setupStep === 1 ? 'PIN 설정' : 'PIN 확인'
  const subtitle = mode === 'unlock'
    ? '앱 잠금을 해제하세요'
    : setupStep === 1 ? '사용할 PIN 4자리를 입력하세요' : '한 번 더 입력하세요'

  return createPortal(
    <div className="pin-overlay">
      <div className="pin-box">
        {onCancel && (
          <button className="pin-cancel" onClick={onCancel}>취소</button>
        )}
        <div className="pin-title">{title}</div>
        <div className="pin-subtitle">{subtitle}</div>
        <div className={`pin-dots${shake ? ' shake' : ''}`}>
          {[0,1,2,3].map((i) => (
            <div key={i} className={`pin-dot${digits.length > i ? ' filled' : ''}`} />
          ))}
        </div>
        <div className="pin-pad">
          {KEYS.map((k, i) => (
            <button key={i} className={`pin-key${k === '' ? ' invisible' : ''}`} onClick={() => press(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

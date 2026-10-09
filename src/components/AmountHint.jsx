import { usePrivacy } from '../lib/privacy'
import { koreanWon } from '../lib/displayText'

export default function AmountHint({ value }) {
  const hidden = usePrivacy()
  const text = koreanWon(value)
  return !hidden && text ? <div className="amount-hint" aria-live="polite">{text}</div> : null
}

import { DATING_START, WEDDING_DATE, daysSince } from '../anniversaries'

function formatDday(days) {
  return days >= 0 ? `D+${days}` : `D${days}`
}

export default function AnniversaryBanner() {
  const datingDays = daysSince(DATING_START)
  const weddingDays = daysSince(WEDDING_DATE)

  return (
    <div className="anniversary">
      <div className="anniversary-item">
        <span className="label">연애</span>
        <span className="value">{formatDday(datingDays)}</span>
      </div>
      <div className="anniversary-item">
        <span className="label">결혼</span>
        <span className="value">{formatDday(weddingDays)}</span>
      </div>
    </div>
  )
}

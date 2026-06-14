import { daysSince } from '../anniversaries'

function formatDday(days) {
  return days >= 0 ? `D+${days}` : `D${days}`
}

export default function AnniversaryBanner({ datingStart, weddingDate }) {
  if (!datingStart && !weddingDate) return null

  return (
    <div className="anniversary">
      {datingStart && (
        <div className="anniversary-item">
          <span className="label">연애</span>
          <span className="value">{formatDday(daysSince(datingStart))}</span>
        </div>
      )}
      {weddingDate && (
        <div className="anniversary-item">
          <span className="label">결혼</span>
          <span className="value">{formatDday(daysSince(weddingDate))}</span>
        </div>
      )}
    </div>
  )
}

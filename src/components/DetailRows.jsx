export default function DetailRows({ rows }) {
  return <dl className="detail-rows">{rows.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
  )}</dl>
}

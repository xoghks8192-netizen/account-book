export async function requestAiInsight(messages) {
  const res = await fetch('/api/ai-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI 분석에 실패했습니다.')
  return data.text
}

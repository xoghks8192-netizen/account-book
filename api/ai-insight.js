export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages } = req.body
  if (!messages) return res.status(400).json({ error: 'messages가 필요합니다.' })

  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 1000,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'AI 요청에 실패했습니다.' })
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    res.status(200).json({ text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

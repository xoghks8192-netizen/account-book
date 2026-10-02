// Deliberately disabled. Do not reconnect without authentication and a security review.
export default function handler(req, res) {
  return res.status(410).json({ error: '사용이 종료된 기능입니다.' })
}

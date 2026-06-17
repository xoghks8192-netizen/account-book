import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)
  const raf = useRef(null)

  useEffect(() => {
    const from = prev.current
    const to = target
    if (from === to) return
    prev.current = to

    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return display
}

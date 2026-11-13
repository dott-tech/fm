import { useEffect, useRef, useState } from 'react'

// Animates a number from its previous value to the new one (e.g. the big
// "left after costs" figure after adding income). Skipped when the phone
// asks for reduced motion.
export function useCountUp(target: number, durationMs = 600): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const start = from.current
    from.current = target
    if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target)
      return
    }
    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setShown(Math.round(start + (target - start) * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return shown
}

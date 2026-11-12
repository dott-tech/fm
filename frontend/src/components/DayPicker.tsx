import { useState } from 'react'
import { daysAgoIso, localIsoDate } from '../lib/format'
import { Choices } from './ui'

type DayChoice = 'today' | 'yesterday' | 'other'

const OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'other', label: 'Other day' },
] as const

// Today / Yesterday / Other day. Calls onChange with "YYYY-MM-DD".
// Most entries are today, so that's one tap less than opening a calendar.
export function DayPicker({ value, onChange }: { value: string; onChange: (isoDay: string) => void }) {
  const today = localIsoDate()
  const yesterday = daysAgoIso(1)
  const [choice, setChoice] = useState<DayChoice>(
    value === today ? 'today' : value === yesterday ? 'yesterday' : 'other',
  )

  function choose(next: DayChoice) {
    setChoice(next)
    if (next === 'today') onChange(today)
    else if (next === 'yesterday') onChange(yesterday)
    else onChange(daysAgoIso(2))
  }

  return (
    <div>
      <Choices label="When" columns={3} options={OPTIONS} value={choice} onChange={choose} />
      {choice === 'other' && (
        <input
          type="date"
          aria-label="Date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="mt-2 h-12 w-full rounded-xl border border-stone-300 bg-white px-4"
        />
      )}
    </div>
  )
}

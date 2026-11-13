import { useState } from 'react'
import { useI18n } from '../i18n'
import { daysAgoIso, localIsoDate } from '../lib/format'
import { Choices } from './ui'

type DayChoice = 'today' | 'yesterday' | 'other'

// Today / Yesterday / Other day. Calls onChange with "YYYY-MM-DD".
// Most entries are today, so that's one tap less than opening a calendar.
export function DayPicker({ value, onChange }: { value: string; onChange: (isoDay: string) => void }) {
  const { m } = useI18n()
  const today = localIsoDate()
  const yesterday = daysAgoIso(1)
  const [choice, setChoice] = useState<DayChoice>(value === today ? 'today' : value === yesterday ? 'yesterday' : 'other')

  function choose(next: DayChoice) {
    setChoice(next)
    if (next === 'today') onChange(today)
    else if (next === 'yesterday') onChange(yesterday)
    else onChange(daysAgoIso(2))
  }

  return (
    <div>
      <Choices
        label={m.common.when}
        columns={3}
        value={choice}
        onChange={choose}
        options={[
          { value: 'today', label: m.common.today },
          { value: 'yesterday', label: m.common.yesterday },
          { value: 'other', label: m.common.otherDay },
        ]}
      />
      {choice === 'other' && (
        <input
          type="date"
          aria-label={m.common.date}
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="pop mt-2 h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-ink"
        />
      )}
    </div>
  )
}

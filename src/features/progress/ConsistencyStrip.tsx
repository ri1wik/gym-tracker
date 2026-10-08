import { Card } from '../profile/controls'
import { formatDayMonth } from '../profile/format'
import { consistencySummary, type WeekChip, type WeekState } from './consistency'

const STATE_CLASS: Record<WeekState, string> = {
  hit: 'bg-mint/15 text-mint-text',
  partial: 'bg-accent/15 text-accent-text',
  off: 'bg-surface-2 text-ink-2',
  before: 'border border-dashed border-line-strong text-ink-3',
}

const STATE_WORD: Record<WeekState, string> = {
  hit: 'hit',
  partial: 'partial',
  off: 'off',
  before: 'no data yet',
}

const STATE_MARK: Record<WeekState, string> = { hit: 'Hit', partial: 'Part', off: 'Off', before: '' }

export function ConsistencyStrip({ chips, target }: { chips: readonly WeekChip[]; target: number }) {
  const { met, of } = consistencySummary(chips)
  const hasData = of > 0 || chips.some((c) => c.state !== 'before')
  return (
    <Card title="Consistency, last 12 weeks">
      <p className="text-[15px] text-ink-2">
        {hasData ? (
          <>
            Target met in <span className="num font-semibold text-ink-1">{met}</span> of <span className="num font-semibold text-ink-1">{of}</span> weeks. The target is{' '}
            <span className="num font-semibold text-ink-1">{target}</span> sessions a week.
          </>
        ) : (
          <>Collecting: your first finished session starts the strip. The target is <span className="num font-semibold text-ink-1">{target}</span> sessions a week.</>
        )}
      </p>
      <ul className="grid grid-cols-6 gap-2" aria-label="Sessions per week, oldest first">
        {chips.map((c) => (
          <li
            key={c.start}
            aria-label={`Week of ${formatDayMonth(c.start)}: ${c.count} sessions, ${STATE_WORD[c.state]}${c.isCurrent ? ', this week so far' : ''}`}
            className={[
              'flex h-16 flex-col items-center justify-center rounded-control',
              STATE_CLASS[c.state],
              c.isCurrent ? 'ring-2 ring-ink-2' : '',
            ].join(' ')}
          >
            <span className="num text-[20px] font-bold leading-none">{c.state === 'before' ? '' : c.count}</span>
            <span className="mt-1 text-[12px] font-semibold leading-none">{c.isCurrent ? 'Now' : STATE_MARK[c.state]}</span>
            <span className="num mt-0.5 text-[11px] font-medium leading-none">{formatDayMonth(c.start)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-ink-2">Hit means the target was met, Part means some sessions, Off means none. A missed week is just a grey chip that scrolls away.</p>
    </Card>
  )
}

import { describe, expect, it } from 'vitest'
import type { HistorySet } from './contract'
import { deloadStatus, isRegressing, keyLiftIds, weeklyBestEstimates } from './deload'
import { history, program, session } from './fixtures'

describe('deload', () => {
  it('is due at week index 6 on the schedule', () => {
    const p = program({ started_on: '2026-08-27' })
    const s = deloadStatus(p, history(), '2026-10-08')
    expect(s).toEqual({ due: true, reason: 'schedule', week_index: 6, every_weeks: 6, regressing_key_lifts: [] })
    expect(deloadStatus(p, history(), '2026-10-07').due).toBe(false)
    expect(deloadStatus(p, history(), '2026-10-07').week_index).toBe(5)
  })

  it('a deficit of 20 percent or more, or an advanced lifter, deloads every 5th week', () => {
    const p = program({ started_on: '2026-09-03', deficit_fraction: 0.2 })
    expect(deloadStatus(p, history(), '2026-10-08')).toMatchObject({ due: true, reason: 'schedule', week_index: 5, every_weeks: 5 })
    expect(deloadStatus(program({ started_on: '2026-09-03', deficit_fraction: 0.15 }), history(), '2026-10-08').due).toBe(false)
    expect(deloadStatus(program({ started_on: '2026-09-03', training_age: 'advanced' }), history(), '2026-10-08').due).toBe(true)
  })

  it('counts from the last deload, not the program start', () => {
    const p = program({ started_on: '2026-01-01', deload: { every_weeks: 6, week_index: 0, last_deload_on: '2026-09-24', active: false } })
    expect(deloadStatus(p, history(), '2026-10-08')).toMatchObject({ due: false, week_index: 2 })
  })

  it('deload now: the active flag makes it due with the manual reason', () => {
    const p = program({ started_on: '2026-10-01', deload: { every_weeks: 6, week_index: 0, last_deload_on: null, active: true } })
    expect(deloadStatus(p, history(), '2026-10-08')).toMatchObject({ due: true, reason: 'manual' })
  })

  it('two key lifts falling three weeks running trigger a deload at week 4', () => {
    const weeks = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']
    const sets: HistorySet[] = []
    const bench = [100_000, 97_500, 95_000, 92_500]
    const squat = [140_000, 135_000, 130_000, 125_000]
    weeks.forEach((d, i) => {
      sets.push(...session('barbell-bench-press', d, bench[i], [5, 5, 5]))
      sets.push(...session('back-squat', d, squat[i], [5, 5, 5]))
      sets.push(...session('barbell-row', d, 80_000, [8, 8, 8]))
    })
    const p = program({ started_on: '2026-09-10' })
    const s = deloadStatus(p, history(sets), '2026-10-08')
    expect(s.week_index).toBe(4)
    expect(s.regressing_key_lifts).toEqual(['barbell-bench-press', 'back-squat'])
    expect(s.due).toBe(true)
    expect(s.reason).toBe('regression')
  })

  it('one regressing lift is not enough, and a skipped week breaks the run', () => {
    const sets: HistorySet[] = []
    const loads = [100_000, 97_500, 95_000, 92_500]
    ;['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'].forEach((d, i) => sets.push(...session('barbell-bench-press', d, loads[i], [5, 5, 5])))
    const one = deloadStatus(program({ started_on: '2026-09-10' }), history(sets), '2026-10-08')
    expect(one.regressing_key_lifts).toEqual(['barbell-bench-press'])
    expect(one.due).toBe(false)
    const gapped: HistorySet[] = []
    ;['2026-09-07', '2026-09-21', '2026-09-28', '2026-10-05'].forEach((d, i) => gapped.push(...session('back-squat', d, loads[i], [5, 5, 5])))
    expect(isRegressing(weeklyBestEstimates(history(gapped), 'back-squat', '2026-10-08'))).toBe(false)
  })

  it('weekly bests use Epley on working sets only and skip assisted sets', () => {
    const sets = [
      ...session('barbell-bench-press', '2026-10-05', 80_000, [8, 8, 8]),
      ...session('barbell-bench-press', '2026-10-07', 82_500, [6, 6, 6]),
    ]
    const series = weeklyBestEstimates(history(sets), 'barbell-bench-press', '2026-10-08')
    expect(series).toEqual([{ week: '2026-10-05', best_g: Math.round(80_000 * (1 + 8 / 30)) }])
    const assisted = session('assisted-pull-up', '2026-10-05', 0, [8, 8], { assist_g: 20_000 })
    expect(weeklyBestEstimates(history(assisted), 'assisted-pull-up', '2026-10-08')).toEqual([])
  })

  it('key lifts are the flagged items of each template day', () => {
    expect(keyLiftIds(program())).toEqual(['barbell-bench-press', 'barbell-row', 'back-squat', 'overhead-press', 'deadlift', 'romanian-deadlift'])
  })
})

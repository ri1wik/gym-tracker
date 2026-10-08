import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { libraryDb, saveMachineSetting } from './store'

describe('machine settings', () => {
  beforeEach(async () => {
    await libraryDb().machine_settings.clear()
  })

  it('creates one row on the first saved field and updates the same row for the next', async () => {
    await saveMachineSetting('leg-press', 'seat', ' 4 ')
    await saveMachineSetting('leg-press', 'pad', '2')
    const rows = await libraryDb().machine_settings.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ machine_id: 'leg-press', seat: '4', pad: '2', grip: null, dirty: 1, version: 1, deleted_at: null })
  })

  it('does not create a row for an empty value and clears a field to null', async () => {
    await saveMachineSetting('pec-deck', 'seat', '   ')
    expect(await libraryDb().machine_settings.count()).toBe(0)
    await saveMachineSetting('pec-deck', 'seat', '5')
    await saveMachineSetting('pec-deck', 'seat', '')
    const [row] = await libraryDb().machine_settings.toArray()
    expect(row.seat).toBeNull()
  })

  it('keeps each machine apart', async () => {
    await saveMachineSetting('leg-press', 'seat', '4')
    await saveMachineSetting('pec-deck', 'seat', '6')
    expect(await libraryDb().machine_settings.count()).toBe(2)
  })
})

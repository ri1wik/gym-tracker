// Backup: Export writes every table to a dated JSON file; Import merges one
// back by row id; one "Last backup" line, never a nag
// (docs/SPEC-retention-priority.md item 4).

import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { nowIso } from '../../data/sync/clock'
import { diffDays, localDateKey } from '../../domain/dates'
import { Card, secondaryButtonClass } from '../profile/controls'
import { currentDb, currentUserId } from '../profile/current'
import { buildBackup, downloadBackup, importBackup, parseBackup, readLastBackupAt, recordBackup, type ImportResult } from './backup'

function lastBackupLine(at: string | null): { text: string; days: number | null } {
  if (!at) return { text: 'No backup yet', days: null }
  const days = diffDays(localDateKey(new Date(at)), localDateKey())
  return { text: days <= 0 ? 'Last backup: today' : `Last backup: ${days} ${days === 1 ? 'day' : 'days'} ago`, days }
}

export function BackupCard() {
  const lastAt = useLiveQuery(() => readLastBackupAt(currentDb()), [], undefined)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const exportNow = async () => {
    setBusy('export')
    setNote(null)
    try {
      const at = nowIso()
      const file = await buildBackup(currentDb(), currentUserId(), at)
      downloadBackup(file)
      await recordBackup(currentDb(), at)
      setNote('Backup saved to your downloads.')
    } catch {
      setNote('Needs attention: the backup could not be written. Free some storage and tap Export again.')
    } finally {
      setBusy(null)
    }
  }

  const importFile = async (f: File | undefined) => {
    if (!f) return
    setBusy('import')
    setNote(null)
    try {
      const parsed = parseBackup(await f.text())
      const r: ImportResult = await importBackup(currentDb(), currentUserId(), parsed)
      setNote(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} already here.`)
    } catch (e) {
      setNote(`Needs attention: ${e instanceof Error ? e.message : 'the file could not be read.'} Pick a file exported from Recomp.`)
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const last = lastBackupLine(lastAt ?? null)

  return (
    <Card title="Backup">
      <p className="text-[15px] leading-relaxed text-ink-2">
        Everything you logged, as one JSON file you keep. Import merges a file back by entry, so nothing is doubled.
      </p>
      <p className="num text-[15px] font-semibold text-ink-1">{last.text}</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void exportNow()} className={`${secondaryButtonClass} flex-1`}>
          {busy === 'export' ? 'Exporting' : 'Export'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => fileInput.current?.click()} className={`${secondaryButtonClass} flex-1`}>
          {busy === 'import' ? 'Importing' : 'Import'}
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Choose a backup file" onChange={(e) => void importFile(e.target.files?.[0])} />
      </div>
      {note ? (
        <p role="status" className="num text-[14px] leading-relaxed text-ink-2">
          {note}
        </p>
      ) : null}
    </Card>
  )
}

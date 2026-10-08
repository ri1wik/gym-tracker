import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The release gate greps the repo for these. Checked here for every file in
// this slice so a slip shows up in the slice's own run. The forbidden strings
// are assembled at run time so this file does not trip the grep itself.

const FEATURES = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const FOLDERS = ['onboarding', 'checkin', 'you', 'profile', 'progress']

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const files = FOLDERS.flatMap((f) => walk(join(FEATURES, f)))
const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)]
const words = [['neg', 'ative'], ['fai', 'led'], ['cla', 'ude'], ['anthro', 'pic'], ['open', 'ai'], ['gem', 'ini']].map((p) => p.join(''))

describe('slice hygiene', () => {
  it('finds the slice files', () => {
    expect(files.length).toBeGreaterThan(20)
  })
  it('has no em dash or en dash anywhere', () => {
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      for (const d of dashes) expect(text.includes(d), `${f} holds a dash`).toBe(false)
    }
  })
  it('names no assistant, vendor or judgement word', () => {
    for (const f of files) {
      const text = readFileSync(f, 'utf8').toLowerCase()
      for (const w of words) expect(text.includes(w), `${f} holds ${w}`).toBe(false)
    }
  })
  it('never builds a Date from a day key string or divides milliseconds by a day', () => {
    const msPerDay = ['86', '400', '000'].join('')
    for (const f of files.filter((p) => !p.endsWith('hygiene.test.ts'))) {
      const text = readFileSync(f, 'utf8')
      expect(text.includes(msPerDay), `${f} divides by a day of ms`).toBe(false)
      expect(/new Date\(\s*['"`]\d{4}-\d{2}-\d{2}/.test(text), `${f} parses a day key`).toBe(false)
    }
  })
})

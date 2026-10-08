// Builds public/img from the pinned RepDB free-tier clone. Idempotent.
// Usage: REPDB_DIR=/path/to/repdb node scripts/build-images.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repdb = process.env.REPDB_DIR
  ?? '/private/tmp/claude-501/-Users-ri1wik/f66d976d-970a-42d3-9272-3b9ce4b163c0/scratchpad/repdb/repo'
const COMMIT = 'a360f87'
const DERIVED_PX = 256

const map = JSON.parse(fs.readFileSync(path.join(root, 'scripts/repdb-map.json'), 'utf8'))
const dataset = JSON.parse(fs.readFileSync(path.join(repdb, 'exercises.json'), 'utf8')).exercises
const byId = Object.fromEntries(dataset.map((e) => [e.id, e]))
const exFile = path.join(root, 'src/data/library/exercises.json')
const exercises = JSON.parse(fs.readFileSync(exFile, 'utf8'))

const head = execFileSync('git', ['-C', repdb, 'rev-parse', '--short=7', 'HEAD']).toString().trim()
if (head !== COMMIT) throw new Error(`RepDB clone is at ${head}, expected ${COMMIT}`)

const outEx = path.join(root, 'public/img/ex')
const outEq = path.join(root, 'public/img/eq')
fs.mkdirSync(outEx, { recursive: true })
fs.mkdirSync(outEq, { recursive: true })
fs.copyFileSync(path.join(repdb, 'LICENSE-DATA.md'), path.join(root, 'public/img/LICENSE-REPDB.md'))

const files = []
const manifestBase = { source: 'RepDB free tier (repdb.co)', licence: 'RepDB Free Tier License v1.0', datasetCommit: COMMIT }
function record(file, kind, extra) {
  const abs = path.join(root, 'public', file)
  files.push({ path: file, kind, bytes: fs.statSync(abs).size, ...manifestBase, ...extra })
}

const media = {}
const equipment = new Set()
for (const ex of exercises) {
  const m = map[ex.id]
  if (!m) { ex.media = null; continue }
  const rec = byId[m.repdbId]
  if (!rec) throw new Error(`unknown RepDB id ${m.repdbId} for ${ex.id}`)
  const flat = rec.images?.flat ?? {}
  const startSrc = flat.start ?? flat.main
  const peakSrc = flat.peak ?? flat.main
  if (!startSrc || !peakSrc) throw new Error(`no flat frames for ${m.repdbId}`)
  const dir = path.join(outEx, ex.id)
  fs.mkdirSync(dir, { recursive: true })
  // A main-only exercise has a single frame: start and peak share one file.
  const frames = flat.start && flat.peak ? [['start', startSrc], ['peak', peakSrc]] : [['start', startSrc]]
  for (const [name, src] of frames) {
    const from = path.join(repdb, src)
    const orig = path.join(dir, `${name}.webp`)
    fs.copyFileSync(from, orig)
    const small = path.join(dir, `${name}-${DERIVED_PX}.webp`)
    const meta = await sharp(from).metadata()
    if ((meta.width ?? 0) <= DERIVED_PX) fs.copyFileSync(from, small) // never upscale
    else await sharp(from).resize({ width: DERIVED_PX, withoutEnlargement: true }).webp({ quality: 80 }).toFile(small)
    const base = { exerciseId: ex.id, repdbId: m.repdbId, proxy: m.proxy, sourcePath: src }
    record(`img/ex/${ex.id}/${name}.webp`, 'original-512', base)
    record(`img/ex/${ex.id}/${name}-${DERIVED_PX}.webp`, 'derivative-256', base)
  }
  ex.media = { source: 'repdb', sourceId: m.repdbId, start: `img/ex/${ex.id}/start`, peak: `img/ex/${ex.id}/${frames.length === 2 ? 'peak' : 'start'}` }
  media[ex.id] = ex.media
  if (rec.equipment) equipment.add(rec.equipment)
}

for (const eq of [...equipment].sort()) {
  const name = `${eq.replaceAll('_', '-')}.webp`
  const from = path.join(repdb, 'images/equipment', name)
  if (!fs.existsSync(from)) continue
  fs.copyFileSync(from, path.join(outEq, name))
  record(`img/eq/${name}`, 'equipment-icon-128', { sourcePath: `images/equipment/${name}` })
}

files.sort((a, b) => a.path.localeCompare(b.path))
fs.writeFileSync(exFile, JSON.stringify(exercises, null, 2) + '\n')
fs.writeFileSync(path.join(root, 'src/data/library/media.json'), JSON.stringify(media, null, 2) + '\n')
const total = files.reduce((n, f) => n + f.bytes, 0)
fs.writeFileSync(
  path.join(root, 'docs/media-manifest.json'),
  JSON.stringify({ note: 'Every shipped image. Credit line: Exercise data by RepDB (repdb.co).', licenceFile: 'public/img/LICENSE-REPDB.md', totalBytes: total, files }, null, 2) + '\n',
)
const unmatched = Object.entries(map).filter(([, v]) => !v).map(([k]) => k)
console.log(`exercises with media: ${Object.keys(media).length}, unmatched: ${unmatched.join(', ')}`)
console.log(`files: ${files.length}, total bytes: ${total}`)

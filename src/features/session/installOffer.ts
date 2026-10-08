// When the install card may appear: once, after the first finished workout,
// never in an installed copy, never again after it was shown. The card
// itself also waits for the first workout to have synced (or for guest
// mode, where there is nothing to sync), so an installed copy never opens
// empty (docs/SPEC-critic-fixes.md, first-workout install gap).

import { isStandalone } from '../../app/install'
import { META_KEYS } from '../../data/db'
import { nowIso } from '../../data/sync/clock'
import { finishedWorkouts } from './repo'
import { readMeta, writeMeta } from './write'

export async function installOfferDue(): Promise<boolean> {
  if (isStandalone()) return false
  if (await readMeta<string>(META_KEYS.installPromptSeenAt)) return false
  const finished = await finishedWorkouts(2)
  return finished.length === 1
}

/** Record that the card was shown and answered, so it never shows again. */
export async function markInstallOfferSeen(): Promise<void> {
  await writeMeta(META_KEYS.installPromptSeenAt, nowIso())
}

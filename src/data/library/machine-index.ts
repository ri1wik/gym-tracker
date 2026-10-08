// Structural facts for the machines and stations at a typical Anytime
// Fitness. Ids are stable; exercises point at them through machineId and
// gym profiles list them. Prose (aliases, setup steps, tips) and photos are
// added by the content-machines and images builders in machines.json.
//
// This file uses explicit .ts import extensions so Node can load it directly
// (scripts/validate-library.mjs runs it without a build step).

import type { MachineIndexEntry } from '../../domain/types.ts'

export const MACHINE_INDEX: readonly MachineIndexEntry[] = [
  // Plate-loaded
  { id: 'plate-loaded-chest-press', name: 'Plate-loaded chest press', category: 'plate-loaded' },
  { id: 'plate-loaded-incline-press', name: 'Plate-loaded incline press', category: 'plate-loaded' },
  { id: 'plate-loaded-iso-lateral-row', name: 'Plate-loaded iso-lateral row', category: 'plate-loaded' },
  { id: 'plate-loaded-high-row', name: 'Plate-loaded high row', category: 'plate-loaded' },
  { id: 'plate-loaded-shoulder-press', name: 'Plate-loaded shoulder press', category: 'plate-loaded' },
  { id: 'leg-press', name: 'Leg press', category: 'plate-loaded' },
  { id: 'hack-squat', name: 'Hack squat', category: 'plate-loaded' },
  { id: 'hip-thrust-machine', name: 'Hip thrust machine', category: 'plate-loaded' },

  // Selectorised (pin stack)
  { id: 'chest-press-machine', name: 'Seated chest press machine', category: 'selectorised' },
  { id: 'pec-deck', name: 'Pec deck', category: 'selectorised' },
  { id: 'lat-pulldown', name: 'Lat pulldown', category: 'selectorised' },
  { id: 'seated-row-machine', name: 'Seated row machine', category: 'selectorised' },
  { id: 'shoulder-press-machine', name: 'Shoulder press machine', category: 'selectorised' },
  { id: 'lateral-raise-machine', name: 'Lateral raise machine', category: 'selectorised' },
  { id: 'leg-extension', name: 'Leg extension', category: 'selectorised' },
  { id: 'seated-leg-curl', name: 'Seated leg curl', category: 'selectorised' },
  { id: 'lying-leg-curl', name: 'Lying leg curl', category: 'selectorised' },
  { id: 'hip-abductor-machine', name: 'Hip abductor machine', category: 'selectorised' },
  { id: 'hip-adductor-machine', name: 'Hip adductor machine', category: 'selectorised' },
  { id: 'standing-calf-raise', name: 'Standing calf raise', category: 'selectorised' },
  { id: 'seated-calf-raise', name: 'Seated calf raise', category: 'selectorised' },
  { id: 'preacher-curl-machine', name: 'Preacher curl machine', category: 'selectorised' },
  { id: 'triceps-extension-machine', name: 'Triceps extension machine', category: 'selectorised' },
  { id: 'assisted-pull-up-dip', name: 'Assisted pull-up and dip machine', category: 'selectorised' },
  { id: 'ab-crunch-machine', name: 'Ab crunch machine', category: 'selectorised' },

  // Cable
  { id: 'cable-crossover', name: 'Cable crossover', category: 'cable' },
  { id: 'cable-station', name: 'Adjustable cable station', category: 'cable' },

  // Free weight stations
  { id: 'smith-machine', name: 'Smith machine', category: 'free-weight' },
  { id: 'dumbbell-rack', name: 'Dumbbell rack', category: 'free-weight' },
  { id: 'flat-bench', name: 'Flat bench', category: 'free-weight' },
  { id: 'incline-bench', name: 'Incline bench', category: 'free-weight' },
  { id: 'adjustable-bench', name: 'Adjustable bench', category: 'free-weight' },
  { id: 'squat-rack', name: 'Squat rack', category: 'free-weight' },
  { id: 'olympic-barbell', name: 'Olympic barbell', category: 'free-weight' },
  { id: 'ez-bar', name: 'EZ curl bar', category: 'free-weight' },
  { id: 'trap-bar', name: 'Trap bar', category: 'free-weight' },

  // Bodyweight stations
  { id: 'pull-up-bar', name: 'Pull-up bar', category: 'bodyweight' },
  { id: 'dip-station', name: 'Dip station', category: 'bodyweight' },
  { id: 'back-extension-bench', name: 'Back extension bench', category: 'bodyweight' },

  // Cardio
  { id: 'treadmill', name: 'Treadmill', category: 'cardio' },
  { id: 'incline-treadmill', name: 'Incline treadmill', category: 'cardio' },
  { id: 'stair-climber', name: 'Stair climber', category: 'cardio' },
  { id: 'bike', name: 'Upright bike', category: 'cardio' },
  { id: 'rower', name: 'Rowing machine', category: 'cardio' },
  { id: 'elliptical', name: 'Elliptical', category: 'cardio' },
]

export const MACHINE_IDS: readonly string[] = MACHINE_INDEX.map((m) => m.id)

export const MACHINES_BY_ID: Readonly<Record<string, MachineIndexEntry>> = Object.fromEntries(
  MACHINE_INDEX.map((m) => [m.id, m]),
)

/** The seeded "Anytime Fitness (typical)" gym profile: every machine in the index. */
export const DEFAULT_GYM_MACHINE_IDS: readonly string[] = MACHINE_IDS

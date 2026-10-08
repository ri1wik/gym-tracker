// Structural facts for exactly 85 exercises across the 11 body parts. This
// is the id list every other builder uses. Prose fields (aliases, cue,
// how-to, mistakes, rep ranges, increments, media) are added by the
// content-exercises builder in exercises.json and must not change anything
// written here.
//
// Secondary audit (PLAN.md 3.1 and docs/SPEC-review-and-screens.md): at most
// two secondaries; the back squat does not credit hamstrings; the overhead
// press does not credit upper chest; the trap bar deadlift carries two.
//
// This file uses explicit .ts import extensions so Node can load it directly
// (scripts/validate-library.mjs runs it without a build step).

import type { BarType, Equipment, ExerciseIndexEntry, LoadType, MovementPattern, Muscle, BodyPart } from '../../domain/types.ts'
import { EQUIPMENT_FAMILY_OF } from '../../domain/types.ts'

interface Spec {
  id: string
  name: string
  part: BodyPart
  primary: Muscle[]
  secondary?: Muscle[]
  equipment: Equipment
  pattern: MovementPattern
  load?: LoadType
  compound?: boolean
  unilateral?: boolean
  bar?: BarType
  machine?: string
  priority?: boolean
}

function ex(s: Spec): ExerciseIndexEntry {
  const entry: ExerciseIndexEntry = {
    id: s.id,
    name: s.name,
    bodyPart: s.part,
    primaryMuscles: s.primary,
    secondaryMuscles: s.secondary ?? [],
    equipment: s.equipment,
    equipmentFamily: EQUIPMENT_FAMILY_OF[s.equipment],
    movementPattern: s.pattern,
    loadType: s.load ?? 'weight',
    isCompound: s.compound ?? false,
    isUnilateral: s.unilateral ?? false,
    isRecompPriority: s.priority ?? false,
  }
  if (s.bar) entry.barType = s.bar
  if (s.machine) entry.machineId = s.machine
  return entry
}

export const EXERCISE_INDEX: readonly ExerciseIndexEntry[] = [
  // ---------------------------------------------------------------- chest (10)
  ex({ id: 'barbell-bench-press', name: 'Barbell bench press', part: 'chest', primary: ['chest'], secondary: ['front_delts', 'triceps'], equipment: 'barbell', pattern: 'horizontal_push', compound: true, bar: 'olympic', machine: 'flat-bench', priority: true }),
  ex({ id: 'incline-barbell-bench-press', name: 'Incline barbell bench press', part: 'chest', primary: ['upper_chest'], secondary: ['front_delts', 'triceps'], equipment: 'barbell', pattern: 'incline_push', compound: true, bar: 'olympic', machine: 'incline-bench', priority: true }),
  ex({ id: 'dumbbell-bench-press', name: 'Dumbbell bench press', part: 'chest', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: 'dumbbell', pattern: 'horizontal_push', compound: true, machine: 'flat-bench' }),
  ex({ id: 'incline-dumbbell-press', name: 'Incline dumbbell press', part: 'chest', primary: ['upper_chest'], secondary: ['front_delts', 'triceps'], equipment: 'dumbbell', pattern: 'incline_push', compound: true, machine: 'adjustable-bench', priority: true }),
  ex({ id: 'machine-chest-press', name: 'Machine chest press', part: 'chest', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: 'selectorised_machine', pattern: 'horizontal_push', compound: true, machine: 'chest-press-machine' }),
  ex({ id: 'plate-loaded-chest-press', name: 'Plate-loaded chest press', part: 'chest', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: 'plate_loaded_machine', pattern: 'horizontal_push', compound: true, machine: 'plate-loaded-chest-press' }),
  ex({ id: 'plate-loaded-incline-press', name: 'Plate-loaded incline press', part: 'chest', primary: ['upper_chest'], secondary: ['front_delts', 'triceps'], equipment: 'plate_loaded_machine', pattern: 'incline_push', compound: true, machine: 'plate-loaded-incline-press' }),
  ex({ id: 'pec-deck', name: 'Pec deck', part: 'chest', primary: ['chest'], secondary: ['front_delts'], equipment: 'selectorised_machine', pattern: 'fly', machine: 'pec-deck' }),
  ex({ id: 'cable-crossover', name: 'Cable crossover', part: 'chest', primary: ['chest'], secondary: ['front_delts'], equipment: 'cable', pattern: 'fly', machine: 'cable-crossover' }),
  ex({ id: 'push-up', name: 'Push-up', part: 'chest', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: 'bodyweight', pattern: 'horizontal_push', load: 'bodyweight', compound: true }),

  // ----------------------------------------------------------------- back (14)
  ex({ id: 'barbell-row', name: 'Barbell row', part: 'back', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], equipment: 'barbell', pattern: 'horizontal_pull', compound: true, bar: 'olympic', machine: 'olympic-barbell', priority: true }),
  ex({ id: 'deadlift', name: 'Deadlift', part: 'back', primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'upper_back'], equipment: 'barbell', pattern: 'hinge', compound: true, bar: 'olympic', machine: 'olympic-barbell', priority: true }),
  ex({ id: 'trap-bar-deadlift', name: 'Trap bar deadlift', part: 'back', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'upper_back'], equipment: 'trap_bar', pattern: 'hinge', compound: true, bar: 'olympic', machine: 'trap-bar' }),
  ex({ id: 'pull-up', name: 'Pull-up', part: 'back', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: 'bodyweight', pattern: 'vertical_pull', load: 'bodyweight', compound: true, machine: 'pull-up-bar' }),
  ex({ id: 'assisted-pull-up', name: 'Assisted pull-up', part: 'back', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: 'selectorised_machine', pattern: 'vertical_pull', load: 'assisted', compound: true, machine: 'assisted-pull-up-dip' }),
  ex({ id: 'lat-pulldown', name: 'Lat pulldown', part: 'back', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: 'selectorised_machine', pattern: 'vertical_pull', compound: true, machine: 'lat-pulldown', priority: true }),
  ex({ id: 'seated-cable-row', name: 'Seated cable row', part: 'back', primary: ['upper_back'], secondary: ['lats', 'biceps'], equipment: 'cable', pattern: 'horizontal_pull', compound: true, machine: 'cable-station' }),
  ex({ id: 'single-arm-cable-row', name: 'Single-arm cable row', part: 'back', primary: ['upper_back'], secondary: ['lats', 'biceps'], equipment: 'cable', pattern: 'horizontal_pull', compound: true, unilateral: true, machine: 'cable-station' }),
  ex({ id: 'chest-supported-machine-row', name: 'Chest-supported machine row', part: 'back', primary: ['upper_back'], secondary: ['lats', 'biceps'], equipment: 'selectorised_machine', pattern: 'horizontal_pull', compound: true, machine: 'seated-row-machine' }),
  ex({ id: 'plate-loaded-iso-lateral-row', name: 'Plate-loaded iso-lateral row', part: 'back', primary: ['lats'], secondary: ['upper_back', 'biceps'], equipment: 'plate_loaded_machine', pattern: 'horizontal_pull', compound: true, machine: 'plate-loaded-iso-lateral-row' }),
  ex({ id: 'plate-loaded-high-row', name: 'Plate-loaded high row', part: 'back', primary: ['lats'], secondary: ['upper_back', 'biceps'], equipment: 'plate_loaded_machine', pattern: 'vertical_pull', compound: true, machine: 'plate-loaded-high-row' }),
  ex({ id: 'dumbbell-row', name: 'Dumbbell row', part: 'back', primary: ['lats'], secondary: ['upper_back', 'biceps'], equipment: 'dumbbell', pattern: 'horizontal_pull', compound: true, unilateral: true, machine: 'flat-bench' }),
  ex({ id: 'straight-arm-pulldown', name: 'Straight-arm pulldown', part: 'back', primary: ['lats'], secondary: [], equipment: 'cable', pattern: 'pullover', machine: 'cable-station' }),
  ex({ id: 'back-extension', name: 'Back extension', part: 'back', primary: ['lower_back'], secondary: ['glutes', 'hamstrings'], equipment: 'bodyweight', pattern: 'hinge', load: 'bodyweight', machine: 'back-extension-bench' }),

  // ------------------------------------------------------------- shoulders (9)
  ex({ id: 'overhead-press', name: 'Overhead press', part: 'shoulders', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: 'barbell', pattern: 'vertical_push', compound: true, bar: 'olympic', machine: 'squat-rack', priority: true }),
  ex({ id: 'seated-dumbbell-shoulder-press', name: 'Seated dumbbell shoulder press', part: 'shoulders', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: 'dumbbell', pattern: 'vertical_push', compound: true, machine: 'adjustable-bench' }),
  ex({ id: 'machine-shoulder-press', name: 'Machine shoulder press', part: 'shoulders', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: 'selectorised_machine', pattern: 'vertical_push', compound: true, machine: 'shoulder-press-machine' }),
  ex({ id: 'plate-loaded-shoulder-press', name: 'Plate-loaded shoulder press', part: 'shoulders', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: 'plate_loaded_machine', pattern: 'vertical_push', compound: true, machine: 'plate-loaded-shoulder-press' }),
  ex({ id: 'dumbbell-lateral-raise', name: 'Dumbbell lateral raise', part: 'shoulders', primary: ['side_delts'], secondary: [], equipment: 'dumbbell', pattern: 'lateral_raise', machine: 'dumbbell-rack', priority: true }),
  ex({ id: 'cable-lateral-raise', name: 'Cable lateral raise', part: 'shoulders', primary: ['side_delts'], secondary: [], equipment: 'cable', pattern: 'lateral_raise', unilateral: true, machine: 'cable-station' }),
  ex({ id: 'machine-lateral-raise', name: 'Machine lateral raise', part: 'shoulders', primary: ['side_delts'], secondary: [], equipment: 'selectorised_machine', pattern: 'lateral_raise', machine: 'lateral-raise-machine' }),
  ex({ id: 'reverse-pec-deck', name: 'Reverse pec deck', part: 'shoulders', primary: ['rear_delts'], secondary: ['upper_back'], equipment: 'selectorised_machine', pattern: 'rear_delt', machine: 'pec-deck' }),
  ex({ id: 'face-pull', name: 'Face pull', part: 'shoulders', primary: ['rear_delts'], secondary: ['upper_back', 'rotator_cuff'], equipment: 'cable', pattern: 'rear_delt', machine: 'cable-station', priority: true }),

  // ---------------------------------------------------------------- biceps (7)
  ex({ id: 'barbell-curl', name: 'Barbell curl', part: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: 'barbell', pattern: 'elbow_flexion', bar: 'olympic', machine: 'olympic-barbell', priority: true }),
  ex({ id: 'ez-bar-curl', name: 'EZ bar curl', part: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: 'ez_bar', pattern: 'elbow_flexion', bar: 'ez', machine: 'ez-bar' }),
  ex({ id: 'dumbbell-curl', name: 'Dumbbell curl', part: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', pattern: 'elbow_flexion', machine: 'dumbbell-rack' }),
  ex({ id: 'hammer-curl', name: 'Hammer curl', part: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', pattern: 'elbow_flexion', machine: 'dumbbell-rack', priority: true }),
  ex({ id: 'incline-dumbbell-curl', name: 'Incline dumbbell curl', part: 'biceps', primary: ['biceps'], secondary: [], equipment: 'dumbbell', pattern: 'elbow_flexion', machine: 'adjustable-bench' }),
  ex({ id: 'machine-preacher-curl', name: 'Machine preacher curl', part: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: 'selectorised_machine', pattern: 'elbow_flexion', machine: 'preacher-curl-machine' }),
  ex({ id: 'cable-curl', name: 'Cable curl', part: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: 'cable', pattern: 'elbow_flexion', machine: 'cable-station' }),

  // --------------------------------------------------------------- triceps (7)
  ex({ id: 'cable-pushdown', name: 'Cable pushdown', part: 'triceps', primary: ['triceps'], secondary: [], equipment: 'cable', pattern: 'elbow_extension', machine: 'cable-station', priority: true }),
  ex({ id: 'overhead-cable-extension', name: 'Overhead cable extension', part: 'triceps', primary: ['triceps'], secondary: [], equipment: 'cable', pattern: 'elbow_extension', machine: 'cable-station', priority: true }),
  ex({ id: 'skull-crusher', name: 'Skull crusher', part: 'triceps', primary: ['triceps'], secondary: [], equipment: 'ez_bar', pattern: 'elbow_extension', bar: 'ez', machine: 'flat-bench' }),
  ex({ id: 'dip', name: 'Dip', part: 'triceps', primary: ['triceps'], secondary: ['chest', 'front_delts'], equipment: 'bodyweight', pattern: 'horizontal_push', load: 'bodyweight', compound: true, machine: 'dip-station' }),
  ex({ id: 'assisted-dip', name: 'Assisted dip', part: 'triceps', primary: ['triceps'], secondary: ['chest', 'front_delts'], equipment: 'selectorised_machine', pattern: 'horizontal_push', load: 'assisted', compound: true, machine: 'assisted-pull-up-dip' }),
  ex({ id: 'machine-triceps-extension', name: 'Machine triceps extension', part: 'triceps', primary: ['triceps'], secondary: [], equipment: 'selectorised_machine', pattern: 'elbow_extension', machine: 'triceps-extension-machine' }),
  ex({ id: 'close-grip-bench-press', name: 'Close-grip bench press', part: 'triceps', primary: ['triceps'], secondary: ['chest', 'front_delts'], equipment: 'barbell', pattern: 'horizontal_push', compound: true, bar: 'olympic', machine: 'flat-bench' }),

  // -------------------------------------------------------------- forearms (3)
  ex({ id: 'dumbbell-wrist-curl', name: 'Dumbbell wrist curl', part: 'forearms', primary: ['forearms'], secondary: [], equipment: 'dumbbell', pattern: 'wrist_flexion', machine: 'flat-bench' }),
  ex({ id: 'reverse-curl', name: 'Reverse curl', part: 'forearms', primary: ['forearms'], secondary: ['biceps'], equipment: 'ez_bar', pattern: 'elbow_flexion', bar: 'ez', machine: 'ez-bar', priority: true }),
  ex({ id: 'farmers-walk', name: "Farmer's walk", part: 'forearms', primary: ['forearms'], secondary: ['traps', 'abs'], equipment: 'dumbbell', pattern: 'carry', compound: true, machine: 'dumbbell-rack', priority: true }),

  // ---------------------------------------------------------------- quads (10)
  ex({ id: 'back-squat', name: 'Back squat', part: 'quads', primary: ['quads'], secondary: ['glutes', 'adductors'], equipment: 'barbell', pattern: 'squat', compound: true, bar: 'olympic', machine: 'squat-rack', priority: true }),
  ex({ id: 'front-squat', name: 'Front squat', part: 'quads', primary: ['quads'], secondary: ['glutes', 'abs'], equipment: 'barbell', pattern: 'squat', compound: true, bar: 'olympic', machine: 'squat-rack' }),
  ex({ id: 'leg-press', name: 'Leg press', part: 'quads', primary: ['quads'], secondary: ['glutes', 'adductors'], equipment: 'plate_loaded_machine', pattern: 'squat', compound: true, machine: 'leg-press', priority: true }),
  ex({ id: 'hack-squat', name: 'Hack squat', part: 'quads', primary: ['quads'], secondary: ['glutes'], equipment: 'plate_loaded_machine', pattern: 'squat', compound: true, machine: 'hack-squat' }),
  ex({ id: 'smith-machine-squat', name: 'Smith machine squat', part: 'quads', primary: ['quads'], secondary: ['glutes', 'adductors'], equipment: 'smith_machine', pattern: 'squat', compound: true, machine: 'smith-machine' }),
  ex({ id: 'leg-extension', name: 'Leg extension', part: 'quads', primary: ['quads'], secondary: [], equipment: 'selectorised_machine', pattern: 'knee_extension', machine: 'leg-extension', priority: true }),
  ex({ id: 'bulgarian-split-squat', name: 'Bulgarian split squat', part: 'quads', primary: ['quads'], secondary: ['glutes', 'hamstrings'], equipment: 'dumbbell', pattern: 'lunge', compound: true, unilateral: true, machine: 'adjustable-bench' }),
  ex({ id: 'walking-lunge', name: 'Walking lunge', part: 'quads', primary: ['quads'], secondary: ['glutes', 'hamstrings'], equipment: 'dumbbell', pattern: 'lunge', compound: true, unilateral: true, machine: 'dumbbell-rack' }),
  ex({ id: 'goblet-squat', name: 'Goblet squat', part: 'quads', primary: ['quads'], secondary: ['glutes', 'abs'], equipment: 'dumbbell', pattern: 'squat', compound: true, machine: 'dumbbell-rack' }),
  ex({ id: 'step-up', name: 'Step-up', part: 'quads', primary: ['quads'], secondary: ['glutes'], equipment: 'dumbbell', pattern: 'lunge', compound: true, unilateral: true, machine: 'flat-bench' }),

  // ------------------------------------------------------------ hamstrings (7)
  ex({ id: 'romanian-deadlift', name: 'Romanian deadlift', part: 'hamstrings', primary: ['hamstrings'], secondary: ['glutes', 'lower_back'], equipment: 'barbell', pattern: 'hinge', compound: true, bar: 'olympic', machine: 'olympic-barbell', priority: true }),
  ex({ id: 'dumbbell-romanian-deadlift', name: 'Dumbbell Romanian deadlift', part: 'hamstrings', primary: ['hamstrings'], secondary: ['glutes', 'lower_back'], equipment: 'dumbbell', pattern: 'hinge', compound: true, machine: 'dumbbell-rack' }),
  ex({ id: 'single-leg-romanian-deadlift', name: 'Single-leg Romanian deadlift', part: 'hamstrings', primary: ['hamstrings'], secondary: ['glutes'], equipment: 'dumbbell', pattern: 'hinge', compound: true, unilateral: true, machine: 'dumbbell-rack' }),
  ex({ id: 'seated-leg-curl', name: 'Seated leg curl', part: 'hamstrings', primary: ['hamstrings'], secondary: [], equipment: 'selectorised_machine', pattern: 'knee_flexion', machine: 'seated-leg-curl', priority: true }),
  ex({ id: 'lying-leg-curl', name: 'Lying leg curl', part: 'hamstrings', primary: ['hamstrings'], secondary: [], equipment: 'selectorised_machine', pattern: 'knee_flexion', machine: 'lying-leg-curl' }),
  ex({ id: 'good-morning', name: 'Good morning', part: 'hamstrings', primary: ['hamstrings'], secondary: ['glutes', 'lower_back'], equipment: 'barbell', pattern: 'hinge', compound: true, bar: 'olympic', machine: 'squat-rack' }),
  ex({ id: 'nordic-hamstring-curl', name: 'Nordic hamstring curl', part: 'hamstrings', primary: ['hamstrings'], secondary: [], equipment: 'bodyweight', pattern: 'knee_flexion', load: 'bodyweight' }),

  // ---------------------------------------------------------------- glutes (7)
  ex({ id: 'barbell-hip-thrust', name: 'Barbell hip thrust', part: 'glutes', primary: ['glutes'], secondary: ['hamstrings'], equipment: 'barbell', pattern: 'hip_thrust', compound: true, bar: 'olympic', machine: 'flat-bench', priority: true }),
  ex({ id: 'machine-hip-thrust', name: 'Machine hip thrust', part: 'glutes', primary: ['glutes'], secondary: ['hamstrings'], equipment: 'plate_loaded_machine', pattern: 'hip_thrust', compound: true, machine: 'hip-thrust-machine', priority: true }),
  ex({ id: 'glute-bridge', name: 'Glute bridge', part: 'glutes', primary: ['glutes'], secondary: ['hamstrings'], equipment: 'bodyweight', pattern: 'hip_thrust', load: 'bodyweight' }),
  ex({ id: 'cable-kickback', name: 'Cable kickback', part: 'glutes', primary: ['glutes'], secondary: ['hamstrings'], equipment: 'cable', pattern: 'hinge', unilateral: true, machine: 'cable-station' }),
  ex({ id: 'hip-abduction-machine', name: 'Hip abduction machine', part: 'glutes', primary: ['abductors'], secondary: ['glutes'], equipment: 'selectorised_machine', pattern: 'hip_abduction', machine: 'hip-abductor-machine' }),
  ex({ id: 'hip-adduction-machine', name: 'Hip adduction machine', part: 'glutes', primary: ['adductors'], secondary: [], equipment: 'selectorised_machine', pattern: 'hip_adduction', machine: 'hip-adductor-machine' }),
  ex({ id: 'cable-pull-through', name: 'Cable pull-through', part: 'glutes', primary: ['glutes'], secondary: ['hamstrings'], equipment: 'cable', pattern: 'hinge', machine: 'cable-station' }),

  // ---------------------------------------------------------------- calves (4)
  ex({ id: 'standing-calf-raise', name: 'Standing calf raise', part: 'calves', primary: ['calves'], secondary: [], equipment: 'selectorised_machine', pattern: 'calf', machine: 'standing-calf-raise', priority: true }),
  ex({ id: 'seated-calf-raise', name: 'Seated calf raise', part: 'calves', primary: ['calves'], secondary: [], equipment: 'selectorised_machine', pattern: 'calf', machine: 'seated-calf-raise', priority: true }),
  ex({ id: 'leg-press-calf-raise', name: 'Leg press calf raise', part: 'calves', primary: ['calves'], secondary: [], equipment: 'plate_loaded_machine', pattern: 'calf', machine: 'leg-press' }),
  ex({ id: 'single-leg-dumbbell-calf-raise', name: 'Single-leg dumbbell calf raise', part: 'calves', primary: ['calves'], secondary: [], equipment: 'dumbbell', pattern: 'calf', unilateral: true, machine: 'dumbbell-rack' }),

  // ------------------------------------------------------------------ core (7)
  ex({ id: 'plank', name: 'Plank', part: 'core', primary: ['abs'], secondary: [], equipment: 'bodyweight', pattern: 'anti_extension', load: 'time', priority: true }),
  ex({ id: 'hanging-knee-raise', name: 'Hanging knee raise', part: 'core', primary: ['abs'], secondary: ['hip_flexors'], equipment: 'bodyweight', pattern: 'trunk_flexion', load: 'bodyweight', machine: 'pull-up-bar', priority: true }),
  ex({ id: 'cable-crunch', name: 'Cable crunch', part: 'core', primary: ['abs'], secondary: [], equipment: 'cable', pattern: 'trunk_flexion', machine: 'cable-station', priority: true }),
  ex({ id: 'ab-crunch-machine', name: 'Ab crunch machine', part: 'core', primary: ['abs'], secondary: [], equipment: 'selectorised_machine', pattern: 'trunk_flexion', machine: 'ab-crunch-machine' }),
  ex({ id: 'ab-wheel-rollout', name: 'Ab wheel rollout', part: 'core', primary: ['abs'], secondary: ['lats'], equipment: 'bodyweight', pattern: 'anti_extension', load: 'bodyweight' }),
  ex({ id: 'pallof-press', name: 'Pallof press', part: 'core', primary: ['abs'], secondary: [], equipment: 'cable', pattern: 'anti_rotation', unilateral: true, machine: 'cable-station' }),
  ex({ id: 'reverse-crunch', name: 'Reverse crunch', part: 'core', primary: ['abs'], secondary: ['hip_flexors'], equipment: 'bodyweight', pattern: 'trunk_flexion', load: 'bodyweight' }),
]

export const EXERCISE_COUNT = 85

export const EXERCISE_IDS: readonly string[] = EXERCISE_INDEX.map((e) => e.id)

export const EXERCISES_BY_ID: Readonly<Record<string, ExerciseIndexEntry>> = Object.fromEntries(
  EXERCISE_INDEX.map((e) => [e.id, e]),
)

/** The key lifts (first compound of each PPL template day) by exercise id. */
export const KEY_LIFT_IDS: readonly string[] = ['barbell-bench-press', 'barbell-row', 'back-squat', 'overhead-press', 'deadlift', 'romanian-deadlift']

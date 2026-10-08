// Types for the Node validator so Vitest files can import it under typecheck.

export interface Vocab {
  bodyParts: Set<string>
  muscles: Set<string>
  patterns: Set<string>
  equipment: Set<string>
  families: Set<string>
  familyOf: Record<string, string>
  loadTypes: Set<string>
  barTypes: Set<string>
  machineCategories: Set<string>
  splits: Set<string>
  exerciseIndex: readonly object[]
  exerciseCount: number
  machineIndex: readonly object[]
}

export const LIBRARY_DIR: string
export function loadVocab(): Promise<Vocab>
export function validateIndex(vocab: Vocab): string[]
export function validateExercisesJson(rows: unknown, vocab: Vocab, text: string): string[]
export function validateMachinesJson(rows: unknown, vocab: Vocab, text: string): string[]
export function validateTemplatesJson(rows: unknown, vocab: Vocab, text: string): string[]
export function validateLibrary(dir?: string): Promise<{ errors: string[]; found: string[] }>

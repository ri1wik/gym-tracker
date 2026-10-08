// Which user and which local database this slice reads and writes.
// The sync layer owns the answer; this file only re-exports it so every
// screen in the slice keeps its one import path.

export { currentDb, currentUserId } from '../../data/sync/current'

export type TabKey = 'home' | 'train' | 'food' | 'progress' | 'you'

const PATHS: Record<TabKey, string> = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  train: 'M3 10v4M6 8v8M9 11h6M18 8v8M21 10v4M6 12h3M15 12h3',
  food: 'M7 3v8a3 3 0 0 0 3 3v7M10 3v8M4 3v8M18 3c-2 0-3 2-3 5v3h3v10',
  progress: 'M4 19h16M6 15l4-5 4 3 5-7',
  you: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
}

export function TabIcon({ name }: { name: TabKey }) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

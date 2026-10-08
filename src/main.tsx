import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { App } from './App'
import { applyStoredTheme } from './app/theme'
import { bootAuth } from './app/auth/session'
import { captureInstallPrompt } from './app/install'
import { startSyncTriggers, syncNow } from './data/sync/engine'

// Boot order: theme first (no flash), then the session (the PKCE code
// exchange and the ?code= strip must finish before the hash router reads
// the URL), then the sync triggers, then React. bootAuth never rejects and
// finishes at once in guest mode, so a build with no backend opens as fast
// as before.

applyStoredTheme()
captureInstallPrompt()

const root = createRoot(document.getElementById('root')!)

void bootAuth().finally(() => {
  startSyncTriggers()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  void syncNow('boot')
})

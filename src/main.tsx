import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { pwaStatusStore, startNetworkStatusTracking } from './pwaStatus'
import './styles.css'

startNetworkStatusTracking()

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady: () => pwaStatusStore.markOfflineReady(),
  onNeedRefresh: () => pwaStatusStore.markUpdateAvailable(),
  onRegisterError: () => pwaStatusStore.markRegistrationError()
})
pwaStatusStore.setUpdateHandler(() => updateServiceWorker(true))

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.ready
    .then(() => pwaStatusStore.markOfflineReady())
    .catch(() => pwaStatusStore.markRegistrationError())
} else {
  pwaStatusStore.markRegistrationError()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)

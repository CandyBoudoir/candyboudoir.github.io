// Hooks every piece uses to read the plugin's state.
import { store } from '../runtime/app.js'
import { useStoreValue } from '../runtime/store.js'
import { reasonDisplayOf } from '../storage/settings.js'

export const useAppState = (select) => useStoreValue(store, select)
export const useSettings = () => useStoreValue(store, (s) => s.settings)
export const useModel = () => useStoreValue(store, (s) => s.M)
export const useWatching = () => useStoreValue(store, (s) => s.watching)
// Reasons on cards: 'text', 'icon' or 'off'
export const useReasonDisplay = () =>
  useStoreValue(store, (s) => reasonDisplayOf(s.settings.reasonDisplay))

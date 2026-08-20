import { getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'

type Translate = (key: string) => string

/** Shared controls can be mounted without the app i18n plugin in isolated tests. */
export function useUiT(): Translate {
  if (!getCurrentInstance()) return (key) => key
  try {
    const { t } = useI18n({ useScope: 'global' })
    return (key) => String(t(key))
  } catch {
    return (key) => key
  }
}

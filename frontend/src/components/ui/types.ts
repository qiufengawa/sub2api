/** Shared control density. `compact` remains as a migration alias for callers on the old API. */
export type UiDensity = 'mini' | 'dense' | 'compact' | 'default' | 'large'
export type UiIntent = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type UiButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export interface UiChoiceOption {
  label: string
  value: string | number
  disabled?: boolean
  description?: string
  dataTest?: string
  title?: string
}

export const densityHeight: Record<UiDensity, string> = {
  mini: '24px',
  dense: '28px',
  compact: '32px',
  default: '36px',
  large: '40px'
}

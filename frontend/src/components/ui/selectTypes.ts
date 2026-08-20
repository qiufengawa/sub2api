export type SelectValue = string | number | boolean | null

export interface SelectOption {
  value: SelectValue
  label: string
  disabled?: boolean
  description?: string
  /** Keep semantic options such as "none" visible while searching. */
  alwaysVisible?: boolean
  kind?: string
  [key: string]: unknown
}

export type SelectOptionLike = SelectOption | Record<string, unknown> | SelectValue

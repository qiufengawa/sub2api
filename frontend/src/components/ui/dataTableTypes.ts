/** Shared table column contract used by the UI table core and legacy adapters. */

export interface Column {
  key: string
  label: string
  sortable?: boolean
  class?: string
  formatter?: (value: any, row: any) => string
}

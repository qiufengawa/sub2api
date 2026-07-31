interface DialogStackEntry {
  id: symbol
  zIndex: number
}

const dialogStack: DialogStackEntry[] = []

function syncBodyLock() {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('modal-open', dialogStack.length > 0)
}

export function registerDialog(id: symbol, requestedZIndex = 50): number {
  const existing = dialogStack.find((entry) => entry.id === id)
  if (existing) return existing.zIndex

  const topDialog = dialogStack[dialogStack.length - 1]
  const zIndex = topDialog
    ? Math.max(requestedZIndex, topDialog.zIndex + 2)
    : requestedZIndex

  dialogStack.push({ id, zIndex })
  syncBodyLock()
  return zIndex
}

export function unregisterDialog(id: symbol): boolean {
  const index = dialogStack.findIndex((entry) => entry.id === id)
  const wasTopDialog = index === dialogStack.length - 1
  if (index >= 0) dialogStack.splice(index, 1)
  syncBodyLock()
  return wasTopDialog
}

export function isTopDialog(id: symbol): boolean {
  return dialogStack[dialogStack.length - 1]?.id === id
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export function isOverdue(dueDateStr, status) {
  if (!dueDateStr) return false
  if (status === 'Completed' || status === 'Unable to Complete') return false
  const due  = new Date(dueDateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function toInputDate(isoOrDate) {
  if (!isoOrDate) return ''
  return String(isoOrDate).slice(0, 10)
}

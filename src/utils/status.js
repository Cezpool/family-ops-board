export const ALL_STATUSES = [
  'Not Started',
  'In Progress',
  'Waiting',
  'Question',
  'Completed',
  'Incomplete',
  'Unable to Complete',
]

export function statusClass(status) {
  const map = {
    'Not Started':        'status-not-started',
    'In Progress':        'status-in-progress',
    'Waiting':            'status-waiting',
    'Question':           'status-question',
    'Completed':          'status-completed',
    'Incomplete':         'status-incomplete',
    'Unable to Complete': 'status-unable',
  }
  return map[status] || 'status-not-started'
}

export function statusLabel(status) {
  return status || 'Not Started'
}

export function statusDot(status) {
  const map = {
    'Not Started':        '○',
    'In Progress':        '◑',
    'Waiting':            '◔',
    'Question':           '?',
    'Completed':          '●',
    'Incomplete':         '✕',
    'Unable to Complete': '⊘',
  }
  return map[status] || '○'
}

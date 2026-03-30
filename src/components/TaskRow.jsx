import { statusClass, statusLabel } from '../utils/status'
import { formatDate, isOverdue } from '../utils/dates'
import './TaskRow.css'

export default function TaskRow({ task, me, onClick }) {
  const overdue   = isOverdue(task.due_date, me?.status)
  const completed = me?.status === 'Completed'

  const participants = task.task_participants || []
  const names = participants
    .map(p => p.profile?.display_name)
    .filter(Boolean)

  return (
    <button
      className={[
        'task-row',
        overdue   ? 'task-row--overdue'   : '',
        completed ? 'task-row--completed' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="task-row-left">
        <div className="task-row-title-wrap">
          <span className="task-row-title">{task.title}</span>

          {overdue && !completed && (
            <span className="task-badge overdue-badge">Overdue</span>
          )}
        </div>

        <span className="task-row-dates">
          {task.assigned_date && (
            <span>Assigned {formatDate(task.assigned_date)}</span>
          )}

          {task.due_date && (
            <span className={overdue ? 'date-overdue' : ''}>
              Due {formatDate(task.due_date)}
            </span>
          )}

          {me?.date_completed && (
            <span className="date-done">
              Done {formatDate(me.date_completed)}
            </span>
          )}
        </span>

        <span className="task-row-participants">
          {names.length <= 3
            ? names.join(', ')
            : `${names.slice(0, 2).join(', ')} +${names.length - 2}`}
        </span>
      </div>

      <div className="task-row-right">
        {me ? (
          <span className={`status-badge ${statusClass(me.status)}`}>
            {statusLabel(me.status)}
          </span>
        ) : (
          <span className="status-badge status-not-started">—</span>
        )}
        <span className="task-row-arrow" aria-hidden>›</span>
      </div>
    </button>
  )
}
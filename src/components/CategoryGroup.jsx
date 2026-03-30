import { useState } from 'react'
import TaskRow from './TaskRow'
import './CategoryGroup.css'

const ICONS = {
  Chores: '🧹',
  Tasks: '✅',
  Projects: '🗂️',
}

function getTime(date) {
  if (!date) return Number.MAX_SAFE_INTEGER
  return new Date(date).getTime()
}

function isOverdue(task, me) {
  if (!task.due_date) return false
  if (!me || me.status === 'Completed') return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(task.due_date)
  due.setHours(0, 0, 0, 0)

  return due < today
}

function getPriority(task, me) {
  if (!me) return 5

  if (me.status === 'Completed') return 99

  if (me.status === 'Waiting') return 1

  if (isOverdue(task, me)) return 2

  if (me.status === 'In Progress') return 3

  return 4
}

function sortTasks(tasks, myParticipant) {
  return [...tasks].sort((a, b) => {
    const aMe = myParticipant(a)
    const bMe = myParticipant(b)

    const aPriority = getPriority(a, aMe)
    const bPriority = getPriority(b, bMe)

    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    const aDue = getTime(a.due_date)
    const bDue = getTime(b.due_date)

    return aDue - bDue
  })
}

export default function CategoryGroup({
  category,
  tasks,
  currentUserId,
  myParticipant,
  onSelectTask,
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (tasks.length === 0) return null

  const ordered = sortTasks(tasks, myParticipant)

  return (
    <section className="category-group">
      <button
        className="category-header"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span className="category-icon">{ICONS[category] || '📋'}</span>
        <span className="category-name">{category}</span>
        <span className="category-count">{tasks.length}</span>
        <span className="category-chevron" aria-hidden>
          {collapsed ? '›' : '‹'}
        </span>
      </button>

      {!collapsed && (
        <div className="category-body">
          {ordered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              me={myParticipant(task)}
              onClick={() => onSelectTask(task.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
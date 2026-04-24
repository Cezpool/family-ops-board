import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import TaskModal from '../components/TaskModal'

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function startOfCalendarGrid(date) {
  const first = startOfMonth(date)
  const day = first.getDay()
  const result = new Date(first)
  result.setDate(first.getDate() - day)
  return result
}

function endOfCalendarGrid(date) {
  const last = endOfMonth(date)
  const day = last.getDay()
  const result = new Date(last)
  result.setDate(last.getDate() + (6 - day))
  return result
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDayNumber(date) {
  return date.getDate()
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function parseTaskDate(task) {
  const raw = task.due_date || task.assigned_date
  if (!raw) return null

  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function isTaskOverdue(task) {
  const status = getTaskStatus(task).toLowerCase()
  const taskDate = parseTaskDate(task)
  const now = new Date()

  return (
    !!task.due_date &&
    !!taskDate &&
    taskDate < new Date(now.getFullYear(), now.getMonth(), now.getDate()) &&
    status !== 'completed'
  )
}

function getTaskStatus(task) {
  const statuses = (task.task_participants || [])
    .map(p => p.status)
    .filter(Boolean)

  if (statuses.some(s => s === 'Waiting' || s === 'Blocked')) return 'Waiting'
  if (statuses.some(s => s === 'In Progress')) return 'In Progress'
  if (statuses.length > 0 && statuses.every(s => s === 'Completed')) return 'Completed'
  if (statuses.some(s => s === 'Unable to Complete')) return 'Unable to Complete'

  return 'Not Started'
}

function getTaskChipStyle(task) {
  const status = getTaskStatus(task).toLowerCase()

  if (isTaskOverdue(task)) {
    return {
      background: '#fee2e2',
      border: '1px solid #dc2626',
      color: '#7f1d1d',
    }
  }

  if (status === 'in progress') {
    return {
      background: '#e3f2fd',
      border: '1px solid #90caf9',
      color: '#0d47a1',
    }
  }

  if (status === 'completed') {
    return {
      background: '#e6f4ea',
      border: '1px solid #a5d6a7',
      color: '#1b5e20',
    }
  }

  if (status === 'waiting' || status === 'blocked') {
    return {
      background: '#fff4e5',
      border: '1px solid #ffd699',
      color: '#7a4f01',
    }
  }

  return {
    background: '#f1f3f5',
    border: '1px solid #d0d7de',
    color: '#1f2933',
  }
}

function buildCalendarDays(monthDate) {
  const start = startOfCalendarGrid(monthDate)
  const end = endOfCalendarGrid(monthDate)
  const days = []

  const current = new Date(start)
  while (current <= end) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return days
}

export default function DisplayPage() {
  
  const scale = Math.min(
	window.innerWidth / 1920,
	window.innerHeight / 1080,
	1
  )
  
  const [allProfiles, setAllProfiles] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  useEffect(() => {
    fetchTasks()
    fetchProfiles()

    const interval = setInterval(() => {
      fetchTasks(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setSelectedTask(null)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  async function fetchTasks(silent = false) {
    if (!silent) setLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        assigned_date,
        created_at,
        description,
        archived,
        completed_date,
        task_participants (
          id,
          user_id,
          participant_role,
          status,
          profile:profiles (
            id,
            display_name,
            email
          )
        )
      `)
      .eq('archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMsg(error.message)
      setTasks([])
    } else {
      setTasks(data || [])
    }

    setLoading(false)
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, role')
      .order('display_name')

    setAllProfiles(data || [])
  }

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor])

  const tasksByDate = useMemo(() => {
    const map = new Map()

    for (const task of tasks) {
      const status = getTaskStatus(task).toLowerCase()
      if (status === 'completed') continue

      const d = parseTaskDate(task)
      if (!d) continue

      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(task)
    }

    for (const [, list] of map) {
      list.sort((a, b) => {
        const aOverdue = isTaskOverdue(a) ? 0 : 1
        const bOverdue = isTaskOverdue(b) ? 0 : 1
        if (aOverdue !== bOverdue) return aOverdue - bOverdue

        const aDate = parseTaskDate(a)
        const bDate = parseTaskDate(b)
        return (aDate?.getTime() || 0) - (bDate?.getTime() || 0)
      })
    }

    return map
  }, [tasks])

  function getTasksForDate(date) {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return tasksByDate.get(key) || []
  }

  function goPrevMonth() {
    setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function goNextMonth() {
    setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function goToday() {
    const now = new Date()
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const today = new Date()
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div
      style={{
		position: 'fixed',
		top: '50%',
		left: '50%',
	
		transform: `translate(-50%, -50%) scale(${scale})`,
		transformOrigin: 'top left',

		width: '1920px',
		height: '1080px',

		background: '#f5f7fa',
		color: '#1f2933',
		fontFamily: 'Arial, sans-serif',
		padding: '14px',
		boxSizing: 'border-box',
	  }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '18px',
          gap: '20px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(22px, 2.6vw, 34px)',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Family Ops Board
          </h1>

          <div
            style={{
              marginTop: '8px',
              fontSize: '18px',
              color: '#6b7280',
            }}
          >
            Calendar Display
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <button
            onClick={goPrevMonth}
            style={{
              padding: '10px 14px',
              background: '#ffffff',
              border: '1px solid #d0d7de',
              color: '#1f2933',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ← Prev
          </button>

          <button
            onClick={goToday}
            style={{
              padding: '10px 14px',
              background: '#ffffff',
              border: '1px solid #d0d7de',
              color: '#1f2933',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Today
          </button>

          <button
            onClick={goNextMonth}
            style={{
              padding: '10px 14px',
              background: '#ffffff',
              border: '1px solid #d0d7de',
              color: '#1f2933',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Next →
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: 'clamp(18px, 2vw, 24px)',
          fontWeight: 700,
          marginBottom: '14px',
        }}
      >
        {formatMonthYear(monthCursor)}
      </div>

      {loading && <div style={{ fontSize: '20px' }}>Loading calendar…</div>}

      {errorMsg && (
        <div style={{ color: '#dc2626', fontSize: '18px' }}>
          ERROR: {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '5px',
              marginBottom: '8px',
            }}
          >
            {weekdayLabels.map(label => (
              <div
                key={label}
                style={{
                  padding: '10px 8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '16px',
                  background: '#ffffff',
                  border: '1px solid #d0d7de',
                  color: '#374151',
                  borderRadius: '6px',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
            }}
          >
            {calendarDays.map(date => {
              const inCurrentMonth = date.getMonth() === monthCursor.getMonth()
              const isToday = sameDay(date, today)
              const dayTasks = getTasksForDate(date)
              const visibleTasks = dayTasks.slice(0, 2)
              const overflowCount = Math.max(dayTasks.length - 2, 0)

              return (
                <div
                  key={date.toISOString()}
                  style={{
                    height: 'calc((100vh - clamp(140px, 18vh, 210px)) / 6)',
                    minHeight: 0,
                    background: inCurrentMonth ? '#ffffff' : '#f8fafc',
                    border: '1px solid #d0d7de',
                    outline: isToday ? '2px solid #2563eb' : 'none',
                    outlineOffset: '-2px',
                    boxShadow: isToday
                      ? '0 0 0 2px rgba(37, 99, 235, 0.15)'
                      : '0 1px 2px rgba(0,0,0,0.05)',
                    borderRadius: '6px',
                    padding: 'clamp(4px, 0.7vw, 10px)',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: inCurrentMonth ? '#111827' : '#9ca3af',
                      }}
                    >
                      {formatDayNumber(date)}
                    </div>

                    {dayTasks.length > 0 && (
                      <div
                        style={{
                          fontSize: '12px',
                          background: '#eef2f7',
                          border: '1px solid #d0d7de',
                          color: '#374151',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {dayTasks.length}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      flex: 1,
                      overflow: 'hidden',
                    }}
                  >
                    {visibleTasks.map(task => {
                      const chipStyle = getTaskChipStyle(task)

                      return (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task.id)}
                          title={task.title}
                          style={{
                            ...chipStyle,
                            height: 'clamp(18px, 2.8vh, 28px)',
                            overflow: 'hidden',
                            display: 'block',
                            padding: 'clamp(2px, 0.4vh, 6px) clamp(4px, 0.6vw, 8px)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 'clamp(9px, 1.2vw, 12px)',
                            lineHeight: 1.1,
                            borderRadius: '4px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {task.title}
                          </div>
                        </button>
                      )
                    })}

                    {overflowCount > 0 && (
                      <div
                        onClick={() => setSelectedTask(dayTasks[2].id)}
                        style={{
                          fontSize: '12px',
                          color: '#2563eb',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginTop: 'auto',
                        }}
                      >
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selectedTask && (
        <TaskModal
          taskId={selectedTask}
          currentProfile={{
            id: 'display-mode',
            display_name: 'Display',
            role: 'parent_admin',
          }}
          isParent={true}
          allProfiles={allProfiles}
          onClose={() => {
            setSelectedTask(null)
            fetchTasks()
          }}
          onUpdated={fetchTasks}
        />
      )}
    </div>
  )
}
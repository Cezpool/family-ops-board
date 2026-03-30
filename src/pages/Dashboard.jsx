import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import CategoryGroup from '../components/CategoryGroup'
import TaskModal from '../components/TaskModal'
import CreateTaskModal from '../components/CreateTaskModal'
import './Dashboard.css'

const CATEGORIES = ['Chores', 'Tasks', 'Projects']

function needsAttentionForParticipant(p) {
  const isWaiting = p.status === 'Waiting'
  const hasOpenRequest =
    p.request_status === 'requested' || p.request_status === 'ordered'

  const hasNeedDetails =
    !!p.needs_type || !!p.needed_item || !!p.needs_reason || !!p.waiting_on

  const isResolved = p.request_status === 'received' && p.status !== 'Waiting'

  if (isResolved) return false

  return isWaiting || hasOpenRequest || (hasNeedDetails && p.status === 'Waiting')
}

export default function Dashboard() {
  const { profile, isParent } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [allProfiles, setAllProfiles] = useState([])

  const fetchTasks = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, assigned_date, due_date, completed_date,
        created_at, updated_at, created_by,
        category:categories(id, name),
        creator:profiles!tasks_created_by_fkey(id, display_name),
        task_participants(
          id, user_id, participant_role, status,
          date_assigned, date_completed, unable_reason, last_checkin_at,
          needs_type, needed_item, needs_reason, waiting_on, request_status,
          profile:profiles(id, display_name, email)
        )
      `)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (!error) setTasks(data || [])
    setLoading(false)
  }, [profile])

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, role')
      .order('display_name')
    setAllProfiles(data || [])
  }

  useEffect(() => {
    fetchTasks()
    if (isParent) fetchProfiles()
  }, [fetchTasks, isParent])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function groupByCategory(categoryName) {
    return tasks.filter(t => t.category?.name === categoryName)
  }

  const myParticipant = task =>
    task.task_participants?.find(p => p.user_id === profile?.id)

  const needsAttention = isParent
    ? tasks.flatMap(task =>
        (task.task_participants || [])
          .filter(needsAttentionForParticipant)
          .map(p => ({
            taskId: task.id,
            taskTitle: task.title,
            category: task.category?.name,
            participantName: p.profile?.display_name,
            participantStatus: p.status,
            needsType: p.needs_type,
            neededItem: p.needed_item,
            needsReason: p.needs_reason,
            waitingOn: p.waiting_on,
            requestStatus: p.request_status,
          }))
      )
    : []

  if (loading) return <div className="loading-screen">Loading your board…</div>

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-logo">
            <span className="dash-mark">FOB</span>
            <span className="dash-title">Family Ops Board</span>
          </div>

          <div className="dash-user">
            <span className="dash-name">{profile?.display_name}</span>
            <span className="dash-role-badge" data-role={profile?.role}>
              {isParent ? 'Parent' : 'Member'}
            </span>

            {isParent && (
              <button
                className="btn btn-amber btn-sm"
                onClick={() => setShowCreate(true)}
              >
                + New Task
              </button>
            )}

            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        {isParent && needsAttention.length > 0 && (
          <section className="needs-attention-section">
            <div className="needs-attention-header">
              <h2 className="needs-attention-title">Needs Attention</h2>
              <span className="needs-attention-count">{needsAttention.length}</span>
            </div>

            <div className="needs-attention-list">
              {needsAttention.map((item, index) => (
                <button
                  key={`${item.taskId}-${item.participantName}-${index}`}
                  className="needs-attention-item"
                  onClick={() => setSelectedTask(item.taskId)}
                >
                  <div className="needs-attention-top">
                    <span className="needs-attention-task">{item.taskTitle}</span>
                    <span className="needs-attention-category">{item.category}</span>
                  </div>

                  <div className="needs-attention-meta">
                    <span><strong>For:</strong> {item.participantName || 'Unknown'}</span>
                    {item.participantStatus && (
                      <span><strong>Status:</strong> {item.participantStatus}</span>
                    )}
                    {item.needsType && (
                      <span><strong>Type:</strong> {item.needsType}</span>
                    )}
                    {item.neededItem && (
                      <span><strong>Need:</strong> {item.neededItem}</span>
                    )}
                    {item.needsReason && (
                      <span><strong>Reason:</strong> {item.needsReason}</span>
                    )}
                    {item.waitingOn && (
                      <span><strong>Waiting on:</strong> {item.waitingOn}</span>
                    )}
                    {item.requestStatus && (
                      <span><strong>Request:</strong> {item.requestStatus}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No tasks assigned yet.</p>
            {isParent && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                Create your first task
              </button>
            )}
          </div>
        ) : (
          <div className="categories">
            {CATEGORIES.map(cat => (
              <CategoryGroup
                key={cat}
                category={cat}
                tasks={groupByCategory(cat)}
                currentUserId={profile?.id}
                myParticipant={myParticipant}
                onSelectTask={setSelectedTask}
              />
            ))}
          </div>
        )}
      </main>

      {selectedTask && (
        <TaskModal
          taskId={selectedTask}
          currentProfile={profile}
          isParent={isParent}
          allProfiles={allProfiles}
          onClose={() => {
            setSelectedTask(null)
            fetchTasks()
          }}
          onUpdated={fetchTasks}
        />
      )}

      {showCreate && (
        <CreateTaskModal
          currentProfile={profile}
          allProfiles={allProfiles}
          onClose={() => {
            setShowCreate(false)
            fetchTasks()
          }}
        />
      )}
    </div>
  )
}
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { formatDate, formatDateTime, isOverdue, toInputDate } from '../utils/dates'
import { statusClass, statusLabel } from '../utils/status'
import { logActivity } from '../utils/activity'
import './TaskModal.css'

const COMMENT_TYPES = ['check_in', 'question', 'answer', 'note', 'reminder']
const TYPE_LABELS = {
  check_in: 'Check-in',
  question: 'Question',
  answer: 'Answer',
  note: 'Note',
  reminder: 'Reminder',
}

const NEED_TYPES = ['item', 'approval', 'help', 'access', 'other']
const REQUEST_STATUSES = ['requested', 'ordered', 'received']

export default function TaskModal({
  taskId,
  currentProfile,
  isParent,
  allProfiles,
  onClose,
  onUpdated,
}) {
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const [commentBody, setCommentBody] = useState('')
  const [commentType, setCommentType] = useState('check_in')
  const [posting, setPosting] = useState(false)

  const [needsType, setNeedsType] = useState('')
  const [neededItem, setNeededItem] = useState('')
  const [needsReason, setNeedsReason] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [requestStatus, setRequestStatus] = useState('')

  const fetchTask = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select(`
        id, title, description, assigned_date, due_date, completed_date,
        created_at, updated_at, created_by, archived,
        category:categories(id, name),
        creator:profiles!tasks_created_by_fkey(id, display_name),
        task_participants(
          id, user_id, participant_role, status,
          date_assigned, date_completed, unable_reason, last_checkin_at,
          needs_type, needed_item, needs_reason, waiting_on, request_status,
          profile:profiles(id, display_name, email)
        )
      `)
      .eq('id', taskId)
      .single()

    setTask(data)
    setEditTitle(data?.title || '')
    setEditDesc(data?.description || '')
    setEditDueDate(toInputDate(data?.due_date))

    const myRow = data?.task_participants?.find(p => p.user_id === currentProfile?.id)
    setNeedsType(myRow?.needs_type || '')
    setNeededItem(myRow?.needed_item || '')
    setNeedsReason(myRow?.needs_reason || '')
    setWaitingOn(myRow?.waiting_on || '')
    setRequestStatus(myRow?.request_status || '')

    setLoading(false)
  }, [taskId, currentProfile])

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('task_comments')
      .select('*, profile:profiles(id, display_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    setComments(data || [])
  }, [taskId])

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from('task_activity')
      .select('*, actor:profiles(id, display_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    setActivity(data || [])
  }, [taskId])

  useEffect(() => {
    fetchTask()
    fetchComments()
    fetchActivity()
  }, [fetchTask, fetchComments, fetchActivity])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const me = task?.task_participants?.find(p => p.user_id === currentProfile?.id)
  const isDisplayMode = currentProfile?.id === 'display-mode'

  const canEditTask = !isDisplayMode && isParent && task?.created_by === currentProfile?.id
  const canArchive = !isDisplayMode && isParent
  const canDelete = !isDisplayMode && isParent && task?.created_by === currentProfile?.id
  const overdue = isOverdue(task?.due_date, me?.status)

  async function setMyStatus(newStatus) {
    if (!me) return

    setSaving(true)

    const updates = {
      status: newStatus,
      ...(newStatus === 'Completed'
        ? { date_completed: new Date().toISOString().slice(0, 10) }
        : {}),
      ...(newStatus !== 'Completed' ? { date_completed: null } : {}),
      ...(newStatus === 'In Progress' || newStatus === 'Waiting'
        ? { last_checkin_at: new Date().toISOString() }
        : {}),
    }

    await supabase.from('task_participants').update(updates).eq('id', me.id)

    await logActivity(taskId, currentProfile.id, 'status_change', {
      status: newStatus,
    })

    await fetchTask()
    onUpdated()
    setSaving(false)
  }

  async function saveNeeds() {
    if (!me) return

    setSaving(true)

    await supabase
      .from('task_participants')
      .update({
        needs_type: needsType || null,
        needed_item: neededItem || null,
        needs_reason: needsReason || null,
        waiting_on: waitingOn || null,
        request_status: requestStatus || null,
      })
      .eq('id', me.id)

    await logActivity(taskId, currentProfile.id, 'needs_updated', {
      needs_type: needsType || null,
      needed_item: neededItem || null,
      waiting_on: waitingOn || null,
      request_status: requestStatus || null,
    })

    await fetchTask()
    onUpdated()
    setSaving(false)
  }

  async function saveEdit() {
    setSaving(true)

    await supabase
      .from('tasks')
      .update({
        title: editTitle,
        description: editDesc,
        due_date: editDueDate || null,
      })
      .eq('id', taskId)

    await logActivity(taskId, currentProfile.id, 'task_updated', {
      fields: ['title', 'description', 'due_date'],
    })

    setEditing(false)
    await fetchTask()
    onUpdated()
    setSaving(false)
  }

  async function archiveTask() {
    if (!canArchive) return
    if (!confirm('Archive this task?')) return

    setSaving(true)

    await supabase
      .from('tasks')
      .update({ archived: true })
      .eq('id', taskId)

    await logActivity(taskId, currentProfile.id, 'task_archived', {})

    onUpdated()
    onClose()
  }

  async function deleteTask() {
    if (!canDelete) return
    if (!confirm('DELETE this task permanently? This cannot be undone.')) return

    setSaving(true)

    await supabase.from('tasks').delete().eq('id', taskId)

    onUpdated()
    onClose()
  }

  async function postComment(e) {
    e.preventDefault()
    if (!commentBody.trim()) return

    setPosting(true)

    await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: currentProfile.id,
      type: commentType,
      body: commentBody.trim(),
    })

    await logActivity(taskId, currentProfile.id, 'comment_added', {
      type: commentType,
    })

    setCommentBody('')
    await fetchComments()
    setPosting(false)
  }

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={handleBackdrop}>
        <div className="modal-box">
          <div className="modal-loading">Loading…</div>
        </div>
      </div>
    )
  }

  if (!task) return null
  
  if (isDisplayMode) {
  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box" role="dialog" aria-modal="true">

        {/* HEADER */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-category">{task.category?.name}</span>
            {overdue && <span className="modal-overdue-tag">OVERDUE</span>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* TITLE */}
        <div className="modal-title-row">
          <h2 className="modal-title">{task.title}</h2>
        </div>

        {/* CONTENT */}
        <div className="modal-content">

          {/* DESCRIPTION */}
          <div className="overview-section">
            <div className="overview-label">Description</div>
            <div className="overview-value">
              {task.description || <span className="overview-empty">No description.</span>}
            </div>
          </div>

          {/* CORE GRID */}
          <div className="overview-grid">

            <div className="overview-section">
              <div className="overview-label">Created by</div>
              <div className="overview-value">{task.creator?.display_name}</div>
            </div>

            <div className="overview-section">
              <div className="overview-label">Category</div>
              <div className="overview-value">{task.category?.name}</div>
            </div>

            <div className="overview-section">
              <div className="overview-label">Assigned</div>
              <div className="overview-value">{formatDate(task.assigned_date)}</div>
            </div>

            <div className="overview-section">
              <div className="overview-label">Due Date</div>
              <div className={`overview-value ${overdue ? 'overview-overdue' : ''}`}>
                {formatDate(task.due_date)}
              </div>
            </div>

            <div className="overview-section">
              <div className="overview-label">Completed</div>
              <div className="overview-value">{formatDate(task.completed_date)}</div>
            </div>

            <div className="overview-section">
              <div className="overview-label">Assigned Users</div>
              <div className="overview-value">
                {task.task_participants?.map(p => p.profile?.display_name).join(', ') || '—'}
              </div>
            </div>

          </div>

          <div
			style={{
			  display: 'grid',
			  gridTemplateColumns: '1.2fr 1fr 1fr',
			  gap: '20px',
			  marginTop: '20px'
			}}
		  >

			{/* PARTICIPANTS */}
			<div>
			  <div className="overview-label">Participants</div>

			  {task.task_participants?.map(p => (
				<div key={p.id} className="participant-row">

				  <div className="participant-avatar">
					{(p.profile?.display_name || '?')[0].toUpperCase()}
				  </div>

				  <div className="participant-info">
					<span className="participant-name">{p.profile?.display_name}</span>
				  </div>

				  <div className="participant-status">
					<span className={`status-badge ${statusClass(p.status)}`}>
					  {statusLabel(p.status)}
					</span>
	  			  </div>

				</div>
			  ))}
			</div>

			{/* FEED */}
	  		<div>
			  <div className="overview-label">Feed</div>

			  {comments.length === 0 && (
				<p className="overview-empty">No interactions yet.</p>
			  )}

			  {comments.slice(-5).map(c => (
				<div key={c.id} className="feed-item">
				  <div className="feed-meta">
					<span className="feed-author">{c.profile?.display_name}</span>
					<span className="feed-time">{formatDateTime(c.created_at)}</span>
				  </div>
				  <div className="feed-body">{c.body}</div>
				</div>
			  ))}
			</div>

			{/* ACTIVITY */}
			<div>
			  <div className="overview-label">Activity</div>

			  {activity.length === 0 && (
				<p className="overview-empty">No activity recorded.</p>
			  )}

			  {activity.slice(0, 5).map(a => (
				<div key={a.id} className="activity-item">
				  <div className="activity-dot" />
				  <div className="activity-info">
					<span className="activity-actor">{a.actor?.display_name}</span>{' '}
					<span>{formatAction(a)}</span>
				  </div>
				</div>
			  ))}
			</div>

		</div>
      </div>
    </div>
  </div>
  )
}

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-category">{task.category?.name}</span>
            {overdue && <span className="modal-overdue-tag">OVERDUE</span>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-title-row">
          {editing ? (
            <input
              className="modal-title-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
          ) : (
            <h2 className="modal-title">{task.title}</h2>
          )}
        </div>

        <div className="modal-tabs">
          {(isDisplayMode
			? ['overview', 'participants', 'feed', 'activity']
			: ['overview', 'actions', 'participants', 'feed', 'activity']
		  ).map(tab => (
            <button
              key={tab}
              className={`modal-tab ${activeTab === tab ? 'modal-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="modal-content">
          {activeTab === 'overview' && (
            <div className="tab-overview">
              {editing ? (
                <div className="field">
                  <label>Description</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={4}
                  />
                </div>
              ) : (
                <div className="overview-section">
                  <div className="overview-label">Description</div>
                  <div className="overview-value">
                    {task.description || (
                      <span className="overview-empty">No description.</span>
                    )}
                  </div>
                </div>
              )}

              <div className="overview-grid">
                <div className="overview-section">
                  <div className="overview-label">Created by</div>
                  <div className="overview-value">{task.creator?.display_name}</div>
                </div>

                <div className="overview-section">
                  <div className="overview-label">Category</div>
                  <div className="overview-value">{task.category?.name}</div>
                </div>

                <div className="overview-section">
                  <div className="overview-label">Assigned</div>
                  <div className="overview-value">{formatDate(task.assigned_date)}</div>
                </div>

                <div className="overview-section">
                  <div className="overview-label">Due Date</div>
                  <div className={`overview-value ${overdue ? 'overview-overdue' : ''}`}>
                    {editing ? (
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={e => setEditDueDate(e.target.value)}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                      />
                    ) : (
                      formatDate(task.due_date)
                    )}
                  </div>
                </div>

                <div className="overview-section">
                  <div className="overview-label">Completed</div>
                  <div className="overview-value">{formatDate(task.completed_date)}</div>
                </div>

                <div className="overview-section">
                  <div className="overview-label">Assigned Users</div>
                  <div className="overview-value">
                    {task.task_participants?.map(p => p.profile?.display_name).join(', ') || '—'}
                  </div>
                </div>

                <div className="overview-section" style={{ gridColumn: '1 / -1' }}>
                  <div className="overview-label">Participant Roles</div>
                  <div className="overview-value">
                    {task.task_participants
                      ?.map(p =>
                        p.participant_role
                          ? `${p.profile?.display_name}: ${p.participant_role}`
                          : null
                      )
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>

                {me && (me.needs_type || me.needed_item || me.needs_reason || me.waiting_on || me.request_status) && (
                  <div className="overview-section" style={{ gridColumn: '1 / -1' }}>
                    <div className="overview-label">Your Waiting / Need Info</div>
                    <div className="overview-value">
                      {[
                        me.needs_type ? `Type: ${me.needs_type}` : null,
                        me.needed_item ? `Need: ${me.needed_item}` : null,
                        me.needs_reason ? `Reason: ${me.needs_reason}` : null,
                        me.waiting_on ? `Waiting on: ${me.waiting_on}` : null,
                        me.request_status ? `Request status: ${me.request_status}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </div>

              {(canEditTask || canArchive) && (
                <div className="edit-actions">
                  {editing ? (
                    <>
                      <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button className="btn btn-outline" onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {canEditTask && (
                        <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                          Edit Task
                        </button>
                      )}

                      {canArchive && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={archiveTask}
                          disabled={saving}
                        >
                          Archive
                        </button>
                      )}

                      {canDelete && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={deleteTask}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="tab-actions">
              {me ? (
                <>
                  <div className="my-status-row">
                    <span className="overview-label">Your Status</span>
                    <span className={`status-badge ${statusClass(me.status)}`}>
                      {statusLabel(me.status)}
                    </span>
                  </div>

                  <div className="action-buttons">
                    {[
                      ['In Progress', 'btn-primary'],
                      ['Completed', 'btn-primary'],
                      ['Incomplete', 'btn-outline'],
                      ['Unable to Complete', 'btn-outline'],
                      ['Waiting', 'btn-outline'],
                    ].map(([status, cls]) => (
                      <button
                        key={status}
                        className={`btn ${cls}`}
                        disabled={saving || me.status === status}
                        onClick={() => setMyStatus(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <hr className="divider" />

                  <p className="actions-subhead">Waiting / Need Details</p>

                  <div className="field">
                    <label>Need Type</label>
                    <select value={needsType} onChange={e => setNeedsType(e.target.value)}>
                      <option value="">—</option>
                      {NEED_TYPES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Needed Item / Need</label>
                    <input
                      type="text"
                      value={neededItem}
                      onChange={e => setNeededItem(e.target.value)}
                      placeholder="e.g. mower belt"
                    />
                  </div>

                  <div className="field">
                    <label>Reason</label>
                    <textarea
                      value={needsReason}
                      onChange={e => setNeedsReason(e.target.value)}
                      placeholder="Why are you waiting or blocked?"
                      rows={3}
                    />
                  </div>

                  <div className="field">
                    <label>Waiting On</label>
                    <input
                      type="text"
                      value={waitingOn}
                      onChange={e => setWaitingOn(e.target.value)}
                      placeholder="Dad / Parent Admin / weather / part arrival"
                    />
                  </div>

                  <div className="field">
                    <label>Request Status</label>
                    <select value={requestStatus} onChange={e => setRequestStatus(e.target.value)}>
                      <option value="">—</option>
                      {REQUEST_STATUSES.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button className="btn btn-primary" onClick={saveNeeds} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Need'}
                  </button>

                  <hr className="divider" />
                  <p className="actions-subhead">Add to Feed</p>

                  <form className="comment-form" onSubmit={postComment}>
                    <div className="field">
                      <label>Type</label>
                      <select value={commentType} onChange={e => setCommentType(e.target.value)}>
                        {['question', 'check_in', 'note'].map(t => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Message</label>
                      <textarea
                        value={commentBody}
                        onChange={e => setCommentBody(e.target.value)}
                        placeholder={
                          commentType === 'question'
                            ? 'Ask a question…'
                            : 'Add a note or check-in…'
                        }
                        rows={3}
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn-amber" disabled={posting}>
                      {posting ? 'Posting…' : 'Post'}
                    </button>
                  </form>
                </>
              ) : (
                <p className="overview-empty">You are not a participant on this task.</p>
              )}

              {isParent && (
                <>
                  <hr className="divider" />
                  <p className="actions-subhead">Parent: Post to Feed</p>

                  <form className="comment-form" onSubmit={postComment}>
                    <div className="field">
                      <label>Type</label>
                      <select value={commentType} onChange={e => setCommentType(e.target.value)}>
                        {COMMENT_TYPES.map(t => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Message</label>
                      <textarea
                        value={commentBody}
                        onChange={e => setCommentBody(e.target.value)}
                        placeholder="Write your message…"
                        rows={3}
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn-amber" disabled={posting}>
                      {posting ? 'Posting…' : 'Post'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="tab-participants">
              {task.task_participants?.length === 0 && (
                <p className="overview-empty">No participants assigned.</p>
              )}

              {task.task_participants?.map(p => (
                <div key={p.id} className="participant-row">
                  <div className="participant-avatar">
                    {(p.profile?.display_name || '?')[0].toUpperCase()}
                  </div>

                  <div className="participant-info">
                    <span className="participant-name">{p.profile?.display_name}</span>

                    {p.participant_role && (
                      <span className="participant-role">{p.participant_role}</span>
                    )}

                    <span className="participant-email">{p.profile?.email}</span>

                    {(p.needs_type ||
                      p.needed_item ||
                      p.needs_reason ||
                      p.waiting_on ||
                      p.request_status) && (
                      <span className="participant-role">
                        {[
                          p.needs_type ? `Type: ${p.needs_type}` : null,
                          p.needed_item ? `Need: ${p.needed_item}` : null,
                          p.waiting_on ? `Waiting on: ${p.waiting_on}` : null,
                          p.request_status ? `Status: ${p.request_status}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>

                  <div className="participant-status">
                    <span className={`status-badge ${statusClass(p.status)}`}>
                      {statusLabel(p.status)}
                    </span>
                    {p.date_completed && (
                      <span className="participant-done">Done {formatDate(p.date_completed)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="tab-feed">
              {comments.length === 0 && (
                <p className="overview-empty">
                  No interactions yet. Use the Actions tab to post.
                </p>
              )}

              {comments.map(c => (
                <div key={c.id} className="feed-item" data-type={c.type}>
                  <div className="feed-meta">
                    <span className="feed-type-badge">{TYPE_LABELS[c.type] || c.type}</span>
                    <span className="feed-author">{c.profile?.display_name}</span>
                    <span className="feed-time">{formatDateTime(c.created_at)}</span>
                  </div>
                  <div className="feed-body">{c.body}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="tab-activity">
              {activity.length === 0 && (
                <p className="overview-empty">No activity recorded yet.</p>
              )}

              {activity.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-info">
                    <span className="activity-actor">{a.actor?.display_name}</span>{' '}
                    <span className="activity-action">{formatAction(a)}</span>
                    <span className="activity-time">{formatDateTime(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatAction(a) {
  switch (a.action_type) {
    case 'status_change':
      return `marked task as "${a.metadata?.status}"`
    case 'comment_added':
      return `added a ${a.metadata?.type || 'comment'}`
    case 'task_updated':
      return 'updated the task'
    case 'task_created':
      return 'created the task'
    case 'needs_updated':
      return 'updated waiting / need details'
    case 'task_archived':
      return 'archived the task'
    default:
      return String(a.action_type || '').replace(/_/g, ' ')
  }
}
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { logActivity } from '../utils/activity'
import './CreateTaskModal.css'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function CreateTaskModal({ currentProfile, allProfiles, onClose }) {
  const [categories, setCategories] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [assignedDate, setAssignedDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [roles, setRoles] = useState({}) // userId -> role string
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setCategories(data || [])
        if (data?.length) setCategoryId(data[0].id)
      })
  }, [])

  function toggleUser(userId) {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    if (!categoryId) {
      setError('Category is required.')
      return
    }

    if (dueDate && assignedDate && new Date(dueDate) < new Date(assignedDate)) {
      setError('Due date cannot be before assigned date.')
      return
    }

    setSaving(true)

    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        created_by: currentProfile.id,
        assigned_date: assignedDate || null,
        due_date: dueDate || null,
      })
      .select('id')
      .single()

    if (taskErr) {
      setError(taskErr.message)
      setSaving(false)
      return
    }

    if (selectedUsers.length > 0) {
      const participants = selectedUsers.map(uid => ({
        task_id: taskData.id,
        user_id: uid,
        participant_role: roles[uid] || null,
        status: 'Not Started',
        date_assigned: assignedDate || null,
      }))

      const { error: participantsErr } = await supabase
        .from('task_participants')
        .insert(participants)

      if (participantsErr) {
        setError(participantsErr.message)
        setSaving(false)
        return
      }
    }

    await logActivity(taskData.id, currentProfile.id, 'task_created', {
      title: title.trim(),
    })

    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box create-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <span className="modal-category">New Task</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="create-modal-body">
          <form onSubmit={handleSubmit} className="create-form">
            {error && <div className="error-msg">{error}</div>}

            <div className="field">
              <label>Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Task name…"
                required
              />
            </div>

            <div className="field">
              <label>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What needs to be done?"
                rows={3}
              />
            </div>

            <div className="create-form-row">
              <div className="field">
                <label>Category *</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  required
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Assigned Date</label>
                <input
                  type="date"
                  value={assignedDate}
                  onChange={e => {
                    const nextAssignedDate = e.target.value
                    setAssignedDate(nextAssignedDate)

                    if (dueDate && nextAssignedDate && new Date(dueDate) < new Date(nextAssignedDate)) {
                      setDueDate('')
                    }
                  }}
                />
              </div>

              <div className="field">
                <label>Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  min={assignedDate || undefined}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Assign Family Members</label>
              <div className="user-checklist">
                {allProfiles.map(p => (
                  <div key={p.id} className="user-check-row">
                    <label className="user-check-label">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(p.id)}
                        onChange={() => toggleUser(p.id)}
                      />
                      <span className="user-check-avatar">
                        {(p.display_name || '?')[0].toUpperCase()}
                      </span>
                      <span className="user-check-name">{p.display_name}</span>
                      <span className="user-check-role-tag">
                        {p.role === 'parent_admin' ? 'Parent' : 'Member'}
                      </span>
                    </label>

                    {selectedUsers.includes(p.id) && (
                      <input
                        className="user-role-input"
                        type="text"
                        placeholder="Role (optional)…"
                        value={roles[p.id] || ''}
                        onChange={e => setRoles(r => ({ ...r, [p.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="create-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create Task'}
              </button>

              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
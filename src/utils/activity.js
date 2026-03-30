import { supabase } from '../supabaseClient'

export async function logActivity(taskId, actorId, actionType, metadata = {}) {
  await supabase.from('task_activity').insert({
    task_id:     taskId,
    actor_id:    actorId,
    action_type: actionType,
    metadata,
  })
}

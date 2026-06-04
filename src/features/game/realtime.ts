import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { RoomState } from '../../appModel'

export function subscribeToRoom(room: RoomState | undefined, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase || !room?.cloudId) {
    return () => undefined
  }

  const client = supabase
  const channel = client
    .channel(`room:${room.cloudId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.cloudId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.cloudId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_questions', filter: `room_id=eq.${room.cloudId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_clues', filter: `room_id=eq.${room.cloudId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_guesses', filter: `room_id=eq.${room.cloudId}` }, onChange)
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

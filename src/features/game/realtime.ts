import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { RoomState } from '../../appModel'

type RealtimePayload = {
  new: Record<string, unknown> | null
  old: Record<string, unknown> | null
}

export function subscribeToRoom(room: RoomState | undefined, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase || !room?.cloudId) {
    return () => undefined
  }

  const client = supabase
  const notifyIfCurrentRoom = (payload: RealtimePayload) => {
    if (isCurrentRoomPayload(payload, room.cloudId!)) onChange()
  }
  const channel = client
    .channel(`room:${room.cloudId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, notifyIfCurrentRoom)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, notifyIfCurrentRoom)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_questions' }, notifyIfCurrentRoom)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_clues' }, notifyIfCurrentRoom)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_guesses' }, notifyIfCurrentRoom)
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

function isCurrentRoomPayload(payload: RealtimePayload, roomId: string): boolean {
  return isCurrentRoomRow(payload.new, roomId) || isCurrentRoomRow(payload.old, roomId)
}

function isCurrentRoomRow(row: Record<string, unknown> | null, roomId: string): boolean {
  return row?.id === roomId || row?.room_id === roomId
}

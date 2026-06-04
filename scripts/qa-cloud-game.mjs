import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const env = await readEnvFile('.env.local')
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
}

const password = `Qa-${Date.now()}-xuantang`
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const host = createQaClient()
const guest = createQaClient()

try {
  const hostProfile = await signUpQaUser(host, `host-${runId}`, '云端房主')
  const guestProfile = await signUpQaUser(guest, `guest-${runId}`, '云端玩家')

  const soup = await single(host.from('soups').select('id,title').eq('is_published', true).limit(1).single(), 'fetch soup')
  const roomId = await rpc(host, 'create_room', {
    p_soup_id: soup.id,
    p_mode: 'AI 主持',
    p_max_players: 6,
  })
  const room = await single(host.from('rooms').select('id,code,status').eq('id', roomId).single(), 'fetch room')

  const realtimeEvents = []
  const channel = host
    .channel(`qa-room-${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'game_questions' },
      (payload) => realtimeEvents.push(payload),
    )

  await subscribe(channel)

  await rpc(guest, 'join_room', { p_code: room.code })
  await update(host.from('rooms').update({ status: 'playing', started_at: new Date().toISOString() }).eq('id', roomId), 'start room')
  await rpc(guest, 'ask_room_question', {
    p_room_id: roomId,
    p_text: '红雨衣是关键物品吗？',
  })
  await waitFor(() => realtimeEvents.length > 0, 'Realtime question insert')
  await rpc(guest, 'submit_room_guess', {
    p_room_id: roomId,
    p_text: '男孩躲在衣柜里，用红雨衣伪装后让别人出门，暴雨冲掉脚印，家人误会。',
  })

  const [members, questions, clues, guesses, finalRoom] = await Promise.all([
    list(host.from('room_members').select('user_id,role').eq('room_id', roomId), 'members'),
    list(host.from('game_questions').select('id,text,answer').eq('room_id', roomId), 'questions'),
    list(host.from('game_clues').select('id,text,clue_type').eq('room_id', roomId), 'clues'),
    list(host.from('game_guesses').select('id,score,is_correct').eq('room_id', roomId), 'guesses'),
    single(host.from('rooms').select('status,finished_at').eq('id', roomId).single(), 'final room'),
  ])

  await host.removeChannel(channel)
  await host.auth.signOut()
  await guest.auth.signOut()

  const result = {
    ok: true,
    roomCode: room.code,
    soupTitle: soup.title,
    users: [hostProfile.email, guestProfile.email],
    memberCount: members.length,
    questionCount: questions.length,
    clueCount: clues.length,
    guessScore: guesses[0]?.score,
    finalStatus: finalRoom.status,
    realtimeEvents: realtimeEvents.length,
  }

  if (members.length < 2) throw new Error(`Expected 2 members, got ${members.length}`)
  if (!questions.length) throw new Error('Expected at least one question.')
  if (!clues.length) throw new Error('Expected at least one clue.')
  if (!guesses[0]?.is_correct) throw new Error(`Expected correct guess, got ${JSON.stringify(guesses[0])}`)
  if (finalRoom.status !== 'finished') throw new Error(`Expected finished room, got ${finalRoom.status}`)
  if (!realtimeEvents.length) throw new Error('Expected at least one Realtime event.')

  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  await host.auth.signOut().catch(() => undefined)
  await guest.auth.signOut().catch(() => undefined)
  throw error
}

function createQaClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function signUpQaUser(client, suffix, nickname) {
  const email = `qa-${suffix}@example.com`
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
    },
  })

  if (error) throw error
  if (!data.session) {
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error) throw signIn.error
  }

  await syncRealtimeAuth(client)

  return { email, nickname }
}

async function syncRealtimeAuth(client) {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (data.session?.access_token) client.realtime.setAuth(data.session.access_token)
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return data
}

async function single(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function list(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function update(query, label) {
  const { error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
}

function subscribe(channel) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime subscribe timed out.')), 10000)

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`Realtime subscribe failed: ${status}`))
      }
    })
  })
}

async function waitFor(predicate, label) {
  for (let i = 0; i < 40; i += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`${label} timed out.`)
}

async function readEnvFile(filePath) {
  try {
    const text = await readFile(filePath, 'utf8')
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const index = line.indexOf('=')
          return [line.slice(0, index), line.slice(index + 1)]
        }),
    )
  } catch {
    return {}
  }
}

import {
  addLocalMember,
  askQuestion as askLocalQuestion,
  countClues,
  createGameState,
  createRoom as createLocalRoom,
  finishRoom,
  getSolution,
  getTargetClueCount,
  soups as fallbackSoups,
  startRoom as startLocalRoom,
  submitGuess as submitLocalGuess,
  type ClueBoard,
  type GameState,
  type HostMode,
  type Player,
  type Question,
  type RoomState,
  type Soup,
} from '../../appModel'
import type { AuthProfile } from '../auth/authService'
import { isSupabaseConfigured, requireSupabase } from '../../lib/supabase'

type RoomRow = {
  id: string
  code: string
  soup_id: string
  host_user_id: string
  status: 'waiting' | 'playing' | 'finished'
  mode: HostMode
  max_players: number
  created_at: string
  started_at: string | null
  finished_at: string | null
}

type MemberRow = {
  user_id: string
  role: 'host' | 'player'
  ready: boolean
  profiles: { nickname: string } | Array<{ nickname: string }> | null
}

type QuestionRow = {
  id: string
  user_id: string
  text: string
  answer: Question['answer']
  clue_type: Question['clueType'] | null
  created_at: string
  profiles: { nickname: string } | Array<{ nickname: string }> | null
}

type ClueRow = {
  clue_type: Question['clueType']
  text: string
}

type GuessRow = {
  text: string
  score: number
  is_correct: boolean
  created_at: string
}

type SoupRow = {
  id: string
  slug: string
  title: string
  prompt: string
  difficulty: string | null
  duration_minutes: number | null
  min_players: number | null
  max_players: number | null
  rating: number | null
  accent: Soup['accent'] | null
}

export type CommunityPost = {
  id: string
  author: string
  title: string
  text: string
  stats: string
}

export type ProfileStats = {
  winRate: string
  gamesPlayed: string
  mvp: string
}

export async function fetchSoups(): Promise<Soup[]> {
  if (!isSupabaseConfigured) {
    return fallbackSoups
  }

  const client = requireSupabase()
  const { data, error } = await client
    .from('soups')
    .select('id,slug,title,prompt,difficulty,duration_minutes,min_players,max_players,rating,accent')
    .eq('is_published', true)
    .order('rating', { ascending: false })

  if (error) throw error

  return (data as SoupRow[]).map(mapSoupRow)
}

export async function fetchCommunityPosts(): Promise<CommunityPost[]> {
  if (!isSupabaseConfigured) {
    return [
      {
        id: 'post-radio',
        author: '深夜电台 · 官方',
        title: '深夜电台：第 17 碗电台',
        text: '一个主播、一通电话、一段被录音日消失。',
        stats: '562 讨论 · 86 收藏',
      },
      {
        id: 'post-steps',
        author: '汤底鬼魅',
        title: '楼下的脚步声',
        text: '留下的人先入座，陌生人却比邻居更清楚楼道。',
        stats: '312 讨论 · 34 收藏',
      },
      {
        id: 'post-store',
        author: '推理小王子',
        title: '便利店最后一单',
        text: '监控里没有人，收银机却自己打印了一张小票。',
        stats: '198 讨论 · 20 收藏',
      },
    ]
  }

  const client = requireSupabase()
  const { data, error } = await client
    .from('community_posts')
    .select('id,title,body,profiles(nickname)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return data.map((post) => ({
    id: post.id,
    author: getNestedNickname(post.profiles) ?? '玄汤官方',
    title: post.title,
    text: post.body,
    stats: '0 讨论 · 0 收藏',
  }))
}

export async function fetchProfileStats(profile: AuthProfile): Promise<ProfileStats> {
  if (!isSupabaseConfigured) {
    return {
      winRate: '68%',
      gamesPlayed: '47',
      mvp: '6',
    }
  }

  const client = requireSupabase()
  const { data, error } = await client
    .from('game_guesses')
    .select('is_correct')
    .eq('user_id', profile.id)

  if (error) throw error

  const total = data.length
  const wins = data.filter((guess) => guess.is_correct).length

  return {
    winRate: total ? `${Math.round((wins / total) * 100)}%` : '0%',
    gamesPlayed: String(total),
    mvp: String(wins),
  }
}

export async function createRoom(soup: Soup, profile: AuthProfile, mode: HostMode, maxPlayers: number): Promise<RoomState> {
  if (!isSupabaseConfigured || !soup.dbId) {
    return createLocalRoom(soup, profile.nickname, { mode, maxPlayers, visibility: '本机可见' })
  }

  const client = requireSupabase()
  const { data, error } = await client.rpc('create_room', {
    p_soup_id: soup.dbId,
    p_mode: mode,
    p_max_players: maxPlayers,
  })

  if (error) throw error

  return loadRoomSnapshot(data as string, soup).then((snapshot) => snapshot.room)
}

export async function joinRoomByCode(
  code: string,
  currentRoom: RoomState | undefined,
  profile: AuthProfile,
  localNickname?: string,
): Promise<RoomState> {
  const cleanCode = code.trim().toUpperCase()

  if (!isSupabaseConfigured) {
    if (!currentRoom) throw new Error('本地模式需要先创建一个房间。')
    return addLocalMember(currentRoom, localNickname?.trim() || profile.nickname)
  }

  const client = requireSupabase()
  const { data, error } = await client.rpc('join_room', {
    p_code: cleanCode,
  })

  if (error) throw error

  return loadRoomSnapshot(data as string).then((snapshot) => snapshot.room)
}

export async function startRoom(room: RoomState): Promise<RoomState> {
  if (!isSupabaseConfigured || !room.cloudId) {
    return startLocalRoom(room)
  }

  const client = requireSupabase()
  const { error } = await client
    .from('rooms')
    .update({ status: 'playing', started_at: new Date().toISOString() })
    .eq('id', room.cloudId)

  if (error) throw error

  return loadRoomSnapshot(room.cloudId).then((snapshot) => snapshot.room)
}

export async function createGame(room: RoomState, soup: Soup): Promise<GameState> {
  if (!isSupabaseConfigured || !room.cloudId) {
    return createGameState(soup, room.code)
  }

  return loadRoomSnapshot(room.cloudId, soup).then((snapshot) => snapshot.game)
}

export async function askQuestion(room: RoomState, game: GameState, text: string, profile: AuthProfile): Promise<GameState> {
  if (!isSupabaseConfigured || !room.cloudId) {
    return askLocalQuestion(game, text, profile.nickname)
  }

  const client = requireSupabase()
  const { error } = await client.rpc('ask_room_question', {
    p_room_id: room.cloudId,
    p_text: text,
  })

  if (error) throw error

  return loadRoomSnapshot(room.cloudId).then((snapshot) => snapshot.game)
}

export async function submitGuess(room: RoomState, game: GameState, guess: string): Promise<{ game: GameState; room: RoomState }> {
  if (!isSupabaseConfigured || !room.cloudId) {
    const nextGame = submitLocalGuess(game, guess)
    return {
      game: nextGame,
      room: nextGame.phase === 'revealed' ? finishRoom(room) : room,
    }
  }

  const client = requireSupabase()
  const { error } = await client.rpc('submit_room_guess', {
    p_room_id: room.cloudId,
    p_text: guess,
  })

  if (error) throw error

  return loadRoomSnapshot(room.cloudId)
}

export async function loadRoomSnapshot(roomId: string, knownSoup?: Soup): Promise<{ room: RoomState; game: GameState; soup: Soup }> {
  const client = requireSupabase()
  const { data: room, error: roomError } = await client
    .from('rooms')
    .select('id,code,soup_id,host_user_id,status,mode,max_players,created_at,started_at,finished_at')
    .eq('id', roomId)
    .single()

  if (roomError) throw roomError

  const soup = knownSoup ?? (await fetchSoupByDbId((room as RoomRow).soup_id))
  const [members, questions, clues, guesses] = await Promise.all([
    fetchMembers(roomId),
    fetchQuestions(roomId),
    fetchClues(roomId),
    fetchLastGuess(roomId),
  ])
  const clueBoard = groupClues(clues)
  const lastGuess = guesses[0]
  const isRevealed = (room as RoomRow).status === 'finished' || Boolean(lastGuess?.is_correct)

  return {
    soup,
    room: mapRoomRow(room as RoomRow, soup, members),
    game: {
      phase: isRevealed ? 'revealed' : lastGuess ? 'guessing' : 'asking',
      soupId: soup.id,
      roomCode: (room as RoomRow).code,
      questions,
      clues: clueBoard,
      guess: lastGuess?.text ?? '',
      score: lastGuess?.score ?? 0,
      lastAnswer: questions.at(-1)?.answer,
      startedAt: new Date((room as RoomRow).started_at ?? (room as RoomRow).created_at).getTime(),
      finishedAt: (room as RoomRow).finished_at ? new Date((room as RoomRow).finished_at!).getTime() : undefined,
    },
  }
}

function mapSoupRow(row: SoupRow): Soup {
  const players =
    row.min_players && row.max_players
      ? `${row.min_players}-${row.max_players}人`
      : row.max_players
        ? `1-${row.max_players}人`
        : '1-6人'

  return {
    id: row.slug,
    dbId: row.id,
    title: row.title,
    prompt: row.prompt,
    tags: [],
    difficulty: row.difficulty ?? '普通',
    duration: row.duration_minutes ? `${row.duration_minutes}分钟` : '15分钟',
    rating: Number(row.rating ?? 4.6),
    players,
    accent: row.accent ?? 'cyan',
  }
}

function mapRoomRow(row: RoomRow, soup: Soup, members: Player[]): RoomState {
  const host = members.find((member) => member.role === '房主')

  return {
    cloudId: row.id,
    code: row.code,
    soupId: soup.id,
    hostName: host?.name ?? '房主',
    members,
    status: row.status,
    settings: {
      mode: row.mode,
      maxPlayers: row.max_players,
      questionLimit: '无限制',
      visibility: '好友可见',
    },
    createdAt: new Date(row.created_at).getTime(),
  }
}

async function fetchSoupByDbId(dbId: string): Promise<Soup> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('soups')
    .select('id,slug,title,prompt,difficulty,duration_minutes,min_players,max_players,rating,accent')
    .eq('id', dbId)
    .single()

  if (error) throw error

  return mapSoupRow(data as SoupRow)
}

async function fetchMembers(roomId: string): Promise<Player[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('room_members')
    .select('user_id,role,ready,profiles(nickname)')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })

  if (error) throw error

  return (data as unknown as MemberRow[]).map((member) => ({
    id: member.user_id,
    userId: member.user_id,
    name: getNestedNickname(member.profiles) ?? '侦探',
    role: member.role === 'host' ? '房主' : '玩家',
    ready: member.ready,
  }))
}

async function fetchQuestions(roomId: string): Promise<Question[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('game_questions')
    .select('id,user_id,text,answer,clue_type,created_at,profiles(nickname)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data as unknown as QuestionRow[]).map((question, index) => ({
    id: index + 1,
    cloudId: question.id,
    asker: getNestedNickname(question.profiles) ?? '侦探',
    text: question.text,
    answer: question.answer,
    clueType: question.clue_type ?? undefined,
  }))
}

async function fetchClues(roomId: string): Promise<ClueRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('game_clues')
    .select('clue_type,text')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return data as ClueRow[]
}

async function fetchLastGuess(roomId: string): Promise<GuessRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('game_guesses')
    .select('text,score,is_correct,created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error

  return data as GuessRow[]
}

function groupClues(clues: ClueRow[]): ClueBoard {
  return clues.reduce<ClueBoard>(
    (board, clue) => {
      if (clue.clue_type === '人物') board.people.push(clue.text)
      if (clue.clue_type === '物品') board.objects.push(clue.text)
      if (clue.clue_type === '时间线') board.timeline.push(clue.text)
      if (clue.clue_type === '动机') board.motives.push(clue.text)
      return board
    },
    { people: [], objects: [], timeline: [], motives: [] },
  )
}

function getNestedNickname(profile: { nickname: string } | Array<{ nickname: string }> | null): string | undefined {
  if (!profile) return undefined
  if (Array.isArray(profile)) return profile[0]?.nickname
  return profile.nickname
}

export function getRoomProgressLabel(game: GameState, soup: Soup): string {
  return `${Math.min(countClues(game.clues), getTargetClueCount(soup.id))}/${getTargetClueCount(soup.id)}`
}

export function getSoupSolution(soup: Soup): string {
  return getSolution(soup.id)
}

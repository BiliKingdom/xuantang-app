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
  soupTitle?: string
  createdAt?: string
}

export type ProfileStats = {
  winRate: string
  gamesPlayed: string
  mvp: string
  favorites: string
  achievements: string
}

export type AchievementView = {
  id: string
  title: string
  description: string
  earned: boolean
  earnedAt?: string
}

export type GameHistoryItem = {
  id: string
  roomCode: string
  soupTitle: string
  status: RoomState['status']
  score?: number
  isCorrect?: boolean
  playedAt: string
}

type FavoriteRow = {
  soup_id: string
  soups: { slug: string } | Array<{ slug: string }> | null
}

type AchievementRow = {
  id: string
  title: string
  description: string
}

type UserAchievementRow = {
  achievement_id: string
  created_at: string
}

type GameGuessHistoryRow = {
  room_id: string
  score: number
  is_correct: boolean
  created_at: string
}

type RoomHistoryRow = {
  role: string
  joined_at: string
  rooms:
    | {
        id: string
        code: string
        status: RoomState['status']
        created_at: string
        finished_at: string | null
        soups: { title: string } | Array<{ title: string }> | null
      }
    | Array<{
        id: string
        code: string
        status: RoomState['status']
        created_at: string
        finished_at: string | null
        soups: { title: string } | Array<{ title: string }> | null
      }>
    | null
}

const localPostsKey = 'xuantang.localCommunityPosts'
const localFavoritesPrefix = 'xuantang.localFavorites.'
const localAchievementsPrefix = 'xuantang.localAchievements.'
const localHistoryPrefix = 'xuantang.localHistory.'

const fallbackAchievements: AchievementRow[] = [
  { id: 'first-game', title: '第一碗汤', description: '完成一次完整推理' },
  { id: 'first-win', title: '真相触达', description: '首次猜中汤底' },
  { id: 'clue-hunter', title: '线索猎手', description: '收齐一局关键线索' },
  { id: 'one-key-question', title: '神之一问', description: '提出 10 个关键问题' },
  { id: 'gold-host', title: '金牌煲汤人', description: '获得 5 次 MVP' },
  { id: 'collector', title: '向夜饮尽', description: '收藏 20 个汤底' },
]

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
    return [...readLocalJson<CommunityPost[]>(localPostsKey, []), ...[
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
    ]]
  }

  const client = requireSupabase()
  const { data, error } = await client
    .from('community_posts')
    .select('id,title,body,created_at,profiles(nickname),soups(title)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return data.map((post) => ({
    id: post.id,
    author: getNestedNickname(post.profiles) ?? '玄汤官方',
    title: post.title,
    text: post.body,
    stats: `${formatRelativeTime(post.created_at)} · 0 讨论`,
    soupTitle: getNestedTitle(post.soups),
    createdAt: post.created_at,
  }))
}

export async function createCommunityPost(
  profile: AuthProfile,
  soup: Soup,
  title: string,
  body: string,
): Promise<CommunityPost> {
  const cleanTitle = title.trim()
  const cleanBody = body.trim()

  if (cleanTitle.length < 2) throw new Error('标题至少需要 2 个字。')
  if (cleanBody.length < 6) throw new Error('正文至少需要 6 个字。')

  if (!isSupabaseConfigured || !soup.dbId) {
    const post: CommunityPost = {
      id: `local-post-${makeId()}`,
      author: profile.nickname,
      title: cleanTitle,
      text: cleanBody,
      stats: '刚刚 · 0 讨论',
      soupTitle: soup.title,
      createdAt: new Date().toISOString(),
    }
    const posts = readLocalJson<CommunityPost[]>(localPostsKey, [])
    writeLocalJson(localPostsKey, [post, ...posts].slice(0, 20))
    return post
  }

  const client = requireSupabase()
  const { data, error } = await client
    .from('community_posts')
    .insert({
      author_id: profile.id,
      soup_id: soup.dbId,
      title: cleanTitle,
      body: cleanBody,
    })
    .select('id,title,body,created_at,profiles(nickname),soups(title)')
    .single()

  if (error) throw error

  return {
    id: data.id,
    author: getNestedNickname(data.profiles) ?? profile.nickname,
    title: data.title,
    text: data.body,
    stats: '刚刚 · 0 讨论',
    soupTitle: getNestedTitle(data.soups) ?? soup.title,
    createdAt: data.created_at,
  }
}

export async function fetchProfileStats(profile: AuthProfile): Promise<ProfileStats> {
  if (!isSupabaseConfigured) {
    const favoriteCount = readLocalSet(localFavoritesPrefix + profile.id).size
    const achievementCount = readLocalSet(localAchievementsPrefix + profile.id).size

    return {
      winRate: '68%',
      gamesPlayed: '47',
      mvp: '6',
      favorites: String(favoriteCount),
      achievements: String(achievementCount),
    }
  }

  const client = requireSupabase()
  const [guessesResult, favoritesResult, achievementsResult] = await Promise.all([
    client.from('game_guesses').select('is_correct').eq('user_id', profile.id),
    client.from('favorites').select('soup_id').eq('user_id', profile.id),
    client.from('user_achievements').select('achievement_id').eq('user_id', profile.id),
  ])

  if (guessesResult.error) throw guessesResult.error
  if (favoritesResult.error) throw favoritesResult.error
  if (achievementsResult.error) throw achievementsResult.error

  const total = guessesResult.data.length
  const wins = guessesResult.data.filter((guess) => guess.is_correct).length

  return {
    winRate: total ? `${Math.round((wins / total) * 100)}%` : '0%',
    gamesPlayed: String(total),
    mvp: String(wins),
    favorites: String(favoritesResult.data.length),
    achievements: String(achievementsResult.data.length),
  }
}

export async function fetchFavoriteSoupIds(profile: AuthProfile, soupList: Soup[]): Promise<Set<string>> {
  if (!isSupabaseConfigured) {
    return readLocalSet(localFavoritesPrefix + profile.id)
  }

  const client = requireSupabase()
  const { data, error } = await client
    .from('favorites')
    .select('soup_id,soups(slug)')
    .eq('user_id', profile.id)

  if (error) throw error

  return new Set(
    (data as unknown as FavoriteRow[])
      .map((favorite) => getNestedSlug(favorite.soups) ?? soupList.find((soup) => soup.dbId === favorite.soup_id)?.id)
      .filter((id): id is string => Boolean(id)),
  )
}

export async function toggleFavoriteSoup(
  profile: AuthProfile,
  soup: Soup,
  shouldFavorite: boolean,
): Promise<void> {
  if (!isSupabaseConfigured || !soup.dbId) {
    const key = localFavoritesPrefix + profile.id
    const ids = readLocalSet(key)
    if (shouldFavorite) ids.add(soup.id)
    else ids.delete(soup.id)
    writeLocalSet(key, ids)
    return
  }

  const client = requireSupabase()

  if (shouldFavorite) {
    const { error } = await client
      .from('favorites')
      .upsert({ user_id: profile.id, soup_id: soup.dbId }, { onConflict: 'user_id,soup_id', ignoreDuplicates: true })
    if (error) throw error
    return
  }

  const { error } = await client
    .from('favorites')
    .delete()
    .eq('user_id', profile.id)
    .eq('soup_id', soup.dbId)

  if (error) throw error
}

export async function fetchAchievements(profile: AuthProfile): Promise<AchievementView[]> {
  if (!isSupabaseConfigured) {
    const earnedIds = readLocalSet(localAchievementsPrefix + profile.id)
    return fallbackAchievements.map((achievement) => ({
      ...achievement,
      earned: earnedIds.has(achievement.id),
    }))
  }

  const client = requireSupabase()
  const [achievementsResult, userAchievementsResult] = await Promise.all([
    client.from('achievements').select('id,title,description').order('id', { ascending: true }),
    client.from('user_achievements').select('achievement_id,created_at').eq('user_id', profile.id),
  ])

  if (achievementsResult.error) throw achievementsResult.error
  if (userAchievementsResult.error) throw userAchievementsResult.error

  const earned = new Map(
    (userAchievementsResult.data as UserAchievementRow[]).map((achievement) => [
      achievement.achievement_id,
      achievement.created_at,
    ]),
  )

  return (achievementsResult.data as AchievementRow[]).map((achievement) => ({
    ...achievement,
    earned: earned.has(achievement.id),
    earnedAt: earned.get(achievement.id),
  }))
}

export async function awardAchievements(profile: AuthProfile, ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)].filter(Boolean)
  if (!uniqueIds.length) return

  if (!isSupabaseConfigured) {
    const key = localAchievementsPrefix + profile.id
    const earned = readLocalSet(key)
    uniqueIds.forEach((id) => earned.add(id))
    writeLocalSet(key, earned)
    return
  }

  const client = requireSupabase()
  const { error } = await client
    .from('user_achievements')
    .upsert(
      uniqueIds.map((achievementId) => ({
        user_id: profile.id,
        achievement_id: achievementId,
      })),
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
    )

  if (error) throw error
}

export async function recordQuestionAchievements(
  profile: AuthProfile,
  game: GameState,
  soup: Soup,
): Promise<void> {
  const earned: string[] = []
  if (game.questions.length >= 10) earned.push('one-key-question')
  if (countClues(game.clues) >= getTargetClueCount(soup.id)) earned.push('clue-hunter')
  await awardAchievements(profile, earned)
}

export async function recordGameOutcome(
  profile: AuthProfile,
  room: RoomState,
  game: GameState,
  soup: Soup,
): Promise<void> {
  const earned = ['first-game']
  if (game.phase === 'revealed') earned.push('first-win')
  if (countClues(game.clues) >= getTargetClueCount(soup.id)) earned.push('clue-hunter')

  await awardAchievements(profile, earned)

  if (!isSupabaseConfigured || !room.cloudId) {
    const history = readLocalJson<GameHistoryItem[]>(localHistoryPrefix + profile.id, [])
    const nextItem: GameHistoryItem = {
      id: `local-history-${makeId()}`,
      roomCode: room.code,
      soupTitle: soup.title,
      status: room.status,
      score: game.score,
      isCorrect: game.phase === 'revealed',
      playedAt: new Date().toISOString(),
    }
    writeLocalJson(localHistoryPrefix + profile.id, [nextItem, ...history].slice(0, 12))
  }
}

export async function fetchGameHistory(profile: AuthProfile): Promise<GameHistoryItem[]> {
  if (!isSupabaseConfigured) {
    return readLocalJson<GameHistoryItem[]>(localHistoryPrefix + profile.id, [])
  }

  const client = requireSupabase()
  const [membershipsResult, guessesResult] = await Promise.all([
    client
      .from('room_members')
      .select('role,joined_at,rooms(id,code,status,created_at,finished_at,soups(title))')
      .eq('user_id', profile.id)
      .order('joined_at', { ascending: false })
      .limit(12),
    client
      .from('game_guesses')
      .select('room_id,score,is_correct,created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
  ])

  if (membershipsResult.error) throw membershipsResult.error
  if (guessesResult.error) throw guessesResult.error

  const guessesByRoom = new Map<string, GameGuessHistoryRow>()
  ;(guessesResult.data as GameGuessHistoryRow[]).forEach((guess) => {
    if (!guessesByRoom.has(guess.room_id)) guessesByRoom.set(guess.room_id, guess)
  })

  return (membershipsResult.data as unknown as RoomHistoryRow[]).reduce<GameHistoryItem[]>((items, membership) => {
    const room = getSingle(membership.rooms)
    if (!room) return items
    const guess = guessesByRoom.get(room.id)

    items.push({
        id: room.id,
        roomCode: room.code,
        soupTitle: getNestedTitle(room.soups) ?? '未知汤面',
        status: room.status,
        score: guess?.score,
        isCorrect: guess?.is_correct,
        playedAt: guess?.created_at ?? room.finished_at ?? room.created_at,
    })

    return items
  }, [])
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

function getNestedTitle(item: { title: string } | Array<{ title: string }> | null): string | undefined {
  if (!item) return undefined
  if (Array.isArray(item)) return item[0]?.title
  return item.title
}

function getNestedSlug(item: { slug: string } | Array<{ slug: string }> | null): string | undefined {
  if (!item) return undefined
  if (Array.isArray(item)) return item[0]?.slug
  return item.slug
}

function getSingle<T>(item: T | T[] | null): T | undefined {
  if (!item) return undefined
  if (Array.isArray(item)) return item[0]
  return item
}

function formatRelativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback

  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

function writeLocalJson<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function readLocalSet(key: string): Set<string> {
  return new Set(readLocalJson<string[]>(key, []))
}

function writeLocalSet(key: string, value: Set<string>): void {
  writeLocalJson(key, [...value])
}

function makeId(): string {
  if ('crypto' in globalThis && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getRoomProgressLabel(game: GameState, soup: Soup): string {
  return `${Math.min(countClues(game.clues), getTargetClueCount(soup.id))}/${getTargetClueCount(soup.id)}`
}

export function getSoupSolution(soup: Soup): string {
  return getSolution(soup.id)
}

export type Screen =
  | 'onboarding'
  | 'home'
  | 'library'
  | 'detail'
  | 'create'
  | 'waiting'
  | 'game'
  | 'clues'
  | 'guess'
  | 'reveal'
  | 'community'
  | 'profile'

export type Answer = '是' | '否' | '无关' | '部分正确' | '方向接近' | '无法回答'
export type ClueType = '人物' | '物品' | '时间线' | '动机'
export type GamePhase = 'asking' | 'guessing' | 'revealed'
export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type HostMode = 'AI 主持' | '房主主持'

export type Question = {
  id: number
  cloudId?: string
  asker: string
  text: string
  answer: Answer
  clueType?: ClueType
  clue?: string
}

export type ClueBoard = {
  people: string[]
  objects: string[]
  timeline: string[]
  motives: string[]
}

export type GameState = {
  phase: GamePhase
  soupId: string
  roomCode: string
  questions: Question[]
  clues: ClueBoard
  guess: string
  score: number
  lastAnswer?: Answer
  solution?: string
  targetClueCount?: number
  startedAt: number
  finishedAt?: number
}

export type SoupCategoryId = 'red' | 'black' | 'funny' | 'weird' | 'emotion' | 'clear'

export type Soup = {
  id: string
  dbId?: string
  title: string
  prompt: string
  tags: string[]
  categoryId?: SoupCategoryId | string
  categoryName?: string
  contentRating?: string
  sourceKind?: 'original' | 'licensed'
  difficulty: string
  duration: string
  rating: number
  players: string
  accent: 'cyan' | 'gold' | 'red' | 'violet' | 'green' | 'amber'
}

export type Player = {
  id: string
  userId?: string
  name: string
  role: '房主' | '玩家'
  ready: boolean
}

export type RoomSettings = {
  mode: HostMode
  maxPlayers: number
  questionLimit: '无限制' | '20问' | '30问'
  visibility: '本机可见' | '好友可见'
}

export type RoomState = {
  cloudId?: string
  code: string
  soupId: string
  hostName: string
  members: Player[]
  settings: RoomSettings
  status: RoomStatus
  createdAt: number
}

type AnswerRule = {
  keywords: string[]
  answer: Answer
  clueType?: ClueType
  clue?: string
}

export type SoupCase = {
  solution: string
  starterClues: ClueBoard
  targetClueCount: number
  answerKeywords: string[]
  rules: AnswerRule[]
}

export const soups: Soup[] = [
  {
    id: 'red-raincoat',
    title: '红雨衣',
    prompt: '雨一直下着，男孩穿着红雨衣站出门，再也没有回来。',
    tags: ['悬疑', '微恐', '15分钟'],
    categoryId: 'red',
    categoryName: '红汤',
    contentRating: '18+暗黑',
    sourceKind: 'original',
    difficulty: '普通',
    duration: '15分钟',
    rating: 4.8,
    players: '1-6人',
    accent: 'red',
  },
  {
    id: 'empty-mirror',
    title: '空镜子',
    prompt: '她每天对着镜子化妆，直到有天镜子里只剩房间。',
    tags: ['心理', '微恐', '20分钟'],
    categoryId: 'black',
    categoryName: '黑汤',
    contentRating: '18+暗黑',
    sourceKind: 'original',
    difficulty: '困难',
    duration: '20分钟',
    rating: 4.7,
    players: '2-8人',
    accent: 'gold',
  },
  {
    id: 'white-elevator',
    title: '白色电梯',
    prompt: '电梯停在不存在的楼层，所有人都说她迟到了。',
    tags: ['反转', '都市', '15分钟'],
    categoryId: 'black',
    categoryName: '黑汤',
    contentRating: '18+暗黑',
    sourceKind: 'original',
    difficulty: '普通',
    duration: '15分钟',
    rating: 4.6,
    players: '1-5人',
    accent: 'violet',
  },
  {
    id: 'no-coffee',
    title: '没有咖啡',
    prompt: '老板说咖啡售罄后，整条街的人都安静了下来。',
    tags: ['荒诞', '逻辑', '15分钟'],
    categoryId: 'funny',
    categoryName: '王八汤',
    contentRating: '16+荒诞',
    sourceKind: 'original',
    difficulty: '新手',
    duration: '15分钟',
    rating: 4.6,
    players: '1-4人',
    accent: 'green',
  },
  {
    id: 'vanished-dinner',
    title: '消失的晚餐',
    prompt: '一家人围坐在餐桌前，却没有人记得是谁做了晚餐。',
    tags: ['家庭', '暗黑', '20分钟'],
    categoryId: 'emotion',
    categoryName: '情感汤',
    contentRating: '18+暗黑',
    sourceKind: 'original',
    difficulty: '困难',
    duration: '20分钟',
    rating: 4.5,
    players: '3-8人',
    accent: 'amber',
  },
]

const emptyClues: ClueBoard = {
  people: [],
  objects: [],
  timeline: [],
  motives: [],
}

export const soupCases: Record<string, SoupCase> = {
  'red-raincoat': {
    solution:
      '男孩躲在衣柜里，用红雨衣伪装成离开的身影。真正走出门的人不是他，暴雨冲掉了脚印，也让家人错过了最后的线索。',
    starterClues: emptyClues,
    targetClueCount: 6,
    answerKeywords: ['男孩', '红雨衣', '躲', '衣柜', '出门', '暴雨', '脚印', '家人'],
    rules: [
      {
        keywords: ['男孩', '孩子', '小孩', '躲', '衣柜'],
        answer: '是',
        clueType: '人物',
        clue: '男孩主动藏了起来，家人看到的身影未必是他。',
      },
      {
        keywords: ['红雨衣', '雨衣', '衣服'],
        answer: '是',
        clueType: '物品',
        clue: '红雨衣遮住了体型和身份，是误认的关键。',
      },
      {
        keywords: ['雨', '暴雨', '脚印', '傍晚', '晚上', '时间'],
        answer: '部分正确',
        clueType: '时间线',
        clue: '暴雨让门口痕迹很快消失，时间判断被干扰。',
      },
      {
        keywords: ['家人', '父母', '妈妈', '爸爸', '误会'],
        answer: '部分正确',
        clueType: '动机',
        clue: '家人的判断来自他们看到的“红雨衣身影”。',
      },
      { keywords: ['死', '死亡', '杀', '伤害', '凶手'], answer: '否' },
      {
        keywords: ['逃', '离开', '出门', '门口'],
        answer: '是',
        clueType: '时间线',
        clue: '真正离开门口的人借暴雨完成了替换。',
      },
    ],
  },
  'empty-mirror': {
    solution:
      '镜子其实是一面双向镜。她以为自己每天面对镜子，另一侧的人却一直在观察她；那天人被带走后，镜面只映出空房间。',
    starterClues: emptyClues,
    targetClueCount: 5,
    answerKeywords: ['镜子', '双向镜', '观察', '房间', '带走', '化妆'],
    rules: [
      {
        keywords: ['镜子', '玻璃', '反光'],
        answer: '部分正确',
        clueType: '物品',
        clue: '那面“镜子”的作用不只是反射。',
      },
      {
        keywords: ['她', '女人', '化妆'],
        answer: '是',
        clueType: '人物',
        clue: '她一直相信自己只是独处。',
      },
      {
        keywords: ['房间', '空房间', '消失'],
        answer: '是',
        clueType: '时间线',
        clue: '房间变空发生在她被带离之后。',
      },
      {
        keywords: ['偷窥', '观察', '监视', '双向'],
        answer: '是',
        clueType: '动机',
        clue: '镜子的另一侧有人长期观察她。',
      },
    ],
  },
  'white-elevator': {
    solution:
      '所谓不存在的楼层是医院隔离层。她因事故昏迷错过了约定，醒来后所有人只记得她“迟到”，却没人愿意说出病房真相。',
    starterClues: emptyClues,
    targetClueCount: 5,
    answerKeywords: ['电梯', '楼层', '医院', '隔离', '昏迷', '迟到'],
    rules: [
      {
        keywords: ['电梯', '楼层', '按钮'],
        answer: '是',
        clueType: '物品',
        clue: '电梯可以到达普通访客看不到的楼层。',
      },
      {
        keywords: ['她', '迟到', '约定'],
        answer: '部分正确',
        clueType: '人物',
        clue: '她不是主观迟到，而是失去了那段时间。',
      },
      {
        keywords: ['医院', '病房', '昏迷', '事故'],
        answer: '是',
        clueType: '时间线',
        clue: '缺失的时间发生在一次医疗处置后。',
      },
      { keywords: ['鬼', '灵异', '死亡'], answer: '否' },
    ],
  },
  'no-coffee': {
    solution:
      '咖啡不是饮品，而是这条街地下广播的暗号。老板说“没有咖啡”代表行动取消，所以所有收到暗号的人同时沉默。',
    starterClues: emptyClues,
    targetClueCount: 4,
    answerKeywords: ['咖啡', '暗号', '老板', '街', '沉默', '取消'],
    rules: [
      {
        keywords: ['咖啡', '饮品', '售罄'],
        answer: '部分正确',
        clueType: '物品',
        clue: '咖啡这个词在故事里有第二层含义。',
      },
      {
        keywords: ['老板', '店员'],
        answer: '是',
        clueType: '人物',
        clue: '老板知道这句话会被特定的人听懂。',
      },
      {
        keywords: ['街', '安静', '沉默', '人群'],
        answer: '是',
        clueType: '动机',
        clue: '整条街的沉默来自同一个信号。',
      },
      {
        keywords: ['暗号', '行动', '取消', '广播'],
        answer: '是',
        clueType: '时间线',
        clue: '“没有咖啡”是行动取消的暗号。',
      },
    ],
  },
  'vanished-dinner': {
    solution:
      '晚餐是失踪的母亲提前做好的。家人被改写了当天记忆，只记得围坐吃饭，却忘了做饭的人已经不在餐桌旁。',
    starterClues: emptyClues,
    targetClueCount: 5,
    answerKeywords: ['晚餐', '母亲', '提前', '记忆', '家人', '餐桌'],
    rules: [
      {
        keywords: ['晚餐', '饭菜', '做饭'],
        answer: '是',
        clueType: '物品',
        clue: '晚餐真实存在，而且是在众人入座前完成的。',
      },
      {
        keywords: ['家人', '一家人', '餐桌'],
        answer: '部分正确',
        clueType: '人物',
        clue: '围坐的人并不完整，有一个关键位置被忽略了。',
      },
      {
        keywords: ['记得', '忘记', '记忆'],
        answer: '是',
        clueType: '动机',
        clue: '他们缺失的不是饭菜，而是关于做饭者的记忆。',
      },
      {
        keywords: ['母亲', '妈妈', '失踪'],
        answer: '是',
        clueType: '时间线',
        clue: '做饭的人在开饭前已经离开或失踪。',
      },
    ],
  },
}

export function getSoupById(id: string): Soup {
  return soups.find((soup) => soup.id === id) ?? soups[0]
}

export function getSoupCase(soupId: string): SoupCase {
  return soupCases[soupId] ?? soupCases[soups[0].id]
}

export function getSolution(soupId: string): string {
  return getSoupCase(soupId).solution
}

export function getTargetClueCount(soupId: string): number {
  return getSoupCase(soupId).targetClueCount
}

export function countClues(clues: ClueBoard): number {
  return clues.people.length + clues.objects.length + clues.timeline.length + clues.motives.length
}

export function createRoom(
  soup: Soup,
  hostName = '你',
  settings: Partial<RoomSettings> = {},
): RoomState {
  const cleanHost = normalizeName(hostName) || '你'
  const now = Date.now()

  return {
    code: generateRoomCode(soup.id, now),
    soupId: soup.id,
    hostName: cleanHost,
    members: [{ id: 'host', name: cleanHost, role: '房主', ready: true }],
    settings: {
      mode: settings.mode ?? 'AI 主持',
      maxPlayers: settings.maxPlayers ?? 6,
      questionLimit: settings.questionLimit ?? '无限制',
      visibility: settings.visibility ?? '本机可见',
    },
    status: 'waiting',
    createdAt: now,
  }
}

export function addLocalMember(room: RoomState, name: string): RoomState {
  const cleanName = normalizeName(name)

  if (!cleanName || room.members.some((member) => member.name === cleanName)) {
    return room
  }

  if (room.members.length >= room.settings.maxPlayers) {
    return room
  }

  return {
    ...room,
    members: [
      ...room.members,
      {
        id: `local-${room.members.length + 1}`,
        name: cleanName,
        role: '玩家',
        ready: true,
      },
    ],
  }
}

export function startRoom(room: RoomState): RoomState {
  return {
    ...room,
    status: 'playing',
  }
}

export function finishRoom(room: RoomState): RoomState {
  return {
    ...room,
    status: 'finished',
  }
}

export function createGameState(soup: Soup = soups[0], roomCode = 'SOLO'): GameState {
  const soupCase = getSoupCase(soup.id)

  return {
    phase: 'asking',
    soupId: soup.id,
    roomCode,
    questions: [],
    clues: cloneClues(soupCase.starterClues),
    guess: '',
    score: 0,
    solution: soupCase.solution,
    targetClueCount: soupCase.targetClueCount,
    startedAt: Date.now(),
  }
}

export function askQuestion(state: GameState, text: string, asker = '你'): GameState {
  const trimmed = text.trim()

  if (!trimmed || state.phase === 'revealed') {
    return state
  }

  const classified = classifyQuestion(state.soupId, trimmed)
  const question: Question = {
    id: state.questions.length + 1,
    asker,
    text: trimmed,
    ...classified,
  }

  return {
    ...state,
    phase: 'asking',
    lastAnswer: question.answer,
    questions: [...state.questions, question],
    clues: question.clueType && question.clue ? addClue(state.clues, question.clueType, question.clue) : state.clues,
  }
}

export function submitGuess(state: GameState, guess: string): GameState {
  const normalized = guess.trim()

  if (!normalized) {
    return {
      ...state,
      phase: 'guessing',
      guess: normalized,
      score: 0,
    }
  }

  const soupCase = getSoupCase(state.soupId)
  const hits = soupCase.answerKeywords.filter((word) => normalized.includes(word)).length
  const clueBonus = Math.min(12, countClues(state.clues) * 2)
  const score = Math.min(96, 34 + hits * 10 + clueBonus)
  const revealed = score >= 72

  return {
    ...state,
    phase: revealed ? 'revealed' : 'guessing',
    guess: normalized,
    score,
    finishedAt: revealed ? Date.now() : state.finishedAt,
  }
}

export function classifyQuestion(soupId: string, text: string): Pick<Question, 'answer' | 'clueType' | 'clue'> {
  const rule = getSoupCase(soupId).rules.find((item) => item.keywords.some((keyword) => text.includes(keyword)))

  if (rule) {
    return {
      answer: rule.answer,
      clueType: rule.clueType,
      clue: rule.clue,
    }
  }

  if (text.includes('吗') || text.includes('是不是') || text.includes('是否')) {
    return { answer: '方向接近' }
  }

  return { answer: '无法回答' }
}

function addClue(clues: ClueBoard, clueType: ClueType, clue: string): ClueBoard {
  const next = cloneClues(clues)
  const key = clueTypeToKey(clueType)

  if (!next[key].includes(clue)) {
    next[key].push(clue)
  }

  return next
}

function clueTypeToKey(clueType: ClueType): keyof ClueBoard {
  if (clueType === '人物') return 'people'
  if (clueType === '物品') return 'objects'
  if (clueType === '时间线') return 'timeline'
  return 'motives'
}

function cloneClues(clues: ClueBoard): ClueBoard {
  return {
    people: [...clues.people],
    objects: [...clues.objects],
    timeline: [...clues.timeline],
    motives: [...clues.motives],
  }
}

function normalizeName(name: string): string {
  return name.trim().slice(0, 8)
}

function generateRoomCode(seed: string, createdAt: number): string {
  const source = `${seed}-${createdAt}`
  let hash = 0

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0
  }

  return hash.toString(36).toUpperCase().slice(0, 4).padStart(4, 'X')
}

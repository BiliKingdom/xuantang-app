import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Bot,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Crown,
  DoorOpen,
  Heart,
  Home,
  KeyRound,
  Library,
  ListChecks,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react'
import rainTextureUrl from './assets/cyber-rain-texture.webp'
import raincoatUrl from './assets/red-raincoat-cyber.webp'
import './App.css'
import {
  countClues,
  createGameState,
  getSolution,
  getTargetClueCount,
  soups,
  type GameState,
  type HostMode,
  type Question,
  type RoomState,
  type Screen,
  type Soup,
} from './appModel'
import { getCurrentProfile, onAuthStateChange, signIn, signOut, signUp, type AuthProfile } from './features/auth/authService'
import {
  askQuestion,
  createGame,
  createRoom,
  fetchCommunityPosts,
  fetchProfileStats,
  fetchSoups,
  joinRoomByCode,
  loadRoomSnapshot,
  startRoom,
  submitGuess,
  type CommunityPost,
  type ProfileStats,
} from './features/game/api'
import { subscribeToRoom } from './features/game/realtime'
import { isSupabaseConfigured } from './lib/supabase'

const screenTitles: Record<Screen, string> = {
  onboarding: '玄汤',
  home: '玄汤',
  library: '汤库',
  detail: '红雨衣',
  create: '创建房间',
  waiting: '房间',
  game: '对局中',
  clues: '线索板',
  guess: '猜汤底',
  reveal: '复盘揭晓',
  community: '汤帖社区',
  profile: '我的',
}

const answerLabels = ['是', '否', '无关', '部分正确'] as const

const members = [
  { name: '你', role: '房主', tone: 'gold' },
  { name: '阿默', role: '侦探', tone: 'violet' },
  { name: 'Mia', role: '记录', tone: 'cyan' },
  { name: '七月', role: '观察', tone: 'red' },
  { name: '白茶', role: '推理', tone: 'green' },
  { name: '小北', role: '新手', tone: 'amber' },
]

const tabs: Array<{ screen: Screen; label: string; icon: LucideIcon }> = [
  { screen: 'home', label: '首页', icon: Home },
  { screen: 'library', label: '汤库', icon: Library },
  { screen: 'community', label: '社区', icon: MessageCircle },
  { screen: 'profile', label: '我的', icon: UserRound },
]

const backTarget: Partial<Record<Screen, Screen>> = {
  detail: 'home',
  create: 'detail',
  waiting: 'create',
  game: 'waiting',
  clues: 'game',
  guess: 'game',
  reveal: 'home',
}

function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [availableSoups, setAvailableSoups] = useState<Soup[]>(soups)
  const [activeSoup, setActiveSoup] = useState<Soup>(soups[0])
  const [game, setGame] = useState<GameState>(() => createGameState())
  const [room, setRoom] = useState<RoomState>()
  const [hostName, setHostName] = useState('夜饮尽')
  const [joinName, setJoinName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinNotice, setJoinNotice] = useState('')
  const [roomMode, setRoomMode] = useState<HostMode>('AI 主持')
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [question, setQuestion] = useState('')
  const [guess, setGuess] = useState('')
  const [guessNotice, setGuessNotice] = useState('')
  const [busyMessage, setBusyMessage] = useState('')
  const [showBoot, setShowBoot] = useState(true)
  const activeTab = tabs.some((tab) => tab.screen === screen) ? screen : undefined
  const title =
    screen === 'detail'
      ? activeSoup.title
      : screen === 'waiting' && room
        ? `房间 ${room.code}`
        : screenTitles[screen]

  useEffect(() => {
    const timer = window.setTimeout(() => setShowBoot(false), 850)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let alive = true

    void getCurrentProfile()
      .then((nextProfile) => {
        if (!alive) return
        setProfile(nextProfile)
        if (nextProfile) {
          setHostName(nextProfile.nickname)
        }
      })
      .catch((error: unknown) => {
        if (alive) setAuthError(getErrorMessage(error))
      })
      .finally(() => {
        if (alive) setAuthLoading(false)
      })

    const unsubscribe = onAuthStateChange((nextProfile) => {
      setProfile(nextProfile)
      if (nextProfile) {
        setHostName(nextProfile.nickname)
      }
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!profile) return

    let alive = true

    void fetchSoups()
      .then((items) => {
        if (!alive) return
        setAvailableSoups(items)
        setActiveSoup((current) => items.find((item) => item.id === current.id) ?? items[0] ?? current)
      })
      .catch((error: unknown) => setBusyMessage(getErrorMessage(error)))

    return () => {
      alive = false
    }
  }, [profile])

  useEffect(() => {
    if (!room?.cloudId) return

    return subscribeToRoom(room, () => {
      void loadRoomSnapshot(room.cloudId!, activeSoup)
        .then((snapshot) => {
          setRoom(snapshot.room)
          setGame(snapshot.game)
          setActiveSoup(snapshot.soup)
        })
        .catch((error: unknown) => setBusyMessage(getErrorMessage(error)))
    })
  }, [activeSoup, room])

  function go(next: Screen) {
    setScreen(next)
  }

  function openSoup(soup: Soup) {
    setActiveSoup(soup)
    go('detail')
  }

  async function createLocalRoom() {
    if (!profile) return
    setBusyMessage('正在创建房间...')

    try {
      const nextRoom = await createRoom(activeSoup, { ...profile, nickname: hostName }, roomMode, maxPlayers)
      setRoom(nextRoom)
      setJoinName('')
      setJoinCode(nextRoom.code)
      go('waiting')
      setBusyMessage('')
    } catch (error) {
      setBusyMessage(getErrorMessage(error))
    }
  }

  async function openLocalLobby() {
    if (room) {
      go('waiting')
      return
    }

    await createLocalRoom()
  }

  async function joinLocalRoom() {
    if (!profile) return

    try {
      const nextRoom = await joinRoomByCode(room?.code ?? joinCode, room, profile, joinName)
      const joinedSoup = availableSoups.find((item) => item.id === nextRoom.soupId) ?? activeSoup
      setRoom(nextRoom)
      setActiveSoup(joinedSoup)

      setJoinName('')
      setJoinNotice('')
    } catch (error) {
      setJoinNotice(getErrorMessage(error))
    }
  }

  async function startSoloGame() {
    if (!profile) return

    try {
      const nextRoom = await createRoom(activeSoup, { ...profile, nickname: hostName }, 'AI 主持', 1)
      const playingRoom = await startRoom(nextRoom)
      const nextGame = await createGame(playingRoom, activeSoup)
      setRoom(playingRoom)
      setGame(nextGame)
      setQuestion('')
      setGuess('')
      setGuessNotice('')
      go('game')
    } catch (error) {
      setBusyMessage(getErrorMessage(error))
    }
  }

  async function startRoomGame() {
    if (!profile) return

    try {
      const waitingRoom = room ?? (await createRoom(activeSoup, { ...profile, nickname: hostName }, roomMode, maxPlayers))
      const nextRoom = await startRoom(waitingRoom)
      const nextGame = await createGame(nextRoom, activeSoup)
      setRoom(nextRoom)
      setGame(nextGame)
      setQuestion('')
      setGuess('')
      setGuessNotice('')
      go('game')
    } catch (error) {
      setBusyMessage(getErrorMessage(error))
    }
  }

  async function handleAsk() {
    if (!profile || !room) return

    try {
      const next = await askQuestion(room, game, question, profile)
      setGame(next)
      setQuestion('')
    } catch (error) {
      setBusyMessage(getErrorMessage(error))
    }
  }

  async function handleGuessSubmit() {
    if (!room) return

    if (!guess.trim()) {
      setGuessNotice('先写下你的汤底推理，再提交。')
      return
    }

    try {
      const next = await submitGuess(room, game, guess)
      setRoom(next.room)
      setGame(next.game)
      setGuess(next.game.guess)

      if (next.game.phase === 'revealed') {
        setGuessNotice('')
        go('reveal')
      } else {
        setGuessNotice(`相似度 ${next.game.score}%，还差关键线索。可以返回继续提问。`)
      }
    } catch (error) {
      setGuessNotice(getErrorMessage(error))
    }
  }

  async function handleSignOut() {
    await signOut()
    setProfile(null)
    setRoom(undefined)
    setGame(createGameState())
    setScreen('onboarding')
  }

  if (authLoading) {
    return <LoadingScreen label="正在校验登录状态..." />
  }

  if (!profile) {
    return (
      <AuthScreen
        initialError={authError}
        onSignedIn={(nextProfile) => {
          setProfile(nextProfile)
          setHostName(nextProfile.nickname)
        }}
      />
    )
  }

  return (
    <main
      className="app-stage"
      style={{ '--rain-texture': `url(${rainTextureUrl})` } as CSSProperties}
    >
      <div className="ambient-field" aria-hidden="true" />
      <section className="app-shell" aria-label="玄汤 App 原型">
        {showBoot && <BootOverlay />}
        {screen !== 'onboarding' && (
          <AppTopBar
            title={title}
            canBack={Boolean(backTarget[screen])}
            actionIcon={screen === 'game' ? ListChecks : screen === 'profile' ? Settings : Bell}
            onBack={() => go(backTarget[screen] ?? 'home')}
            onAction={() => (screen === 'game' ? go('clues') : undefined)}
          />
        )}
        <div className={`screen screen-${screen}`} data-testid="screen">
          {screen === 'onboarding' && <Onboarding onStart={() => go('home')} />}
          {screen === 'home' && (
            <HomeScreen
              soup={activeSoup}
              soups={availableSoups}
              room={room}
              joinCode={joinCode}
              joinNotice={joinNotice}
              onJoinCodeChange={(value) => {
                setJoinCode(value.toUpperCase())
                setJoinNotice('')
              }}
              onOpenSoup={openSoup}
              onCreate={() => go('create')}
              onWaiting={() => void openLocalLobby()}
              onJoinByCode={() => void joinLocalRoom()}
            />
          )}
          {screen === 'library' && <LibraryScreen soups={availableSoups} activeSoup={activeSoup} onOpenSoup={openSoup} />}
          {screen === 'detail' && (
            <DetailScreen soup={activeSoup} onCreate={() => go('create')} onSolo={startSoloGame} />
          )}
          {screen === 'create' && (
            <CreateRoomScreen
              soup={activeSoup}
              hostName={hostName}
              mode={roomMode}
              maxPlayers={maxPlayers}
              onHostNameChange={setHostName}
              onModeChange={setRoomMode}
              onMaxPlayersChange={setMaxPlayers}
              onCreate={() => void createLocalRoom()}
            />
          )}
          {screen === 'waiting' && (
            <WaitingRoomScreen
              room={room}
              soup={activeSoup}
              joinName={joinName}
              onJoinNameChange={setJoinName}
              onJoin={() => void joinLocalRoom()}
              onStart={() => void startRoomGame()}
            />
          )}
          {screen === 'game' && (
            <GameScreen
              game={game}
              soup={activeSoup}
              room={room}
              question={question}
              onQuestionChange={setQuestion}
              onAsk={() => void handleAsk()}
              onClues={() => go('clues')}
              onGuess={() => go('guess')}
            />
          )}
          {screen === 'clues' && <ClueBoardScreen game={game} soup={activeSoup} onGuess={() => go('guess')} />}
          {screen === 'guess' && (
            <GuessScreen
              guess={guess}
              notice={guessNotice}
              onGuessChange={(value) => {
                setGuess(value)
                setGuessNotice('')
              }}
              onSubmit={() => void handleGuessSubmit()}
            />
          )}
          {screen === 'reveal' && <RevealScreen game={game} soup={activeSoup} room={room} onHome={() => go('home')} />}
          {screen === 'community' && <CommunityScreen />}
          {screen === 'profile' && <ProfileScreen profile={profile} onSignOut={() => void handleSignOut()} />}
        </div>
        {busyMessage && <div className="toast-notice">{busyMessage}</div>}
        {activeTab && <BottomNav active={activeTab} onSelect={go} />}
      </section>
    </main>
  )
}

function BootOverlay() {
  return (
    <div className="boot-overlay" aria-hidden="true">
      <BrandMark large />
      <strong>玄汤</strong>
      <span>正在扫描汤面...</span>
      <i />
    </div>
  )
}

function AppTopBar({
  title,
  canBack,
  actionIcon: ActionIcon,
  onBack,
  onAction,
}: {
  title: string
  canBack: boolean
  actionIcon: LucideIcon
  onBack: () => void
  onAction?: () => void
}) {
  return (
    <header className="top-bar">
      <button
        className="icon-btn ghost"
        type="button"
        onClick={onBack}
        aria-label={canBack ? '返回' : '占位'}
        disabled={!canBack}
      >
        {canBack && <ArrowLeft size={20} />}
      </button>
      <h1>{title}</h1>
      <button className="icon-btn" type="button" onClick={onAction} aria-label="页面操作">
        <ActionIcon size={19} />
      </button>
    </header>
  )
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="app-stage" style={{ '--rain-texture': `url(${rainTextureUrl})` } as CSSProperties}>
      <div className="ambient-field" aria-hidden="true" />
      <section className="app-shell auth-shell" aria-label="玄汤加载中">
        <BrandMark large />
        <strong>玄汤</strong>
        <span>{label}</span>
      </section>
    </main>
  )
}

function AuthScreen({
  initialError,
  onSignedIn,
}: {
  initialError: string
  onSignedIn: (profile: AuthProfile) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('夜饮尽')
  const [message, setMessage] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    setMessage('')

    try {
      const nextProfile =
        mode === 'register'
          ? await signUp(email, password, nickname)
          : await signIn(email, password)

      if (!nextProfile) {
        setMessage('注册成功。请检查邮箱确认后再登录。')
        setMode('login')
        return
      }

      onSignedIn(nextProfile)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-stage" style={{ '--rain-texture': `url(${rainTextureUrl})` } as CSSProperties}>
      <div className="ambient-field" aria-hidden="true" />
      <section className="app-shell auth-shell" aria-label="玄汤登录">
        <div className="brand-lockup">
          <BrandMark />
          <span>SOUP MYSTERY GAME</span>
        </div>
        <section className="auth-panel scan-panel">
          <HeroArt compact />
          <h1>{mode === 'login' ? '登录玄汤' : '创建账号'}</h1>
          <p>{isSupabaseConfigured ? '登录后可创建云端房间并跨设备联机。' : '当前未配置 Supabase，已启用本地开发登录。'}</p>
          <label className="field-control">
            <span>邮箱</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field-control">
            <span>密码</span>
            <input
              value={password}
              type="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位"
            />
          </label>
          {mode === 'register' && (
            <label className="field-control">
              <span>昵称</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={8} />
            </label>
          )}
          {message && <p className="form-notice">{message}</p>}
          <button className="primary-btn" type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
          <button
            className="secondary-btn full"
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setMessage('')
            }}
          >
            {mode === 'login' ? '没有账号，去注册' : '已有账号，去登录'}
          </button>
        </section>
      </section>
    </main>
  )
}

function Onboarding({ onStart }: { onStart: () => void }) {
  return (
    <div className="onboarding">
      <div className="brand-lockup">
        <BrandMark />
        <span>SOUP MYSTERY GAME</span>
      </div>
      <HeroArt className="onboarding-art" />
      <section className="onboarding-copy">
        <h2>玄汤</h2>
        <p>一碗汤里的真相</p>
        <span>只问是与否，沿着线索喝到底。</span>
      </section>
      <div className="onboarding-actions">
        <button className="primary-btn" type="button" onClick={onStart}>
          开始推理
        </button>
        <button className="secondary-btn" type="button" onClick={onStart}>
          查看今日汤单
        </button>
      </div>
    </div>
  )
}

function HomeScreen({
  soup,
  soups: soupList,
  room,
  joinCode,
  joinNotice,
  onJoinCodeChange,
  onOpenSoup,
  onCreate,
  onWaiting,
  onJoinByCode,
}: {
  soup: Soup
  soups: Soup[]
  room?: RoomState
  joinCode: string
  joinNotice: string
  onJoinCodeChange: (value: string) => void
  onOpenSoup: (soup: Soup) => void
  onCreate: () => void
  onWaiting: () => void
  onJoinByCode: () => void
}) {
  const roomSoup = room ? (soupList.find((item) => item.id === room.soupId) ?? soup) : soup

  return (
    <ScrollView>
      <section className="home-hero">
        <div>
          <span className="scan-label">DEDUCTION ONLINE</span>
          <h2>今晚喝哪一碗？</h2>
          <p>精选汤面、实时房间、AI 主持都已就绪。</p>
        </div>
      </section>

      <button className="featured-soup reveal-card" type="button" onClick={() => onOpenSoup(soup)}>
        <HeroArt compact />
        <div className="featured-copy">
          <span className="mini-label">今日精选汤</span>
          <strong>{soup.title}</strong>
          <p>{soup.prompt}</p>
          <div className="meta-row">
            <Chip label={soup.difficulty} />
            <Rating value={soup.rating} />
            <span>{soup.duration}</span>
          </div>
        </div>
      </button>

      <div className="quick-grid">
        <ActionTile icon={Compass} title="快速加入" text="输入房间码入局" onClick={onWaiting} />
        <ActionTile icon={DoorOpen} title="创建房间" text="与好友一起喝汤" onClick={onCreate} />
      </div>

      <section className="quick-join-card">
        <input
          value={joinCode}
          onChange={(event) => onJoinCodeChange(event.target.value)}
          maxLength={4}
          placeholder="输入 4 位房间码"
        />
        <button className="secondary-btn compact" type="button" onClick={onJoinByCode}>
          加入
        </button>
        {joinNotice && <p>{joinNotice}</p>}
      </section>

      <section className="section-block">
        <SectionTitle title="正在进行" action="一键围观" />
        <button className="live-room" type="button" onClick={onWaiting}>
          <Avatar name="阿鸦" tone="gold" />
          <div>
            <strong>{room ? `房间 ${room.code}` : '本机快速房'}</strong>
            <span>
              {room
                ? `${room.members.length}/${room.settings.maxPlayers}人 · 正在讨论${roomSoup.title}`
                : `创建后直接测试 ${roomSoup.title}`}
            </span>
          </div>
          <span className="join-pill">{room ? '继续' : '开启'}</span>
        </button>
      </section>

      <section className="section-block">
        <SectionTitle title="为你推荐" action="换一批" />
        <div className="recommend-list">
          {soupList.slice(1, 4).map((item) => (
            <SoupRow key={item.id} soup={item} onOpen={() => onOpenSoup(item)} compact />
          ))}
        </div>
      </section>
    </ScrollView>
  )
}

function LibraryScreen({
  soups: soupList,
  activeSoup,
  onOpenSoup,
}: {
  soups: Soup[]
  activeSoup: Soup
  onOpenSoup: (soup: Soup) => void
}) {
  const filters = ['全部', '微恐', '15分钟', '悬疑', '热门']

  return (
    <ScrollView>
      <div className="search-field">
        <Search size={16} />
        <span>搜索汤名、标签、作者</span>
      </div>
      <div className="filter-row">
        {filters.map((filter, index) => (
          <button className={`filter-chip ${index === 0 ? 'active' : ''}`} type="button" key={filter}>
            {filter}
          </button>
        ))}
      </div>
      <div className="soup-list">
        {soupList.map((soup) => (
          <SoupRow
            key={soup.id}
            soup={soup}
            active={soup.id === activeSoup.id}
            onOpen={() => onOpenSoup(soup)}
          />
        ))}
      </div>
    </ScrollView>
  )
}

function DetailScreen({
  soup,
  onCreate,
  onSolo,
}: {
  soup: Soup
  onCreate: () => void
  onSolo: () => void
}) {
  return (
    <ScrollView>
      <HeroArt className="detail-visual" />
      <div className="detail-title">
        <span className="scan-label">CASE FILE 017</span>
        <h2>{soup.title}</h2>
        <div className="stars">
          {'★★★★★'}
          <span>{soup.rating}</span>
        </div>
      </div>

      <section className="story-panel scan-panel">
        <span className="mini-label">汤面</span>
        <p>{soup.prompt}</p>
        <button className="text-link" type="button">
          展开 <ChevronRight size={13} />
        </button>
      </section>

      <section className="entry-section">
        <p className="section-heading">玩法入口</p>
        <div className="entry-grid">
          <button className="mode-card active" type="button" onClick={onSolo}>
            <Bot size={20} />
            <strong>单人推理</strong>
            <span>独自挑战汤底</span>
          </button>
          <button className="mode-card" type="button" onClick={onCreate}>
            <Users size={20} />
            <strong>邀请好友</strong>
            <span>一起进入房间</span>
          </button>
        </div>
      </section>

      <section className="info-card">
        <div>
          <span>作者</span>
          <strong>玄汤官方</strong>
        </div>
        <div>
          <span>已被</span>
          <strong>1.2k 位侦探挑战</strong>
        </div>
        <Heart size={20} />
      </section>
    </ScrollView>
  )
}

function CreateRoomScreen({
  soup,
  hostName,
  mode,
  maxPlayers,
  onHostNameChange,
  onModeChange,
  onMaxPlayersChange,
  onCreate,
}: {
  soup: Soup
  hostName: string
  mode: HostMode
  maxPlayers: number
  onHostNameChange: (value: string) => void
  onModeChange: (value: HostMode) => void
  onMaxPlayersChange: (value: number) => void
  onCreate: () => void
}) {
  const playerOptions = [1, 4, 6, 8]

  return (
    <ScrollView
      footer={
        <button className="primary-btn sticky-action" type="button" onClick={onCreate}>
          生成房间
        </button>
      }
    >
      <section className="selection-card scan-panel">
        <span className="mini-label">汤底</span>
        <div className="selected-soup">
          <SoupBadge tone={soup.accent} />
          <strong>{soup.title}</strong>
          <button type="button">更换</button>
        </div>
      </section>

      <section className="settings-card">
        <p className="section-heading">房主</p>
        <label className="field-control">
          <span>昵称</span>
          <input
            value={hostName}
            onChange={(event) => onHostNameChange(event.target.value)}
            maxLength={8}
            placeholder="输入房主昵称"
          />
        </label>
      </section>

      <section className="settings-card">
        <p className="section-heading">模式</p>
        <RadioOption
          active={mode === 'AI 主持'}
          icon={Bot}
          title="AI 主持"
          text="按汤底规则自动回复"
          onClick={() => onModeChange('AI 主持')}
        />
        <RadioOption
          active={mode === '房主主持'}
          icon={BookOpen}
          title="房主主持"
          text="房主按规则人工回答"
          onClick={() => onModeChange('房主主持')}
        />
      </section>

      <section className="settings-card">
        <p className="section-heading">房间设置</p>
        <div className="segmented-control" aria-label="人数上限">
          {playerOptions.map((option) => (
            <button
              className={option === maxPlayers ? 'active' : ''}
              type="button"
              key={option}
              onClick={() => onMaxPlayersChange(option)}
            >
              {option}人
            </button>
          ))}
        </div>
        <SettingRow label="可见范围" value="本机可见" />
        <SettingRow label="提问限制" value="无限制" />
        <SettingRow label="验证保护" value={mode === 'AI 主持' ? '规则托管' : '房主确认'} />
      </section>
    </ScrollView>
  )
}

function WaitingRoomScreen({
  room,
  soup,
  joinName,
  onJoinNameChange,
  onJoin,
  onStart,
}: {
  room?: RoomState
  soup: Soup
  joinName: string
  onJoinNameChange: (value: string) => void
  onJoin: () => void
  onStart: () => void
}) {
  const seats = room ? Array.from({ length: Math.max(0, room.settings.maxPlayers - room.members.length) }) : []

  return (
    <ScrollView>
      <section className="waiting-head">
        <div>
          <span className="scan-label">ROOM ACCESS</span>
          <h2>房间 {room?.code ?? '生成中'}</h2>
          <p>
            {soup.title} · {room?.settings.mode ?? 'AI 主持'} · {room?.members.length ?? 1}/
            {room?.settings.maxPlayers ?? 6}人
          </p>
        </div>
        <button className="primary-btn small" type="button" onClick={onStart}>
          开始游戏
        </button>
      </section>

      <section className="room-code-card scan-panel">
        <span>本机房间码</span>
        <strong>{room?.code ?? '----'}</strong>
        <p>同一台电脑可连续加入本机玩家完成一局测试。</p>
      </section>

      <section className="local-join">
        <input
          value={joinName}
          onChange={(event) => onJoinNameChange(event.target.value)}
          maxLength={8}
          placeholder="本机玩家昵称"
        />
        <button className="secondary-btn compact" type="button" onClick={onJoin}>
          本机加入
        </button>
      </section>

      <div className="member-grid">
        {(room?.members ?? members.slice(0, 1)).map((member) => (
          <div className="member-card" key={member.name}>
            <Avatar name={member.name} tone={member.role === '房主' ? 'gold' : 'cyan'} />
            <strong>{member.name}</strong>
            <span>{member.role}</span>
          </div>
        ))}
        {seats.map((_, index) => (
          <div className="member-card invite" key={`seat-${index + 1}`}>
            <Plus size={20} />
            <strong>空位</strong>
            <span>可加入</span>
          </div>
        ))}
      </div>
      <section className="settings-card waiting-settings">
        <SettingRow label="汤底" value={soup.title} />
        <SettingRow label="提问限制" value={room?.settings.questionLimit ?? '无限制'} />
        <SettingRow label="主持" value={room?.settings.mode ?? 'AI 主持'} />
      </section>
    </ScrollView>
  )
}

function GameScreen({
  game,
  soup,
  room,
  question,
  onQuestionChange,
  onAsk,
  onClues,
  onGuess,
}: {
  game: GameState
  soup: Soup
  room?: RoomState
  question: string
  onQuestionChange: (value: string) => void
  onAsk: () => void
  onClues: () => void
  onGuess: () => void
}) {
  return (
    <div className="game-layout">
      <section className="game-status">
        <span>
          {room?.code ?? game.roomCode} · {game.questions.length}问 · {countClues(game.clues)}条线索
        </span>
        <strong>{soup.title}</strong>
      </section>

      <section className="story-panel compact-story scan-panel">
        <p>{soup.prompt}</p>
      </section>

      <section className="answer-panel">
        <p className="section-heading">回答结果 {game.lastAnswer ? `· 最近：${game.lastAnswer}` : '· 等待第一问'}</p>
        <div className="answer-row">
          {answerLabels.map((answer) => (
            <button
              className={answer === game.lastAnswer ? 'answer-chip active' : 'answer-chip'}
              type="button"
              key={answer}
            >
              {answer}
            </button>
          ))}
        </div>
      </section>

      <section className="question-log">
        <p className="section-heading">提问记录</p>
        {game.questions.length === 0 ? (
          <p className="empty-state">还没有提问。输入一个只能回答“是/否/无关”的问题开始推理。</p>
        ) : (
          game.questions.slice(-5).map((item) => <QuestionRow key={item.id} question={item} />)
        )}
      </section>

      <div className="game-actions">
        <button className="secondary-btn compact" type="button" onClick={onClues}>
          <ListChecks size={16} />
          线索板
        </button>
        <button className="secondary-btn compact" type="button" onClick={onGuess}>
          <KeyRound size={16} />
          猜汤底
        </button>
      </div>

      <div className="question-input">
        <input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onAsk()
          }}
          maxLength={30}
          placeholder="请输入你的问题（限 30 字以内）"
        />
        <button className="send-btn" type="button" onClick={onAsk} aria-label="发送问题">
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}

function ClueBoardScreen({ game, soup, onGuess }: { game: GameState; soup: Soup; onGuess: () => void }) {
  const collected = countClues(game.clues)
  const target = getTargetClueCount(soup.id)

  return (
    <ScrollView
      footer={
        <button className="primary-btn sticky-action" type="button" onClick={onGuess}>
          提交线索 / 猜汤进度
        </button>
      }
    >
      <div className="progress-line">
        <span>已收集 {collected} 条线索</span>
        <strong>
          {Math.min(collected, target)}/{target}
        </strong>
      </div>
      <ClueSection icon={Users} title="人物" items={game.clues.people} />
      <ClueSection icon={Lock} title="物品" items={game.clues.objects} />
      <ClueSection icon={Clock3} title="时间线" items={game.clues.timeline} />
      <ClueSection icon={ShieldCheck} title="动机" items={game.clues.motives} />
    </ScrollView>
  )
}

function GuessScreen({
  guess,
  notice,
  onGuessChange,
  onSubmit,
}: {
  guess: string
  notice: string
  onGuessChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <ScrollView
      footer={
        <button className="primary-btn sticky-action" type="button" onClick={onSubmit}>
          提交猜测
        </button>
      }
    >
      <div className="guess-symbol">
        <BrandMark large />
      </div>
      <section className="guess-card">
        <h2>你的猜测是？</h2>
        <textarea
          value={guess}
          onChange={(event) => onGuessChange(event.target.value)}
          placeholder="输入你认为的汤底真相..."
          maxLength={90}
        />
        <span>{guess.length}/90</span>
        {notice && <p className="form-notice">{notice}</p>}
      </section>
      <section className="rules-card">
        <p className="section-heading">规则</p>
        <p>请尽量完整描述人物关系、关键物品和事件顺序。</p>
        <p>只有接近真相的答案会进入复盘揭晓。</p>
      </section>
    </ScrollView>
  )
}

function RevealScreen({
  game,
  soup,
  room,
  onHome,
}: {
  game: GameState
  soup: Soup
  room?: RoomState
  onHome: () => void
}) {
  const collected = countClues(game.clues)
  const target = getTargetClueCount(soup.id)
  const stats = useMemo(
    () => [
      { label: '关键线索', value: `${Math.min(collected, target)}/${target}` },
      { label: '提问轮数', value: String(game.questions.length) },
      { label: '相似度', value: `${game.score}%` },
    ],
    [collected, game.questions.length, game.score, target],
  )

  return (
    <ScrollView
      footer={
        <button className="primary-btn sticky-action" type="button" onClick={onHome}>
          返回房间大厅
        </button>
      }
    >
      <div className="reveal-hero">
        <Trophy size={54} />
        <h2>真相揭晓</h2>
        <span>
          {room?.code ?? game.roomCode} · {soup.title}
        </span>
      </div>
      <section className="truth-card scan-panel">
        <p className="section-heading">真相解析</p>
        <p>{getSolution(soup.id)}</p>
      </section>
      <section className="truth-card player-guess">
        <p className="section-heading">你的汤底</p>
        <p>{game.guess}</p>
      </section>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      <button className="secondary-btn full" type="button">
        <Share2 size={16} />
        分享给好友
      </button>
    </ScrollView>
  )
}

function CommunityScreen() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true

    void fetchCommunityPosts()
      .then((items) => {
        if (alive) setPosts(items)
      })
      .catch((error: unknown) => {
        if (alive) setMessage(getErrorMessage(error))
      })

    return () => {
      alive = false
    }
  }, [])

  return (
    <ScrollView>
      <div className="community-tabs">
        {['推荐', '最新', '关注'].map((tab, index) => (
          <button className={index === 0 ? 'active' : ''} type="button" key={tab}>
            {tab}
          </button>
        ))}
      </div>
      {message && <p className="empty-state">{message}</p>}
      <div className="post-list">
        {posts.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="post-head">
              <Avatar name={post.author.slice(0, 2)} tone="cyan" />
              <div>
                <strong>{post.author}</strong>
                <span>15分钟前</span>
              </div>
            </div>
            <h3>{post.title}</h3>
            <p>{post.text}</p>
            <div className="post-meta">
              <Chip label="原创" />
              <Chip label="悬疑" />
              <span>{post.stats}</span>
            </div>
          </article>
        ))}
      </div>
      <button className="floating-plus" type="button" aria-label="发布汤帖">
        <Plus size={22} />
      </button>
    </ScrollView>
  )
}

function ProfileScreen({ profile, onSignOut }: { profile: AuthProfile; onSignOut: () => void }) {
  const [stats, setStats] = useState<ProfileStats>({
    winRate: '0%',
    gamesPlayed: '0',
    mvp: '0',
  })

  useEffect(() => {
    let alive = true

    void fetchProfileStats(profile)
      .then((nextStats) => {
        if (alive) setStats(nextStats)
      })
      .catch(() => undefined)

    return () => {
      alive = false
    }
  }, [profile])

  return (
    <ScrollView>
      <section className="profile-card">
        <Avatar name={profile.nickname} tone="gold" large />
        <div>
          <h2>{profile.nickname}</h2>
          <span>
            LV.{profile.level} · {profile.email}
          </span>
          <button className="tiny-btn" type="button" onClick={onSignOut}>
            退出登录
          </button>
        </div>
      </section>
      <div className="profile-stats">
        <Stat label="胜率" value={stats.winRate} />
        <Stat label="喝汤" value={stats.gamesPlayed} />
        <Stat label="MVP" value={stats.mvp} />
      </div>
      <section className="section-block">
        <p className="section-heading">成就</p>
        <Achievement icon={Sparkles} title="神之一问" text="提出 10 个关键问题" />
        <Achievement icon={Crown} title="金牌煲汤人" text="获得 5 次 MVP" />
        <Achievement icon={CircleHelp} title="向夜饮尽" text="收藏 20 个汤底" />
      </section>
    </ScrollView>
  )
}

function BottomNav({ active, onSelect }: { active: Screen; onSelect: (screen: Screen) => void }) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {tabs.map(({ screen, label, icon: Icon }) => (
        <button
          className={active === screen ? 'active' : ''}
          type="button"
          key={screen}
          onClick={() => onSelect(screen)}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function ScrollView({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="scroll-view">
      <div className="scroll-content">{children}</div>
      {footer}
    </div>
  )
}

function ActionTile({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: LucideIcon
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button className="action-tile reveal-card" type="button" onClick={onClick}>
      <Icon size={21} />
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  )
}

function SoupRow({
  soup,
  active,
  compact,
  onOpen,
}: {
  soup: Soup
  active?: boolean
  compact?: boolean
  onOpen: () => void
}) {
  return (
    <button
      className={`soup-row ${active ? 'active' : ''} ${compact ? 'compact' : ''}`}
      type="button"
      onClick={onOpen}
    >
      <SoupBadge tone={soup.accent} />
      <div>
        <strong>{soup.title}</strong>
        <span>{soup.tags.join(' · ')}</span>
      </div>
      <Rating value={soup.rating} />
    </button>
  )
}

function SoupBadge({ tone }: { tone: Soup['accent'] }) {
  return <span className={`soup-badge tone-${tone}`} aria-hidden="true" />
}

function Rating({ value }: { value: number }) {
  return (
    <span className="rating">
      <Star size={12} fill="currentColor" />
      {value.toFixed(1)}
    </span>
  )
}

function Chip({ label }: { label: string }) {
  return <span className="chip">{label}</span>
}

function SectionTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="section-title">
      <strong>{title}</strong>
      <span>{action}</span>
    </div>
  )
}

function RadioOption({
  active,
  icon: Icon,
  title,
  text,
  onClick,
}: {
  active?: boolean
  icon: LucideIcon
  title: string
  text: string
  onClick?: () => void
}) {
  return (
    <button className={`radio-option ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      {active && <ShieldCheck size={17} />}
    </button>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <strong>
        {value}
        <ChevronRight size={14} />
      </strong>
    </div>
  )
}

function QuestionRow({ question }: { question: Question }) {
  return (
    <div className="question-row">
      <span>
        <em>{question.asker}</em>
        {question.text}
      </span>
      <strong className={question.answer === '否' ? 'no' : question.answer === '部分正确' ? 'partial' : ''}>
        {question.answer}
      </strong>
    </div>
  )
}

function ClueSection({ icon: Icon, title, items }: { icon: LucideIcon; title: string; items: string[] }) {
  return (
    <section className="clue-section scan-panel">
      <div className="clue-head">
        <Icon size={17} />
        <strong>{title}</strong>
      </div>
      {items.length === 0 ? <p>暂无线索</p> : items.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
    </section>
  )
}

function Avatar({ name, tone, large }: { name: string; tone: string; large?: boolean }) {
  return <span className={`avatar tone-${tone} ${large ? 'large' : ''}`}>{name.slice(0, 1)}</span>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function Achievement({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="achievement">
      <Icon size={19} />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <ChevronRight size={16} />
    </div>
  )
}

function BrandMark({ large }: { large?: boolean }) {
  return (
    <span className={`brand-mark ${large ? 'large' : ''}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function HeroArt({ compact, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <div
      className={`hero-art ${compact ? 'compact' : ''} ${className}`}
      style={{ backgroundImage: `linear-gradient(180deg, rgba(2, 8, 13, 0.1), rgba(2, 8, 13, 0.78)), url(${raincoatUrl})` }}
      aria-hidden="true"
    >
      <span className="scan-line" />
      <span className="trace-ring" />
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '操作失败，请重试。'
}

export default App

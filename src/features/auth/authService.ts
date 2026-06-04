import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase, supabase } from '../../lib/supabase'

const legacyLocalUserKey = 'xuantang.localUser'
const localUsersKey = 'xuantang.localUsers'
const localSessionKey = 'xuantang.localSession'

export type AuthProfile = {
  id: string
  email: string
  nickname: string
  avatarUrl?: string
  level: number
}

type LocalUserRecord = AuthProfile & {
  password: string
}

export async function getCurrentProfile(): Promise<AuthProfile | null> {
  if (!isSupabaseConfigured) {
    return readLocalSessionUser()
  }

  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()

  if (error) throw error
  if (!data.session?.user) return null

  return loadProfile(data.session.user.id, data.session.user.email ?? '')
}

export async function signUp(email: string, password: string, nickname: string): Promise<AuthProfile | null> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanNickname = normalizeNickname(nickname)

  if (!isSupabaseConfigured) {
    const users = readLocalUsers()

    if (users[cleanEmail]) {
      throw new Error('该邮箱已注册。')
    }

    const user = createLocalUser(cleanEmail, cleanNickname, password)
    users[cleanEmail] = user
    writeLocalUsers(users)
    localStorage.setItem(localSessionKey, user.id)

    return stripPassword(user)
  }

  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        nickname: cleanNickname,
      },
    },
  })

  if (error) throw error
  if (!data.user) return null

  if (!data.session) {
    return null
  }

  return loadProfile(data.user.id, cleanEmail)
}

export async function signIn(email: string, password: string): Promise<AuthProfile> {
  const cleanEmail = email.trim().toLowerCase()

  if (!isSupabaseConfigured) {
    const users = readLocalUsers()
    const stored = users[cleanEmail]

    if (!stored || stored.password !== password) {
      throw new Error('邮箱或密码不正确。')
    }

    localStorage.setItem(localSessionKey, stored.id)
    return stripPassword(stored)
  }

  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  })

  if (error) throw error
  if (!data.user) throw new Error('登录失败，请重试。')

  return loadProfile(data.user.id, data.user.email ?? cleanEmail)
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) {
    localStorage.removeItem(localSessionKey)
    return
  }

  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback: (profile: AuthProfile | null) => void): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => undefined
  }

  const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    void resolveSessionProfile(session).then(callback)
  })

  return () => data.subscription.unsubscribe()
}

async function resolveSessionProfile(session: Session | null): Promise<AuthProfile | null> {
  if (!session?.user) return null
  return loadProfile(session.user.id, session.user.email ?? '')
}

async function loadProfile(userId: string, email: string): Promise<AuthProfile> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('id,nickname,avatar_url,level')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const fallbackNickname = email.split('@')[0] || '夜饮尽'
    const { data: inserted, error: insertError } = await client
      .from('profiles')
      .insert({ id: userId, nickname: fallbackNickname })
      .select('id,nickname,avatar_url,level')
      .single()

    if (insertError) throw insertError

    return {
      id: inserted.id,
      email,
      nickname: inserted.nickname,
      avatarUrl: inserted.avatar_url ?? undefined,
      level: inserted.level ?? 1,
    }
  }

  return {
    id: data.id,
    email,
    nickname: data.nickname,
    avatarUrl: data.avatar_url ?? undefined,
    level: data.level ?? 1,
  }
}

function readLocalSessionUser(): AuthProfile | null {
  const users = readLocalUsers()
  const sessionId = localStorage.getItem(localSessionKey)
  if (!sessionId) return null

  const user = Object.values(users).find((item) => item.id === sessionId)
  return user ? stripPassword(user) : null
}

function readLocalUsers(): Record<string, LocalUserRecord> {
  const migrated = migrateLegacyLocalUser()
  const raw = localStorage.getItem(localUsersKey)

  if (!raw) return migrated

  try {
    return { ...migrated, ...(JSON.parse(raw) as Record<string, LocalUserRecord>) }
  } catch {
    localStorage.removeItem(localUsersKey)
    return migrated
  }
}

function writeLocalUsers(users: Record<string, LocalUserRecord>): void {
  localStorage.setItem(localUsersKey, JSON.stringify(users))
}

function migrateLegacyLocalUser(): Record<string, LocalUserRecord> {
  const raw = localStorage.getItem(legacyLocalUserKey)
  if (!raw) return {}

  try {
    const legacy = JSON.parse(raw) as LocalUserRecord
    localStorage.removeItem(legacyLocalUserKey)
    localStorage.setItem(localSessionKey, legacy.id)
    return { [legacy.email]: legacy }
  } catch {
    localStorage.removeItem(legacyLocalUserKey)
    return {}
  }
}

function createLocalUser(email: string, nickname: string, password: string): LocalUserRecord {
  return {
    id: `local-${makeId()}`,
    email,
    password,
    nickname,
    level: 1,
  }
}

function stripPassword(user: LocalUserRecord): AuthProfile {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    level: user.level,
  }
}

function normalizeNickname(nickname: string): string {
  return nickname.trim().slice(0, 8) || '夜饮尽'
}

function makeId(): string {
  if ('crypto' in globalThis && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

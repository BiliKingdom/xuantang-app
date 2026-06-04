// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { askQuestion as askLocalQuestion, createGameState, createRoom as createLocalRoom, soups, submitGuess as submitLocalGuess } from '../../appModel'
import type { AuthProfile } from '../auth/authService'
import {
  createCommunityPost,
  fetchAchievements,
  fetchCommunityPosts,
  fetchFavoriteSoupIds,
  fetchGameHistory,
  recordGameOutcome,
  toggleFavoriteSoup,
} from './api'

const profile: AuthProfile = {
  id: 'local-test-user',
  email: 'player@example.com',
  nickname: '玩家',
  level: 1,
}

afterEach(() => localStorage.clear())

describe('player feature fallback data', () => {
  it('persists favorite soup ids locally', async () => {
    await toggleFavoriteSoup(profile, soups[0], true)

    const favoriteIds = await fetchFavoriteSoupIds(profile, soups)
    expect(favoriteIds.has(soups[0].id)).toBe(true)

    await toggleFavoriteSoup(profile, soups[0], false)
    const nextFavoriteIds = await fetchFavoriteSoupIds(profile, soups)
    expect(nextFavoriteIds.has(soups[0].id)).toBe(false)
  })

  it('creates a community post and lists it before seeded posts', async () => {
    const post = await createCommunityPost(profile, soups[0], '新的复盘线索', '我发现红雨衣其实更像身份伪装。')
    const posts = await fetchCommunityPosts()

    expect(posts[0]).toMatchObject({
      id: post.id,
      title: '新的复盘线索',
      soupTitle: '红雨衣',
    })
  })

  it('records local game history and awards completion achievements', async () => {
    const room = createLocalRoom(soups[0], profile.nickname)
    const game = submitLocalGuess(
      askLocalQuestion(createGameState(), '红雨衣是关键物品吗？'),
      '男孩躲在衣柜里，用红雨衣伪装后让别人出门，暴雨冲掉脚印，家人误会。',
    )

    await recordGameOutcome(profile, room, game, soups[0])

    const history = await fetchGameHistory(profile)
    expect(history[0]).toMatchObject({
      roomCode: room.code,
      soupTitle: '红雨衣',
      isCorrect: true,
    })

    const achievements = await fetchAchievements(profile)
    expect(achievements.find((achievement) => achievement.id === 'first-game')?.earned).toBe(true)
    expect(achievements.find((achievement) => achievement.id === 'first-win')?.earned).toBe(true)
  })
})

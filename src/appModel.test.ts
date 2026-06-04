import { describe, expect, it } from 'vitest'
import { addLocalMember, askQuestion, createGameState, createRoom, soups, startRoom, submitGuess } from './appModel'

describe('soup game state', () => {
  it('records a question answer and promotes key information into clues', () => {
    const state = createGameState()
    const next = askQuestion(state, '男孩是故意躲进衣柜的吗？')

    expect(next.questions).toHaveLength(1)
    expect(next.questions.at(-1)).toMatchObject({
      text: '男孩是故意躲进衣柜的吗？',
      answer: '是',
      clueType: '人物',
    })
    expect(next.lastAnswer).toBe('是')
    expect(next.clues.people.some((item) => item.includes('男孩'))).toBe(true)
  })

  it('reveals the review state after a close final guess', () => {
    const state = askQuestion(createGameState(), '红雨衣是关键物品吗？')
    const next = submitGuess(state, '男孩躲在红雨衣里逃出门，最后回到雨里。')

    expect(next.phase).toBe('revealed')
    expect(next.guess).toContain('红雨衣')
    expect(next.score).toBeGreaterThanOrEqual(70)
  })

  it('creates a local room, adds a local player, and starts play', () => {
    const room = createRoom(soups[0], '房主', { maxPlayers: 2 })
    const joined = addLocalMember(room, '阿默')
    const playing = startRoom(joined)

    expect(room.code).toHaveLength(4)
    expect(joined.members.map((member) => member.name)).toEqual(['房主', '阿默'])
    expect(playing.status).toBe('playing')
  })
})

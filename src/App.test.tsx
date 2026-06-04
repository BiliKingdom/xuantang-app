// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import App from './App'
import { soups } from './appModel'

afterEach(() => cleanup())
afterEach(() => localStorage.clear())

async function registerForTest(user: ReturnType<typeof userEvent.setup>, suffix: string) {
  await screen.findByRole('button', { name: '登录' })
  await user.click(screen.getByRole('button', { name: '没有账号，去注册' }))
  await user.type(screen.getByPlaceholderText('you@example.com'), `test-${suffix}@example.com`)
  await user.type(screen.getByPlaceholderText('至少 6 位'), 'password123')
  await user.clear(screen.getByDisplayValue('夜饮尽'))
  await user.type(screen.getByDisplayValue(''), `玩家${suffix}`)
  await user.click(screen.getByRole('button', { name: '注册并登录' }))
  await screen.findByRole('button', { name: /开始推理/ })
}

it('opens the selected recommended soup from the home screen', async () => {
  const user = userEvent.setup()
  const recommendedSoup = soups[1]

  render(<App />)

  await registerForTest(user, 'a')
  await user.click(screen.getByRole('button', { name: /开始推理/ }))
  await user.click(screen.getByRole('button', { name: new RegExp(recommendedSoup.title) }))

  expect(screen.getByRole('heading', { level: 1, name: recommendedSoup.title })).toBeInTheDocument()
})

it('plays one complete local hosted game', async () => {
  const user = userEvent.setup()

  render(<App />)

  await registerForTest(user, 'b')
  await user.click(screen.getByRole('button', { name: /开始推理/ }))
  await user.click(screen.getByRole('button', { name: /今日精选汤[\s\S]*红雨衣/ }))
  await user.click(screen.getByRole('button', { name: /邀请好友/ }))
  await user.click(screen.getByRole('button', { name: '生成房间' }))

  expect(screen.getByText('本机房间码')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText('本机玩家昵称'), '阿默')
  await user.click(screen.getByRole('button', { name: '本机加入' }))

  expect(screen.getByText('阿默')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '开始游戏' }))
  await user.type(screen.getByPlaceholderText('请输入你的问题（限 30 字以内）'), '男孩是故意躲进衣柜的吗？')
  await user.click(screen.getByRole('button', { name: '发送问题' }))

  expect(screen.getByText('男孩是故意躲进衣柜的吗？')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /猜汤底/ }))
  await user.type(
    screen.getByPlaceholderText('输入你认为的汤底真相...'),
    '男孩躲在衣柜里，用红雨衣伪装后让别人出门，暴雨冲掉脚印，家人误会。',
  )
  await user.click(screen.getByRole('button', { name: '提交猜测' }))

  expect(screen.getByRole('heading', { name: '真相揭晓' })).toBeInTheDocument()
})

it('favorites a soup and publishes a community post', async () => {
  const user = userEvent.setup()

  render(<App />)

  await registerForTest(user, 'c')
  await user.click(screen.getByRole('button', { name: /开始推理/ }))
  await user.click(screen.getByRole('button', { name: /今日精选汤[\s\S]*红雨衣/ }))
  await user.click(screen.getByRole('button', { name: '收藏汤面' }))

  await user.click(screen.getByRole('button', { name: '返回' }))
  await user.click(screen.getByRole('button', { name: '社区' }))
  await user.click(screen.getByRole('button', { name: '发布汤帖' }))
  await user.type(screen.getByPlaceholderText('写一个让人想点开的标题'), '红雨衣复盘')
  await user.type(screen.getByPlaceholderText('分享一个线索、复盘或新汤面灵感'), '这碗汤的关键是红雨衣造成了身份误认。')
  await user.click(screen.getByRole('button', { name: '发布' }))

  expect(screen.getByRole('heading', { name: '红雨衣复盘' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '我的' }))

  expect(await screen.findByText('收藏')).toBeInTheDocument()
  expect(screen.getByText('1')).toBeInTheDocument()
})

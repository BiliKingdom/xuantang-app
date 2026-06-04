import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const REQUESTED_APP_URL = process.env.QA_APP_URL
const WIDTH = Number(process.env.QA_WIDTH ?? 430)
const HEIGHT = Number(process.env.QA_HEIGHT ?? 900)
const ARTIFACT_DIR = path.resolve(process.env.QA_ARTIFACT_DIR ?? 'qa-artifacts')

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env.PROGRAMFILES ?? '', 'Microsoft/Edge/Application/msedge.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
        ]
      : [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ]

  for (const candidate of candidates) {
    if (candidate && (await pathExists(candidate))) return candidate
  }

  throw new Error('No Chrome or Edge executable found for browser QA.')
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
  })
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getJson(url, attempts = 50) {
  let lastError

  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return response.json()
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await delay(200)
  }

  throw lastError
}

async function waitForHttp(url, attempts = 80) {
  let lastError

  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw lastError
}

function createCdpClient(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl)
  let nextId = 1
  const pending = new Map()
  const events = []

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)

    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)

      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result ?? {})

      return
    }

    if (message.method === 'Runtime.consoleAPICalled') {
      events.push({
        type: message.params.type,
        text: message.params.args?.map((arg) => arg.value ?? arg.description).join(' '),
      })
    }

    if (message.method === 'Runtime.exceptionThrown') {
      events.push({
        type: 'error',
        text: message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text,
      })
    }

    if (message.method === 'Log.entryAdded') {
      events.push({
        type: message.params.entry.level,
        text: message.params.entry.text,
      })
    }
  }

  const opened = new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })

  function send(method, params = {}) {
    const id = nextId++

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  return {
    events,
    opened,
    send,
    close: () => ws.close(),
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true })

  let appUrl = REQUESTED_APP_URL
  let devServer

  if (!appUrl) {
    const appPort = await getFreePort()
    appUrl = `http://127.0.0.1:${appPort}/`
    devServer = spawn(
      process.execPath,
      [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(appPort)],
      {
      env: {
        ...process.env,
        VITE_XUANTANG_LOCAL_ONLY: 'true',
      },
      stdio: 'ignore',
      windowsHide: true,
      },
    )
    await waitForHttp(appUrl)
  }

  const browserPath = await findBrowser()
  const port = await getFreePort()
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xuantang-qa-'))
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    appUrl,
  ]
  const browser = spawn(browserPath, args, { stdio: 'ignore', windowsHide: true })

  try {
    const tabs = await getJson(`http://127.0.0.1:${port}/json/list`)
    const page = tabs.find((item) => item.type === 'page') ?? tabs[0]
    if (!page?.webSocketDebuggerUrl) throw new Error('No CDP page target found.')

    const cdp = createCdpClient(page.webSocketDebuggerUrl)
    await cdp.opened

    async function evalPage(fn, arg) {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(${fn.toString()})(${JSON.stringify(arg)})`,
        awaitPromise: true,
        returnByValue: true,
      })

      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      }

      return result.result?.value
    }

    async function waitForText(text, timeout = 8000) {
      const started = Date.now()

      while (Date.now() - started < timeout) {
        const found = await evalPage((needle) => document.body?.innerText.includes(needle), text)
        if (found) return
        await delay(150)
      }

      const body = await evalPage(() => document.body?.innerText.slice(0, 1600))
      throw new Error(`Timed out waiting for text: ${text}\n${body}`)
    }

    async function clickText(text, preferTag = 'button') {
      return evalPage(
        ({ text, preferTag }) => {
          const isVisible = (element) => {
            const rect = element.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          }
          const exactCandidates = [...document.querySelectorAll(preferTag)].filter(
            (element) => isVisible(element) && element.innerText.trim() === text,
          )
          const candidates = exactCandidates.length
            ? exactCandidates
            : [...document.querySelectorAll(`${preferTag}, [role="button"], a, .soup-card, .action-card`)].filter(
                (element) => isVisible(element) && element.innerText.includes(text),
              )

          if (!candidates.length) throw new Error(`No clickable text: ${text}`)

          candidates[0].click()
          return candidates[0].innerText
        },
        { text, preferTag },
      )
    }

    async function clickAriaLabel(label) {
      return evalPage((label) => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }
        const candidates = [...document.querySelectorAll('[aria-label]')].filter(
          (element) => isVisible(element) && element.getAttribute('aria-label') === label,
        )

        if (!candidates.length) throw new Error(`No aria-label target: ${label}`)

        candidates[0].click()
        return candidates[0].getAttribute('aria-label')
      }, label)
    }

    async function setInput(placeholderPart, value) {
      return evalPage(
        ({ placeholderPart, value }) => {
          const input = [...document.querySelectorAll('input, textarea')].find((element) =>
            (element.getAttribute('placeholder') ?? '').includes(placeholderPart),
          )
          if (!input) throw new Error(`No input placeholder containing: ${placeholderPart}`)

          const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
          setter.call(input, value)
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))

          return input.value
        },
        { placeholderPart, value },
      )
    }

    async function snapshot(name) {
      const result = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      const filePath = path.join(ARTIFACT_DIR, name)
      await fs.writeFile(filePath, Buffer.from(result.data, 'base64'))
      return filePath
    }

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await cdp.send('Page.navigate', { url: appUrl })
    await delay(700)
    await evalPage(() => {
      localStorage.clear()
      sessionStorage.clear()
      return true
    })
    await cdp.send('Page.reload', { ignoreCache: true })
    await delay(700)

    const shots = []
    await waitForText('登录玄汤')
    shots.push(await snapshot('01-auth.png'))

    await clickText('没有账号，去注册')
    await waitForText('注册并登录')
    await setInput('you@example.com', `qa-${Date.now()}@example.com`)
    await setInput('至少 6 位', 'secret123')
    await evalPage(() => {
      const nickname = [...document.querySelectorAll('input')].find((input) => input.value === '夜饮尽')
      if (nickname) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(nickname, '浏览器QA')
        nickname.dispatchEvent(new Event('input', { bubbles: true }))
        nickname.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return true
    })
    await clickText('注册并登录')
    await waitForText('开始推理')
    shots.push(await snapshot('02-onboarding.png'))

    await clickText('开始推理')
    await waitForText('今日精选汤')
    shots.push(await snapshot('03-home.png'))

    await clickText('红雨衣')
    await waitForText('邀请好友')
    await clickText('邀请好友')
    await waitForText('生成房间')
    await clickText('生成房间')
    await waitForText('本机房间码')
    await setInput('本机玩家昵称', '阿默')
    await clickText('本机加入')
    await waitForText('阿默')
    shots.push(await snapshot('04-waiting-room.png'))

    await clickText('开始游戏')
    await waitForText('提问记录')
    await setInput('请输入你的问题', '男孩是故意躲进衣柜的吗？')
    await clickAriaLabel('发送问题')
    await waitForText('男孩是故意躲进衣柜的吗？')
    shots.push(await snapshot('05-game-question.png'))

    await clickText('猜汤底')
    await waitForText('提交猜测')
    await setInput('输入你认为的汤底真相', '男孩躲在衣柜里，用红雨衣伪装后让别人出门，暴雨冲掉脚印，家人误会。')
    await clickText('提交猜测')
    await waitForText('真相揭晓')
    await delay(700)
    shots.push(await snapshot('06-reveal.png'))

    const finalText = await evalPage(() => document.body.innerText)
    const consoleIssues = cdp.events.filter((entry) => ['error', 'warn', 'warning'].includes(entry.type))

    cdp.close()

    console.log(
      JSON.stringify(
        {
          ok: true,
          appUrl,
          viewport: `${WIDTH}x${HEIGHT}`,
          finalHasReveal: finalText.includes('真相揭晓'),
          screenshots: shots,
          consoleIssues,
        },
        null,
        2,
      ),
    )
  } finally {
    browser.kill()
    devServer?.kill()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const roots = ['src', 'scripts', 'supabase', 'README.md']
const allowedExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.sql', '.ts', '.tsx'])
const suspiciousPatterns = [
  /\uFFFD/,
  /鐜勬堡/,
  /姹ゅ簱/,
  /绾㈤洦/,
  /澶滈ギ/,
  /鍒涘缓/,
  /鎴块棿/,
  /鐧诲綍/,
]

const failures = []

for (const root of roots) {
  await scan(root)
}

if (failures.length) {
  console.error('Suspicious mojibake text found:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Text integrity check passed.')

async function scan(path) {
  const entries = await safeReadDir(path)
  if (!entries) {
    if (isTextFile(path)) await inspectFile(path)
    return
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
    await scan(join(path, entry.name))
  }
}

async function safeReadDir(path) {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch {
    return null
  }
}

function isTextFile(path) {
  const index = path.lastIndexOf('.')
  const extension = index >= 0 ? path.slice(index) : ''
  return allowedExtensions.has(extension)
}

async function inspectFile(path) {
  if (path.endsWith('check-text-integrity.mjs')) return

  const text = await readFile(path, 'utf8')
  const lines = text.split(/\r?\n/)

  lines.forEach((line, index) => {
    if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
      failures.push(`${path}:${index + 1}`)
    }
  })
}

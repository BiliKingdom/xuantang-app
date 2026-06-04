import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const contentPath = 'content/soups/initial-100.json'
const expectedCounts = {
  red: 30,
  black: 25,
  funny: 15,
  weird: 10,
  emotion: 10,
  clear: 10,
}

const validAnswers = new Set(['是', '否', '无关', '部分正确', '方向接近', '无法回答'])
const validClueTypes = new Set(['人物', '物品', '时间线', '动机'])
const validSourceKinds = new Set(['original', 'licensed'])

const payload = JSON.parse(await readFile(contentPath, 'utf8'))
const failures = []

if (!Array.isArray(payload.soups)) {
  failures.push('payload.soups must be an array')
} else {
  validateSoups(payload.soups)
}

if (!Array.isArray(payload.categories)) {
  failures.push('payload.categories must be an array')
} else {
  validateCategories(payload.categories)
}

if (failures.length) {
  console.error('Soup content validation failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Soup content validation passed.')

function validateCategories(categories) {
  const ids = new Set(categories.map((category) => category.id))
  Object.keys(expectedCounts).forEach((categoryId) => {
    if (!ids.has(categoryId)) failures.push(`missing category: ${categoryId}`)
  })
}

function validateSoups(soups) {
  if (soups.length !== 100) failures.push(`expected 100 soups, got ${soups.length}`)

  const slugs = new Set()
  const hashes = new Set()
  const counts = new Map()

  for (const item of soups) {
    const label = item.slug ?? item.title ?? '<unknown>'
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)

    requireString(item.id, `${label}.id`)
    requireString(item.slug, `${label}.slug`)
    requireString(item.title, `${label}.title`)
    requireString(item.prompt, `${label}.prompt`)
    requireString(item.solution, `${label}.solution`)
    requireString(item.categoryId, `${label}.categoryId`)
    requireString(item.contentRating, `${label}.contentRating`)
    requireString(item.sourceKind, `${label}.sourceKind`)
    requireString(item.sourceLicense, `${label}.sourceLicense`)
    requireString(item.licenseVerifiedAt, `${label}.licenseVerifiedAt`)

    if (slugs.has(item.slug)) failures.push(`duplicate slug: ${item.slug}`)
    slugs.add(item.slug)

    if (!validSourceKinds.has(item.sourceKind)) {
      failures.push(`${label}.sourceKind must be original or licensed`)
    }

    if (item.sourceKind === 'licensed') {
      requireString(item.sourceUrl, `${label}.sourceUrl`)
      requireString(item.sourceLicense, `${label}.sourceLicense`)
      requireString(item.licenseVerifiedAt, `${label}.licenseVerifiedAt`)
    }

    if (item.sourceKind === 'original' && item.sourceUrl) {
      failures.push(`${label} is original but has sourceUrl`)
    }

    if (!Array.isArray(item.tags) || item.tags.length < 2) {
      failures.push(`${label}.tags must contain at least 2 tags`)
    }

    if (!Array.isArray(item.answerKeywords) || item.answerKeywords.length < 5) {
      failures.push(`${label}.answerKeywords must contain at least 5 keywords`)
    }

    if (!Array.isArray(item.rules) || item.rules.length < 3) {
      failures.push(`${label}.rules must contain at least 3 rules`)
    } else {
      item.rules.forEach((entry, index) => validateRule(entry, `${label}.rules[${index}]`))
    }

    const computedHash = createHash('sha256').update(`${item.prompt}\n---\n${item.solution}`).digest('hex')
    if (item.contentHash !== computedHash) failures.push(`${label}.contentHash does not match prompt+solution`)
    if (hashes.has(item.contentHash)) failures.push(`duplicate contentHash: ${item.contentHash}`)
    hashes.add(item.contentHash)
  }

  for (const [categoryId, expected] of Object.entries(expectedCounts)) {
    const actual = counts.get(categoryId) ?? 0
    if (actual !== expected) failures.push(`category ${categoryId} expected ${expected}, got ${actual}`)
  }
}

function validateRule(entry, label) {
  if (!Array.isArray(entry.keywords) || entry.keywords.length === 0) {
    failures.push(`${label}.keywords must not be empty`)
  }

  if (!validAnswers.has(entry.answer)) {
    failures.push(`${label}.answer is invalid: ${entry.answer}`)
  }

  if (entry.clueType && !validClueTypes.has(entry.clueType)) {
    failures.push(`${label}.clueType is invalid: ${entry.clueType}`)
  }

  if (entry.clueType && !entry.clue) {
    failures.push(`${label}.clue is required when clueType is set`)
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    failures.push(`${label} must be a non-empty string`)
  }
}

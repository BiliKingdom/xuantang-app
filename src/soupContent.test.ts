/// <reference types="node" />

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type SoupContentItem = {
  slug: string
  prompt: string
  solution: string
  categoryId: string
  sourceKind: 'original' | 'licensed'
  sourceUrl: string | null
  sourceLicense: string
  licenseVerifiedAt: string
  contentHash: string
  answerKeywords: string[]
  rules: Array<{
    keywords: string[]
    answer: string
    clueType?: string
    clue?: string
  }>
}

const payload = JSON.parse(readFileSync('content/soups/initial-100.json', 'utf8')) as {
  soups: SoupContentItem[]
}

const expectedCounts: Record<string, number> = {
  red: 30,
  black: 25,
  funny: 15,
  weird: 10,
  emotion: 10,
  clear: 10,
}

describe('initial soup content batch', () => {
  it('contains exactly 100 categorized soups', () => {
    expect(payload.soups).toHaveLength(100)

    const counts = payload.soups.reduce<Record<string, number>>((items, soup) => {
      items[soup.categoryId] = (items[soup.categoryId] ?? 0) + 1
      return items
    }, {})

    expect(counts).toEqual(expectedCounts)
  })

  it('keeps source metadata explicit and blocks unlicensed imports', () => {
    payload.soups.forEach((soup) => {
      expect(['original', 'licensed']).toContain(soup.sourceKind)
      expect(soup.sourceLicense).toBeTruthy()
      expect(soup.licenseVerifiedAt).toBeTruthy()

      if (soup.sourceKind === 'original') {
        expect(soup.sourceUrl).toBeNull()
      } else {
        expect(soup.sourceUrl).toBeTruthy()
      }
    })
  })

  it('has unique content hashes and playable rule coverage', () => {
    const hashes = new Set<string>()

    payload.soups.forEach((soup) => {
      const expectedHash = createHash('sha256').update(`${soup.prompt}\n---\n${soup.solution}`).digest('hex')

      expect(soup.contentHash).toBe(expectedHash)
      expect(hashes.has(soup.contentHash)).toBe(false)
      hashes.add(soup.contentHash)

      expect(soup.answerKeywords.length).toBeGreaterThanOrEqual(5)
      expect(soup.rules.length).toBeGreaterThanOrEqual(3)
      soup.rules.forEach((rule) => {
        expect(rule.keywords.length).toBeGreaterThan(0)
        expect(rule.answer).toBeTruthy()
      })
    })
  })
})

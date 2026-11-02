import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
const robots = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8')

test('sitemap lists the live catalog category pages the navigation links to', () => {
  assert.match(sitemap, /for \(const cat of await getServiceCategories\(\)\)/)
  assert.match(sitemap, /if \(cat\.isFallback\) continue;/, 'outage fallback is never published')
  assert.match(sitemap, /\/categories\/\$\{encodeURIComponent\(cat\.slug\)\}/)
})

test('robots keeps public pages open to every crawler (Google and AI) and points at the sitemap', () => {
  assert.match(robots, /userAgent: "\*",\s*allow: "\/"/)
  assert.doesNotMatch(robots, /GPTBot|ClaudeBot|PerplexityBot|Google-Extended|CCBot/, 'no AI crawler is singled out for blocking')
  assert.match(robots, /sitemap: `\$\{base\}\/sitemap\.xml`/)
})

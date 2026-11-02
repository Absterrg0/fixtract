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

test('F11: static marketing category slugs (which redirect) are not advertised', () => {
  assert.doesNotMatch(sitemap, /\/categories\/\$\{cat\.slug\}/)
  assert.equal((sitemap.match(/\/categories\//g) || []).length, 1, 'only the live-catalog category loop emits category URLs')
  assert.match(sitemap, /\/services\/\$\{svc\.id\}/, 'static service landing pages stay listed')
})

test('robots keeps public pages open to every crawler (Google and AI) and points at the sitemap', () => {
  assert.match(robots, /userAgent: "\*",\s*allow: "\/"/)
  assert.doesNotMatch(robots, /GPTBot|ClaudeBot|PerplexityBot|Google-Extended|CCBot/, 'no AI crawler is singled out for blocking')
  assert.match(robots, /sitemap: `\$\{base\}\/sitemap\.xml`/)
})

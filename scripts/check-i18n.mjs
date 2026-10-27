#!/usr/bin/env node
/**
 * i18n consistency check (run with `npm run i18n:check`).
 *
 * Verifies, for every namespace in `i18n/namespaces.ts`:
 *   1. `messages/<locale>/<namespace>.json` exists for every locale.
 *   2. nl/fr have exactly the same key set as en (reports missing + extra).
 *   3. ICU placeholders (`{name}`) of each key match en.
 *   4. `i18n/global.d.ts` imports the namespace (otherwise next-intl cannot
 *      type-check its keys and drift becomes invisible).
 *
 * Exit code 1 on any mismatch so CI fails instead of shipping half-translated
 * UI. No dependencies: plain Node, run before build/lint if desired.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_LOCALE = "en";
const PLACEHOLDER_RE = /\{\s*([A-Za-z0-9_]+)\s*[,}]/g;

/** Extract a `const NAME = [ "a", "b" ] as const` string array from a TS file. */
function readStringArray(file, name) {
  const source = readFileSync(join(ROOT, file), "utf8");
  const match = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(source);
  if (!match) {
    throw new Error(`Could not find "${name}" array in ${file}`);
  }
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

function readJson(relativePath) {
  const absolute = join(ROOT, relativePath);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

/** Flatten nested message objects into dotted paths (`a.b.c`). Non-string
 * leaves are collected into `nonStrings` instead of being coerced. */
function flatten(value, prefix = "", out = new Map(), nonStrings = []) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (typeof value === "string") {
    out.set(prefix, value);
  } else if (value !== undefined && value !== null) {
    // Non-string leaves (numbers, booleans, …) are not localizable copy:
    // report them instead of coercing so `String(42)` can never pass as UI text.
    nonStrings.push(prefix);
  }
  return out;
}

function placeholders(message) {
  const found = new Set();
  for (const match of message.matchAll(PLACEHOLDER_RE)) {
    found.add(match[1]);
  }
  return found;
}

const locales = readStringArray("i18n/config.ts", "LOCALES");
const namespaces = readStringArray("i18n/namespaces.ts", "NAMESPACES");
const globalTypes = readFileSync(join(ROOT, "i18n/global.d.ts"), "utf8");

const targetLocales = locales.filter((locale) => locale !== SOURCE_LOCALE);
const problems = [];

if (!locales.includes(SOURCE_LOCALE)) {
  problems.push(`i18n/config.ts: LOCALES must include the source locale "${SOURCE_LOCALE}"`);
}

for (const namespace of namespaces) {
  if (!globalTypes.includes(`../messages/${SOURCE_LOCALE}/${namespace}.json`)) {
    problems.push(
      `i18n/global.d.ts: namespace "${namespace}" is missing from the next-intl type augmentation`
    );
  }
  if (!globalTypes.includes(`${namespace}: typeof`)) {
    problems.push(
      `i18n/global.d.ts: namespace "${namespace}" has an import but no Messages entry`
    );
  }

  const source = readJson(`messages/${SOURCE_LOCALE}/${namespace}.json`);
  if (!source) {
    problems.push(`messages/${SOURCE_LOCALE}/${namespace}.json is missing`);
    continue;
  }
  const sourceNonStrings = [];
  const sourceKeys = flatten(source, "", new Map(), sourceNonStrings);
  if (sourceNonStrings.length) {
    problems.push(
      `messages/${SOURCE_LOCALE}/${namespace}.json: non-string values → ${sourceNonStrings.join(", ")}`
    );
  }

  for (const locale of targetLocales) {
    const path = `messages/${locale}/${namespace}.json`;
    const data = readJson(path);
    if (!data) {
      problems.push(`${path} is missing`);
      continue;
    }
    const localeNonStrings = [];
    const keys = flatten(data, "", new Map(), localeNonStrings);
    if (localeNonStrings.length) {
      problems.push(`${path}: non-string values → ${localeNonStrings.join(", ")}`);
    }

    const missing = [...sourceKeys.keys()].filter((key) => !keys.has(key));
    const extra = [...keys.keys()].filter((key) => !sourceKeys.has(key));
    if (missing.length) {
      problems.push(`${path}: missing keys → ${missing.join(", ")}`);
    }
    if (extra.length) {
      problems.push(`${path}: keys not present in ${SOURCE_LOCALE} → ${extra.join(", ")}`);
    }

    for (const [key, sourceMessage] of sourceKeys) {
      const translated = keys.get(key);
      if (translated === undefined) continue;
      const expected = [...placeholders(sourceMessage)].sort();
      const actual = [...placeholders(translated)].sort();
      if (expected.join("|") !== actual.join("|")) {
        problems.push(
          `${path}: "${key}" placeholders differ — ${SOURCE_LOCALE}: {${expected.join(", ")}} vs ${locale}: {${actual.join(", ")}}`
        );
      }
    }
  }
}

const checked = `${namespaces.length} namespaces × ${locales.length} locales (${locales.join(", ")})`;

if (problems.length) {
  console.error(`i18n:check FAILED — ${checked}\n`);
  for (const problem of problems) console.error(`  ✖ ${problem}`);
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}

console.log(`i18n:check OK — ${checked}`);
for (const namespace of namespaces) {
  console.log(`  ✓ ${namespace}`);
}

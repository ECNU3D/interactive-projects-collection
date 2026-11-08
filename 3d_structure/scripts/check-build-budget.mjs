import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const MEBIBYTE = 1024 * 1024
const WOFF2_BUDGET_BYTES = 5.25 * MEBIBYTE
const SCENE_GROWTH_LIMIT = 1.15
const ASSETS_DIRECTORY = path.resolve('dist/assets')
const EXPLORER_ENTRY = 'src/pages/ExplorerPage.tsx'
const SCENE_ENTRY_PATTERN = /^src\/scene\/[^/]+Scene\.tsx$/u

// Incremental raw-byte closures from the manifest generated at Task 1 HEAD.
// Source entry keys remain stable when Vite content hashes change.
const SCENE_ENTRY_BASELINES = {
  'src/scene/AircraftScene.tsx': 942_274,
  'src/scene/FirearmScene.tsx': 949_413,
  'src/scene/TankScene.tsx': 920_831,
  'src/scene/VesselScene.tsx': 942_146,
}

const cjkFamilyPattern =
  /(?:\b(?:SC|TC|CJK)\b|Han|Hei|Song|Kai|YaHei|PingFang|WenKai|Sarasa|LXGW|思源|苹方|雅黑|黑体|宋体|楷体)/i
const CJK_UNICODE_RANGES = [
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0x20000, 0x2a6df],
  [0x2a700, 0x2ee5f],
  [0x2f800, 0x2fa1f],
  [0x30000, 0x323af],
  [0x323b0, 0x3347f],
]

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MEBIBYTE) return `${(bytes / 1024).toFixed(2)} KiB`
  return `${(bytes / MEBIBYTE).toFixed(2)} MiB`
}

function parseUnicodeRangeToken(token) {
  const match = token
    .trim()
    .match(/^U\+([0-9A-F?]{1,6})(?:-([0-9A-F]{1,6}))?$/iu)

  if (!match) return null

  const [, startToken, endToken] = match

  if (startToken.includes('?')) {
    if (endToken) return null

    return {
      start: Number.parseInt(startToken.replaceAll('?', '0'), 16),
      end: Number.parseInt(startToken.replaceAll('?', 'F'), 16),
    }
  }

  const start = Number.parseInt(startToken, 16)
  const end = endToken ? Number.parseInt(endToken, 16) : start

  return start <= end ? { start, end } : null
}

function fontFaceCoversCjk(block) {
  const unicodeRangeMatch = block.match(
    /unicode-range\s*:\s*([^;}]+)/iu,
  )
  const unicodeRanges =
    unicodeRangeMatch?.[1]
      .split(',')
      .map(parseUnicodeRangeToken)
      .filter(Boolean) ?? []

  if (unicodeRanges.length === 0) return null

  return unicodeRanges.some(({ start, end }) =>
    CJK_UNICODE_RANGES.some(
      ([cjkStart, cjkEnd]) => start <= cjkEnd && end >= cjkStart,
    ),
  )
}

function getCjkFontFamilies(cssSource) {
  const families = new Set()
  const fontFaceBlocks = cssSource.match(/@font-face\s*\{[^}]*\}/giu) ?? []

  for (const block of fontFaceBlocks) {
    if (!/\.woff2(?:[)'"?#]|$)/iu.test(block)) continue

    const familyMatch = block.match(
      /font-family\s*:\s*(?:"([^"]+)"|'([^']+)'|([^;}]+))/iu,
    )
    const family = familyMatch?.slice(1).find(Boolean)?.trim()
    const coversCjk = fontFaceCoversCjk(block)

    if (
      family &&
      (coversCjk === true ||
        (coversCjk === null && cjkFamilyPattern.test(family)))
    ) {
      families.add(family)
    }
  }

  return families
}

function getManifestChunk(manifest, key, referencedBy) {
  const chunk = manifest[key]

  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
    const reference = referencedBy ? ` referenced by ${referencedBy}` : ''
    throw new Error(`Manifest entry is missing: ${key}${reference}`)
  }

  return chunk
}

function collectManifestClosure(manifest, entryKey) {
  const visited = new Set()
  const pending = [{ key: entryKey, referencedBy: undefined }]

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current.key)) continue

    const chunk = getManifestChunk(
      manifest,
      current.key,
      current.referencedBy,
    )
    visited.add(current.key)

    for (const importKey of chunk.imports ?? []) {
      if (typeof importKey !== 'string') {
        throw new Error(`Manifest imports are invalid for ${current.key}`)
      }
      pending.push({ key: importKey, referencedBy: current.key })
    }
  }

  return visited
}

function collectOutputFiles(manifest, entryKeys) {
  const files = new Set()

  for (const entryKey of entryKeys) {
    const chunk = getManifestChunk(manifest, entryKey)

    if (typeof chunk.file !== 'string') {
      throw new Error(
        `Manifest entry does not reference an output file: ${entryKey}`,
      )
    }

    files.add(chunk.file)

    for (const fileName of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
      if (typeof fileName !== 'string') {
        throw new Error(`Manifest output references are invalid for ${entryKey}`)
      }
      files.add(fileName)
    }
  }

  return files
}

async function measureManifestFiles(distDirectory, fileNames) {
  let bytes = 0

  for (const fileName of fileNames) {
    const outputPath = path.resolve(distDirectory, fileName)
    const relativePath = path.relative(distDirectory, outputPath)

    if (
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(`Manifest output path escapes dist: ${fileName}`)
    }

    try {
      const outputStat = await stat(outputPath)
      if (!outputStat.isFile()) throw new Error('not a file')
      bytes += outputStat.size
    } catch {
      throw new Error(`Manifest output file is missing: ${fileName}`)
    }
  }

  return bytes
}

function failedResult(failure) {
  return {
    ok: false,
    output: [],
    failures: [failure],
    woff2Bytes: 0,
    cjkFamilies: [],
    scenePayloads: [],
  }
}

export async function checkBuildBudget(
  assetsDirectory = ASSETS_DIRECTORY,
  { sceneBaselines = SCENE_ENTRY_BASELINES } = {},
) {
  let entries

  try {
    entries = await readdir(assetsDirectory, { withFileTypes: true })
  } catch (error) {
    return failedResult(
      `Build budget check could not read ${assetsDirectory}: ${error.message}`,
    )
  }

  const assetNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
  const woff2Names = assetNames.filter((fileName) =>
    fileName.toLowerCase().endsWith('.woff2'),
  )
  const woff2Sizes = await Promise.all(
    woff2Names.map(async (fileName) => ({
      fileName,
      bytes: (await stat(path.join(assetsDirectory, fileName))).size,
    })),
  )
  const woff2Bytes = woff2Sizes.reduce(
    (total, asset) => total + asset.bytes,
    0,
  )

  const cssNames = assetNames.filter((fileName) =>
    fileName.toLowerCase().endsWith('.css'),
  )
  const cssSources = await Promise.all(
    cssNames.map((fileName) =>
      readFile(path.join(assetsDirectory, fileName), 'utf8'),
    ),
  )
  const cjkFamilies = new Set(
    cssSources.flatMap((source) => [...getCjkFontFamilies(source)]),
  )
  const distDirectory = path.resolve(assetsDirectory, '..')
  const manifestPath = path.join(distDirectory, '.vite/manifest.json')
  let manifest

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    return failedResult(
      `Build budget check could not read Vite manifest ${manifestPath}: ${error.message}`,
    )
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return failedResult(`Vite manifest is invalid: ${manifestPath}`)
  }

  const sceneEntries = Object.keys(manifest)
    .filter(
      (entryKey) =>
        SCENE_ENTRY_PATTERN.test(entryKey) &&
        manifest[entryKey]?.isDynamicEntry === true,
    )
    .sort()
  const failures = []
  const scenePayloads = []

  for (const entry of Object.keys(sceneBaselines).sort()) {
    const chunk = manifest[entry]

    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
      failures.push(
        `Configured scene baseline entry is missing from Vite manifest: ${entry}.`,
      )
    } else if (chunk.isDynamicEntry !== true) {
      failures.push(
        `Configured scene baseline entry is not a dynamic entry: ${entry}.`,
      )
    }
  }

  try {
    const baseClosure = collectManifestClosure(manifest, EXPLORER_ENTRY)
    const baseFiles = collectOutputFiles(manifest, baseClosure)
    await measureManifestFiles(distDirectory, baseFiles)

    for (const entry of sceneEntries) {
      const baselineBytes = sceneBaselines[entry]

      if (!Number.isFinite(baselineBytes) || baselineBytes < 0) {
        failures.push(`No scene payload baseline is configured for ${entry}.`)
        continue
      }

      const sceneClosure = collectManifestClosure(manifest, entry)
      const files = [...collectOutputFiles(manifest, sceneClosure)]
        .filter((fileName) => !baseFiles.has(fileName))
        .sort()
      const bytes = await measureManifestFiles(distDirectory, files)

      scenePayloads.push({ entry, files, bytes, baselineBytes })
    }
  } catch (error) {
    failures.push(error.message)
  }

  const output = [
    `WOFF2 total: ${formatBytes(woff2Bytes)} / ${formatBytes(WOFF2_BUDGET_BYTES)}`,
    `CJK font families: ${cjkFamilies.size}${
      cjkFamilies.size > 0 ? ` (${[...cjkFamilies].sort().join(', ')})` : ''
    }`,
    `Scene entry payloads: ${scenePayloads.length}`,
  ]

  for (const payload of scenePayloads) {
    output.push(
      `  ${payload.entry}: ${payload.files.length} files, ${formatBytes(payload.bytes)} (baseline ${formatBytes(payload.baselineBytes)})`,
    )
  }

  if (woff2Bytes > WOFF2_BUDGET_BYTES) {
    failures.push(
      `WOFF2 assets exceed 5.25 MiB by ${formatBytes(woff2Bytes - WOFF2_BUDGET_BYTES)}.`,
    )
  }

  if (cjkFamilies.size > 1) {
    failures.push(
      `More than one bundled CJK font family was found: ${[...cjkFamilies].sort().join(', ')}.`,
    )
  }

  for (const payload of scenePayloads) {
    const limit = payload.baselineBytes * SCENE_GROWTH_LIMIT
    if (payload.bytes > limit) {
      failures.push(
        `${payload.entry} payload is ${formatBytes(payload.bytes)}, above 115% of its ${formatBytes(payload.baselineBytes)} baseline.`,
      )
    }
  }

  return {
    ok: failures.length === 0,
    output,
    failures,
    woff2Bytes,
    cjkFamilies: [...cjkFamilies].sort(),
    scenePayloads,
  }
}

async function runCli() {
  const result = await checkBuildBudget()

  for (const line of result.output) console.log(line)
  for (const failure of result.failures) {
    console.error(`Build budget failed: ${failure}`)
  }

  if (!result.ok) process.exitCode = 1
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectExecution) await runCli()

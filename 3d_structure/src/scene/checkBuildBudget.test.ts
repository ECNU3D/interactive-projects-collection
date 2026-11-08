import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  truncate,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const SCRIPT_PATH = path.resolve('scripts/check-build-budget.mjs')
const WOFF2_BUDGET_BYTES = 5.25 * 1024 * 1024
const AIRCRAFT_SCENE_ENTRY = 'src/scene/AircraftScene.tsx'
const EXPLORER_ENTRY = 'src/pages/ExplorerPage.tsx'

interface ManifestChunk {
  file: string
  src?: string
  isDynamicEntry?: boolean
  imports?: string[]
  css?: string[]
  assets?: string[]
}

interface BudgetResult {
  ok: boolean
  output: string[]
  failures: string[]
  scenePayloads: Array<{
    entry: string
    files: string[]
    bytes: number
    baselineBytes: number
  }>
}

type CheckBuildBudget = (
  assetsDirectory: string,
  options?: { sceneBaselines?: Record<string, number> },
) => Promise<BudgetResult>

interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

function runBudgetCheck(cwd: string) {
  return new Promise<CommandResult>((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT_PATH],
      { cwd },
      (error, stdout, stderr) => {
        resolve({
          exitCode:
            error && typeof error.code === 'number' ? error.code : 0,
          stdout,
          stderr,
        })
      },
    )
  })
}

describe('check-build-budget CLI', () => {
  let fixtureRoot: string
  let assetsDirectory: string
  let manifest: Record<string, ManifestChunk>
  let checkBuildBudget: CheckBuildBudget

  beforeAll(async () => {
    const module = (await import(
      /* @vite-ignore */ pathToFileURL(SCRIPT_PATH).href
    )) as { checkBuildBudget: CheckBuildBudget }
    checkBuildBudget = module.checkBuildBudget
  })

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), 'build-budget-'))
    assetsDirectory = path.join(fixtureRoot, 'dist/assets')
    await mkdir(path.join(fixtureRoot, 'dist/.vite'), { recursive: true })
    await mkdir(assetsDirectory, { recursive: true })
    manifest = {
      [EXPLORER_ENTRY]: {
        file: 'assets/ExplorerPage-fixture.js',
        src: EXPLORER_ENTRY,
        isDynamicEntry: true,
      },
    }
    await writeFile(
      path.join(assetsDirectory, 'ExplorerPage-fixture.js'),
      '',
    )
    await writeManifest()
  })

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true })
  })

  async function writeManifest() {
    await writeFile(
      path.join(fixtureRoot, 'dist/.vite/manifest.json'),
      JSON.stringify(manifest),
    )
  }

  async function writeAsset(fileName: string, bytes: number) {
    const assetPath = path.join(assetsDirectory, fileName)
    await writeFile(assetPath, '')
    await truncate(assetPath, bytes)
  }

  it('configures production builds to emit a Vite manifest', async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve('package.json'), 'utf8'),
    ) as { scripts: { build: string } }

    expect(packageJson.scripts.build).toBe(
      'tsc --noEmit && vite build --manifest && node scripts/check-build-budget.mjs',
    )
  })

  it('accepts a build with no font assets when scene coverage is empty', async () => {
    const result = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: {},
    })

    expect(result.ok).toBe(true)
    expect(result.output).toContain('WOFF2 total: 0 B / 5.25 MiB')
    expect(result.output).toContain('CJK font families: 0')
    expect(result.output).toContain('Scene entry payloads: 0')
    expect(result.failures).toEqual([])
  })

  it('rejects WOFF2 assets above 5.25 MiB in total', async () => {
    const fontPath = path.join(assetsDirectory, 'oversized.woff2')
    await writeFile(fontPath, '')
    await truncate(fontPath, WOFF2_BUDGET_BYTES + 1)

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('WOFF2 assets exceed 5.25 MiB')
  })

  it('rejects a second CJK family from unicode-range coverage', async () => {
    await Promise.all([
      writeFile(path.join(assetsDirectory, 'sans.woff2'), ''),
      writeFile(path.join(assetsDirectory, 'serif.woff2'), ''),
      writeFile(
        path.join(assetsDirectory, 'fonts.css'),
        [
          '@font-face {',
          '  font-family: "Noto Sans SC Variable";',
          '  src: url("./sans.woff2") format("woff2");',
          '  unicode-range: U+4E00;',
          '}',
          '@font-face {',
          '  font-family: "Noto Serif JP";',
          '  src: url("./serif.woff2") format("woff2");',
          '  unicode-range: U+3400-4DBF, U+4???;',
          '}',
        ].join('\n'),
      ),
    ])

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain(
      'CJK font families: 2 (Noto Sans SC Variable, Noto Serif JP)',
    )
    expect(result.stderr).toContain(
      'More than one bundled CJK font family was found',
    )
  })

  it('rejects a second CJK family covered only by an extension-plane range', async () => {
    await Promise.all([
      writeFile(path.join(assetsDirectory, 'sans.woff2'), ''),
      writeFile(path.join(assetsDirectory, 'serif.woff2'), ''),
      writeFile(
        path.join(assetsDirectory, 'fonts.css'),
        [
          '@font-face {',
          '  font-family: "Noto Sans SC Variable";',
          '  src: url("./sans.woff2") format("woff2");',
          '  unicode-range: U+4E00;',
          '}',
          '@font-face {',
          '  font-family: "Noto Serif JP";',
          '  src: url("./serif.woff2") format("woff2");',
          '  unicode-range: U+20000;',
          '}',
        ].join('\n'),
      ),
    ])

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain(
      'CJK font families: 2 (Noto Sans SC Variable, Noto Serif JP)',
    )
  })

  it('rejects a second CJK family covered only by Unicode 17 Extension J', async () => {
    await Promise.all([
      writeFile(path.join(assetsDirectory, 'sans.woff2'), ''),
      writeFile(path.join(assetsDirectory, 'serif.woff2'), ''),
      writeFile(
        path.join(assetsDirectory, 'fonts.css'),
        [
          '@font-face {',
          '  font-family: "Noto Sans SC Variable";',
          '  src: url("./sans.woff2") format("woff2");',
          '  unicode-range: U+4E00;',
          '}',
          '@font-face {',
          '  font-family: "Noto Serif JP";',
          '  src: url("./serif.woff2") format("woff2");',
          '  unicode-range: U+323B0;',
          '}',
        ].join('\n'),
      ),
    ])

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain(
      'CJK font families: 2 (Noto Sans SC Variable, Noto Serif JP)',
    )
  })

  it('fails when a configured scene entry is absent from the manifest', async () => {
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-present.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: true,
    }
    await writeManifest()
    await writeAsset('AircraftScene-present.js', 10)

    const result = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: {
        [AIRCRAFT_SCENE_ENTRY]: 10,
        'src/scene/TankScene.tsx': 10,
      },
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      'Configured scene baseline entry is missing from Vite manifest: src/scene/TankScene.tsx.',
    )
  })

  it('fails when a configured scene entry is not dynamic', async () => {
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-static.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: false,
    }
    await writeManifest()
    await writeAsset('AircraftScene-static.js', 10)

    const result = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: { [AIRCRAFT_SCENE_ENTRY]: 10 },
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      'Configured scene baseline entry is not a dynamic entry: src/scene/AircraftScene.tsx.',
    )
  })

  it('fails when a new dynamic scene entry has no baseline', async () => {
    const experimentalEntry = 'src/scene/ExperimentalScene.tsx'
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-covered.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: true,
    }
    manifest[experimentalEntry] = {
      file: 'assets/ExperimentalScene-new.js',
      src: experimentalEntry,
      isDynamicEntry: true,
    }
    await writeManifest()
    await Promise.all([
      writeAsset('AircraftScene-covered.js', 10),
      writeAsset('ExperimentalScene-new.js', 10),
    ])

    const result = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: { [AIRCRAFT_SCENE_ENTRY]: 10 },
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContain(
      `No scene payload baseline is configured for ${experimentalEntry}.`,
    )
  })

  it('budgets the complete lazy closure instead of only the scene leaf', async () => {
    const kibibyte = 1024
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-leaf.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: true,
      imports: ['_shared-lazy.js'],
    }
    manifest['_shared-lazy.js'] = {
      file: 'assets/shared-lazy.js',
    }
    await writeManifest()
    await Promise.all([
      writeAsset('AircraftScene-leaf.js', 10 * kibibyte),
      writeAsset('shared-lazy.js', 100 * kibibyte),
    ])

    const result = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: { [AIRCRAFT_SCENE_ENTRY]: 95 * kibibyte },
    })

    expect(result.ok).toBe(false)
    expect(result.scenePayloads).toEqual([
      {
        entry: AIRCRAFT_SCENE_ENTRY,
        files: [
          'assets/AircraftScene-leaf.js',
          'assets/shared-lazy.js',
        ],
        bytes: 110 * kibibyte,
        baselineBytes: 95 * kibibyte,
      },
    ])
    expect(result.failures).toEqual([
      expect.stringContaining('above 115%'),
    ])
  })

  it('deduplicates recursive imports and excludes the Explorer base closure', async () => {
    manifest[EXPLORER_ENTRY].imports = ['_base.js']
    manifest['_base.js'] = { file: 'assets/base.js' }
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-leaf.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: true,
      imports: ['_base.js', '_shared-a.js', '_shared-a.js'],
    }
    manifest['_shared-a.js'] = {
      file: 'assets/shared-a.js',
      imports: ['_shared-b.js', '_base.js'],
    }
    manifest['_shared-b.js'] = {
      file: 'assets/shared-b.js',
      imports: ['_shared-a.js'],
    }
    await writeManifest()
    await Promise.all([
      writeAsset('base.js', 30),
      writeAsset('AircraftScene-leaf.js', 10),
      writeAsset('shared-a.js', 100),
      writeAsset('shared-b.js', 50),
    ])

    const result = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: { [AIRCRAFT_SCENE_ENTRY]: 160 },
    })

    expect(result.ok).toBe(true)
    expect(result.scenePayloads).toEqual([
      {
        entry: AIRCRAFT_SCENE_ENTRY,
        files: [
          'assets/AircraftScene-leaf.js',
          'assets/shared-a.js',
          'assets/shared-b.js',
        ],
        bytes: 160,
        baselineBytes: 160,
      },
    ])
  })

  it('uses manifest source entries so hash changes do not affect thresholds', async () => {
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-first-hash.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: true,
      imports: ['_shared.js'],
    }
    manifest['_shared.js'] = { file: 'assets/shared-first-hash.js' }
    await writeManifest()
    await Promise.all([
      writeAsset('AircraftScene-first-hash.js', 10),
      writeAsset('shared-first-hash.js', 106),
    ])

    const first = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: { [AIRCRAFT_SCENE_ENTRY]: 100 },
    })

    await Promise.all([
      rm(path.join(assetsDirectory, 'AircraftScene-first-hash.js')),
      rm(path.join(assetsDirectory, 'shared-first-hash.js')),
    ])
    manifest[AIRCRAFT_SCENE_ENTRY].file =
      'assets/AircraftScene-different-hash.js'
    manifest['_shared.js'].file = 'assets/shared-different-hash.js'
    await writeManifest()
    await Promise.all([
      writeAsset('AircraftScene-different-hash.js', 10),
      writeAsset('shared-different-hash.js', 106),
    ])

    const second = await checkBuildBudget(assetsDirectory, {
      sceneBaselines: { [AIRCRAFT_SCENE_ENTRY]: 100 },
    })

    expect(first.ok).toBe(second.ok)
    expect(first.scenePayloads[0]?.bytes).toBe(116)
    expect(second.scenePayloads[0]?.bytes).toBe(116)
    expect(first.failures[0]).toContain('above 115%')
    expect(second.failures[0]).toContain('above 115%')
  })

  it('fails safely when the Vite manifest is missing', async () => {
    await rm(path.join(fixtureRoot, 'dist/.vite/manifest.json'))

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(
      'Build budget check could not read Vite manifest',
    )
  })

  it('fails safely when a manifest output file is missing', async () => {
    manifest[AIRCRAFT_SCENE_ENTRY] = {
      file: 'assets/AircraftScene-missing.js',
      src: AIRCRAFT_SCENE_ENTRY,
      isDynamicEntry: true,
    }
    await writeManifest()

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(
      'Manifest output file is missing: assets/AircraftScene-missing.js',
    )
  })

  it('fails safely when dist/assets is missing', async () => {
    await rm(path.join(fixtureRoot, 'dist'), {
      recursive: true,
      force: true,
    })

    const result = await runBudgetCheck(fixtureRoot)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Build budget check could not read')
  })
})

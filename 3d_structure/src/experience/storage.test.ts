import { loadProgress, saveProgress } from './storage'
import type { ExhibitId } from '../content/types'

describe('local progress storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps storage failures from escaping and preserves a safe fallback', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(() => saveProgress(3)).not.toThrow()
    expect(loadProgress()).toBe(0)
  })

  it('uses a safe fallback when local storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(loadProgress()).toBe(0)
    expect(() => saveProgress(3)).not.toThrow()
  })

  it('falls back to step zero for missing or corrupt progress', () => {
    expect(loadProgress()).toBe(0)

    localStorage.setItem('mechanical-atlas-progress', '{broken')
    expect(loadProgress()).toBe(0)
  })

  it('round-trips valid progress and rejects out-of-range stored values', () => {
    saveProgress(4)
    expect(loadProgress()).toBe(4)

    localStorage.setItem(
      'mechanical-atlas-progress:m4',
      JSON.stringify({ stepIndex: 99 }),
    )
    expect(loadProgress()).toBe(0)
  })

  it('leaves valid saved progress untouched when asked to save an invalid step', () => {
    saveProgress(4)

    for (const invalidStep of [-1, 2.5, 6]) {
      saveProgress(invalidStep)
      expect(loadProgress()).toBe(4)
    }
  })

  it('keeps progress independent for every exhibit', () => {
    saveProgress(2, 'm4')
    saveProgress(4, 'x57')
    saveProgress(5, 'asr10')
    saveProgress(1, 'm1903')
    saveProgress(2, 'm1911a1')
    saveProgress(3, 'm1-garand')
    saveProgress(4, 'mp5')

    expect(loadProgress('m4')).toBe(2)
    expect(loadProgress('x57')).toBe(4)
    expect(loadProgress('asr10')).toBe(5)
    expect(loadProgress('m1903')).toBe(1)
    expect(loadProgress('m1911a1')).toBe(2)
    expect(loadProgress('m1-garand')).toBe(3)
    expect(loadProgress('mp5')).toBe(4)
    expect(localStorage.getItem('mechanical-atlas-progress:m4')).not.toBeNull()
    expect(localStorage.getItem('mechanical-atlas-progress:x57')).not.toBeNull()
    expect(localStorage.getItem('mechanical-atlas-progress:asr10')).not.toBeNull()
    expect(localStorage.getItem('mechanical-atlas-progress:m1903')).not.toBeNull()
    expect(localStorage.getItem('mechanical-atlas-progress:m1911a1')).not.toBeNull()
    expect(localStorage.getItem('mechanical-atlas-progress:m1-garand')).not.toBeNull()
    expect(localStorage.getItem('mechanical-atlas-progress:mp5')).not.toBeNull()
  })

  it('reads the legacy unscoped key only as an M4 fallback', () => {
    localStorage.setItem(
      'mechanical-atlas-progress',
      JSON.stringify({ stepIndex: 3 }),
    )

    expect(loadProgress('m4')).toBe(3)
    expect(loadProgress('x57')).toBe(0)
    expect(loadProgress('asr10')).toBe(0)
  })

  it('prefers scoped M4 progress over the legacy fallback', () => {
    localStorage.setItem(
      'mechanical-atlas-progress',
      JSON.stringify({ stepIndex: 1 }),
    )
    saveProgress(4, 'm4')

    expect(loadProgress('m4')).toBe(4)
  })

  it('does not read or write progress for an invalid exhibit id', () => {
    localStorage.setItem(
      'mechanical-atlas-progress:unknown',
      JSON.stringify({ stepIndex: 3 }),
    )

    expect(loadProgress('unknown' as ExhibitId)).toBe(0)
    saveProgress(4, 'unknown' as ExhibitId)
    expect(localStorage.getItem('mechanical-atlas-progress:unknown')).toBe(
      JSON.stringify({ stepIndex: 3 }),
    )
  })
})

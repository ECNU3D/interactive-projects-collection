import * as partInteractionModule from './partInteraction'

const { isPartActivationGesture, isPartRaycastDisabled } =
  partInteractionModule as typeof partInteractionModule & {
    isPartActivationGesture?: (delta: number) => boolean
  }

describe('isPartActivationGesture', () => {
  it('is exported as a gesture classifier', () => {
    expect(isPartActivationGesture).toBeTypeOf('function')
  })

  it.each([
    [0, true],
    [4, true],
    [5, false],
    [150, false],
  ] as const)('classifies a %ipx pointer delta as %s', (delta, expected) => {
    expect(isPartActivationGesture).toBeTypeOf('function')
    expect(isPartActivationGesture?.(delta)).toBe(expected)
  })
})

describe('isPartRaycastDisabled', () => {
  it.each(['hull-shell', 'turret-shell'] as const)(
    'disables %s pointer intersections in xray mode',
    (partId) => {
      expect(isPartRaycastDisabled(partId, 'xray')).toBe(true)
    },
  )

  it('keeps internal parts intersectable in xray mode', () => {
    expect(isPartRaycastDisabled('engine-module', 'xray')).toBe(false)
  })

  it.each(['xray', 'principle'] as const)(
    'lets pointer hits pass through transparent outer shells in %s mode',
    (mode) => {
      expect(isPartRaycastDisabled('hull-shell', mode)).toBe(true)
      expect(isPartRaycastDisabled('turret-shell', mode)).toBe(true)
    },
  )

  it('keeps outer shells intersectable in explode mode', () => {
    expect(isPartRaycastDisabled('hull-shell', 'explode')).toBe(false)
    expect(isPartRaycastDisabled('turret-shell', 'explode')).toBe(false)
  })
})

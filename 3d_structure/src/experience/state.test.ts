import { createInitialState, experienceReducer } from './state'
import type { ExperienceAction, ExperienceState } from './state'

const invalidStepIndices = [
  2.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
]

describe('experience state', () => {
  it('creates a clamped, deterministic initial state', () => {
    expect(createInitialState(false, 99)).toEqual({
      stepIndex: 5,
      selectedPartId: null,
      mode: 'explode',
      autoplay: false,
      reducedMotion: false,
      sceneStatus: 'loading',
    })
  })

  it.each(invalidStepIndices)(
    'normalizes invalid initial step %s to zero',
    (stepIndex) => {
      expect(createInitialState(false, stepIndex).stepIndex).toBe(0)
    },
  )

  it('clamps next and previous step navigation', () => {
    let state = createInitialState(false)

    for (let index = 0; index < 8; index += 1) {
      state = experienceReducer(state, { type: 'next-step' })
    }
    expect(state.stepIndex).toBe(5)

    for (let index = 0; index < 8; index += 1) {
      state = experienceReducer(state, { type: 'previous-step' })
    }
    expect(state.stepIndex).toBe(0)
  })

  it('selects a part and resets to a fresh state', () => {
    let state = createInitialState(false)

    state = experienceReducer(state, {
      type: 'select-part',
      partId: 'engine-module',
    })
    expect(state.selectedPartId).toBe('engine-module')

    expect(experienceReducer(state, { type: 'reset' })).toEqual(
      createInitialState(false),
    )
  })

  it('does not toggle autoplay when reduced motion is enabled', () => {
    const state = experienceReducer(createInitialState(true), {
      type: 'toggle-autoplay',
    })

    expect(state.autoplay).toBe(false)
  })

  it('synchronizes reduced motion changes and stops active autoplay', () => {
    let state = experienceReducer(createInitialState(false), {
      type: 'toggle-autoplay',
    })
    expect(state.autoplay).toBe(true)

    state = experienceReducer(state, {
      type: 'set-reduced-motion',
      reducedMotion: true,
    })

    expect(state).toMatchObject({ reducedMotion: true, autoplay: false })

    state = experienceReducer(state, {
      type: 'set-reduced-motion',
      reducedMotion: false,
    })
    expect(state).toMatchObject({ reducedMotion: false, autoplay: false })
  })

  it('clamps direct navigation, clears selection, and disables autoplay on mode changes', () => {
    let state = createInitialState(false)
    state = experienceReducer(state, {
      type: 'select-part',
      partId: 'engine-module',
    })
    state = experienceReducer(state, { type: 'go-to-step', stepIndex: 99 })

    expect(state).toMatchObject({ stepIndex: 5, selectedPartId: null })

    state = experienceReducer(state, { type: 'go-to-step', stepIndex: -1 })
    state = experienceReducer(state, { type: 'toggle-autoplay' })
    expect(state.autoplay).toBe(true)

    state = experienceReducer(state, { type: 'set-mode', mode: 'xray' })

    expect(state).toMatchObject({ stepIndex: 0, mode: 'xray', autoplay: false })
  })

  it.each(invalidStepIndices)(
    'normalizes invalid direct step %s to zero and clears selection',
    (stepIndex) => {
      const selectedState = experienceReducer(createInitialState(false, 3), {
        type: 'select-part',
        partId: 'engine-module',
      })
      const state = experienceReducer(selectedState, {
        type: 'go-to-step',
        stepIndex,
      })

      expect(state).toMatchObject({ stepIndex: 0, selectedPartId: null })
    },
  )

  it('updates scene status', () => {
    const state = experienceReducer(createInitialState(false), {
      type: 'scene-status',
      status: 'ready',
    })

    expect(state.sceneStatus).toBe('ready')
  })

  it('resets every exploration field while preserving reduced motion', () => {
    const fullyMutatedState: ExperienceState = {
      stepIndex: 4,
      selectedPartId: 'engine-module',
      mode: 'principle',
      autoplay: true,
      reducedMotion: true,
      sceneStatus: 'error',
    }

    expect(experienceReducer(fullyMutatedState, { type: 'reset' })).toEqual({
      stepIndex: 0,
      selectedPartId: null,
      mode: 'explode',
      autoplay: false,
      reducedMotion: true,
      sceneStatus: 'loading',
    })
  })

  it('throws when an unexpected runtime action reaches the reducer', () => {
    const invalidAction = {
      type: 'unsupported-action',
    } as unknown as ExperienceAction

    expect(() =>
      experienceReducer(createInitialState(false), invalidAction),
    ).toThrow('Unexpected experience action')
  })
})

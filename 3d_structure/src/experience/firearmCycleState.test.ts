import {
  advanceFirearmCycle,
  createInitialFirearmCycleState,
  nextFirearmCyclePhase,
  pauseFirearmCycle,
  playFirearmCycle,
  previousFirearmCyclePhase,
  resetFirearmCycle,
} from './firearmCycleState'

describe('firearm cycle state', () => {
  it('starts with the controlled initial state', () => {
    expect(createInitialFirearmCycleState()).toEqual({
      phaseIndex: 0,
      status: 'idle',
      revision: 0,
    })
  })

  it('plays, pauses, and resumes the current phase', () => {
    const initial = createInitialFirearmCycleState()
    const playing = playFirearmCycle(initial)
    const paused = pauseFirearmCycle({ ...playing, phaseIndex: 2 })

    expect(playing).toEqual({
      phaseIndex: 0,
      status: 'playing',
      revision: 0,
    })
    expect(paused.status).toBe('paused')
    expect(playFirearmCycle(paused)).toEqual({
      phaseIndex: 2,
      status: 'playing',
      revision: 0,
    })
  })

  it('gives phase five a full tick before completing without looping', () => {
    const phaseFive = {
      phaseIndex: 5,
      status: 'playing' as const,
      revision: 3,
    }

    expect(
      advanceFirearmCycle({ ...phaseFive, phaseIndex: 4 }),
    ).toEqual(phaseFive)
    expect(advanceFirearmCycle(phaseFive)).toEqual({
      phaseIndex: 5,
      status: 'complete',
      revision: 3,
    })
    expect(
      advanceFirearmCycle({ ...phaseFive, status: 'complete' }),
    ).toEqual({ ...phaseFive, status: 'complete' })
  })

  it('replays and resets at phase zero with a new revision', () => {
    const complete = {
      phaseIndex: 5,
      status: 'complete' as const,
      revision: 4,
    }

    expect(playFirearmCycle(complete)).toEqual({
      phaseIndex: 0,
      status: 'playing',
      revision: 5,
    })
    expect(resetFirearmCycle(complete)).toEqual({
      phaseIndex: 0,
      status: 'idle',
      revision: 5,
    })
  })

  it('steps manually within boundaries and leaves continuous play paused', () => {
    const playing = {
      phaseIndex: 2,
      status: 'playing' as const,
      revision: 1,
    }

    expect(previousFirearmCyclePhase(playing)).toEqual({
      phaseIndex: 1,
      status: 'paused',
      revision: 1,
    })
    expect(nextFirearmCyclePhase(playing)).toEqual({
      phaseIndex: 3,
      status: 'paused',
      revision: 1,
    })
    expect(
      previousFirearmCyclePhase(createInitialFirearmCycleState()),
    ).toEqual(createInitialFirearmCycleState())
    expect(
      nextFirearmCyclePhase({ ...playing, phaseIndex: 5 }),
    ).toEqual({ ...playing, phaseIndex: 5 })
  })
})

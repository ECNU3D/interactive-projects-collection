import { FIREARM_CYCLE_PHASES } from '../scene/firearmCycle'
import type { ExhibitCycleState } from '../scene/types'

const LAST_FIREARM_CYCLE_PHASE_INDEX = FIREARM_CYCLE_PHASES.length - 1

export function createInitialFirearmCycleState(
  revision = 0,
): ExhibitCycleState {
  return { phaseIndex: 0, status: 'idle', revision }
}

export function playFirearmCycle(
  state: ExhibitCycleState,
): ExhibitCycleState {
  if (state.status === 'complete') {
    return {
      phaseIndex: 0,
      status: 'playing',
      revision: state.revision + 1,
    }
  }

  return { ...state, status: 'playing' }
}

export function pauseFirearmCycle(
  state: ExhibitCycleState,
): ExhibitCycleState {
  return state.status === 'playing'
    ? { ...state, status: 'paused' }
    : state
}

export function advanceFirearmCycle(
  state: ExhibitCycleState,
): ExhibitCycleState {
  if (state.status !== 'playing') return state
  if (state.phaseIndex >= LAST_FIREARM_CYCLE_PHASE_INDEX) {
    return { ...state, status: 'complete' }
  }

  return { ...state, phaseIndex: state.phaseIndex + 1 }
}

export function previousFirearmCyclePhase(
  state: ExhibitCycleState,
): ExhibitCycleState {
  if (state.phaseIndex <= 0) return state

  return {
    ...state,
    phaseIndex: state.phaseIndex - 1,
    status: 'paused',
  }
}

export function nextFirearmCyclePhase(
  state: ExhibitCycleState,
): ExhibitCycleState {
  if (state.phaseIndex >= LAST_FIREARM_CYCLE_PHASE_INDEX) return state

  return {
    ...state,
    phaseIndex: state.phaseIndex + 1,
    status: 'paused',
  }
}

export function resetFirearmCycle(
  state: ExhibitCycleState,
): ExhibitCycleState {
  return createInitialFirearmCycleState(state.revision + 1)
}

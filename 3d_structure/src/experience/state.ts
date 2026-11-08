import { stepIds } from '../content/types'
import type { ExhibitPartId } from '../content/types'

export type ExploreMode = 'explode' | 'xray' | 'principle'

export interface ExperienceState {
  stepIndex: number
  selectedPartId: ExhibitPartId | null
  mode: ExploreMode
  autoplay: boolean
  reducedMotion: boolean
  sceneStatus: 'loading' | 'ready' | 'error'
}

export type ExperienceAction =
  | { type: 'go-to-step'; stepIndex: number }
  | { type: 'next-step' }
  | { type: 'previous-step' }
  | { type: 'select-part'; partId: ExhibitPartId }
  | { type: 'set-mode'; mode: ExploreMode }
  | { type: 'toggle-autoplay' }
  | { type: 'set-reduced-motion'; reducedMotion: boolean }
  | { type: 'scene-status'; status: ExperienceState['sceneStatus'] }
  | { type: 'reset' }

export const MAX_STEP_INDEX = stepIds.length - 1

const normalizeStepIndex = (stepIndex: number) => {
  if (!Number.isFinite(stepIndex) || !Number.isInteger(stepIndex)) {
    return 0
  }

  return Math.max(0, Math.min(MAX_STEP_INDEX, stepIndex))
}

const assertNever = (value: never): never => {
  throw new Error(`Unexpected experience action: ${JSON.stringify(value)}`)
}

export function createInitialState(
  reducedMotion: boolean,
  stepIndex = 0,
): ExperienceState {
  return {
    stepIndex: normalizeStepIndex(stepIndex),
    selectedPartId: null,
    mode: 'explode',
    autoplay: false,
    reducedMotion,
    sceneStatus: 'loading',
  }
}

export function experienceReducer(
  state: ExperienceState,
  action: ExperienceAction,
): ExperienceState {
  switch (action.type) {
    case 'go-to-step':
      return {
        ...state,
        stepIndex: normalizeStepIndex(action.stepIndex),
        selectedPartId: null,
      }
    case 'next-step':
      return {
        ...state,
        stepIndex: normalizeStepIndex(state.stepIndex + 1),
        selectedPartId: null,
      }
    case 'previous-step':
      return {
        ...state,
        stepIndex: normalizeStepIndex(state.stepIndex - 1),
        selectedPartId: null,
      }
    case 'select-part':
      return { ...state, selectedPartId: action.partId }
    case 'set-mode':
      return { ...state, mode: action.mode, autoplay: false }
    case 'toggle-autoplay':
      return state.reducedMotion ? state : { ...state, autoplay: !state.autoplay }
    case 'set-reduced-motion':
      return {
        ...state,
        reducedMotion: action.reducedMotion,
        autoplay: action.reducedMotion ? false : state.autoplay,
      }
    case 'scene-status':
      return { ...state, sceneStatus: action.status }
    case 'reset':
      return createInitialState(state.reducedMotion)
  }

  return assertNever(action)
}

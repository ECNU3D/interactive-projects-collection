import { MAX_STEP_INDEX } from './state'
import { exhibitIds } from '../content/types'
import type { ExhibitId } from '../content/types'

const legacyKey = 'mechanical-atlas-progress'

const isExhibitId = (value: string): value is ExhibitId =>
  exhibitIds.some((exhibitId) => exhibitId === value)

const progressKey = (exhibitId: ExhibitId) =>
  `${legacyKey}:${exhibitId}`

const isValidStepIndex = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_STEP_INDEX

export function loadProgress(exhibitId: ExhibitId = 'm4'): number {
  try {
    if (typeof localStorage === 'undefined' || !isExhibitId(exhibitId)) {
      return 0
    }

    const scopedProgress = localStorage.getItem(progressKey(exhibitId))
    const storedProgress =
      scopedProgress ??
      (exhibitId === 'm4' ? localStorage.getItem(legacyKey) : null)
    const value = JSON.parse(storedProgress ?? 'null') as {
      stepIndex?: unknown
    } | null
    const stepIndex = value?.stepIndex

    return isValidStepIndex(stepIndex) ? stepIndex : 0
  } catch {
    return 0
  }
}

export function saveProgress(
  stepIndex: number,
  exhibitId: ExhibitId = 'm4',
): void {
  if (!isValidStepIndex(stepIndex) || !isExhibitId(exhibitId)) {
    return
  }

  try {
    if (typeof localStorage === 'undefined') {
      return
    }

    localStorage.setItem(
      progressKey(exhibitId),
      JSON.stringify({ stepIndex }),
    )
  } catch {
    return
  }
}

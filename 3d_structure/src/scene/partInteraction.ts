import type { PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'

export function isPartActivationGesture(delta: number) {
  return delta <= 4
}

export function isPartRaycastDisabled(
  partId: PartId,
  mode: ExploreMode,
) {
  return (
    (mode === 'xray' || mode === 'principle') &&
    (partId === 'hull-shell' || partId === 'turret-shell')
  )
}

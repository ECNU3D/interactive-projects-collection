import { m4Steps } from '../content/m4'
import type { PartDefinition } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  resolvePartMaterial,
  type ResolvedPartMaterial,
} from './partMaterial'

export interface PartMotion {
  position: readonly [number, number, number]
  material: ResolvedPartMaterial
  scale: number
  emissiveIntensity: number
}

const ASSEMBLED_POSITION = [0, 0, 0] as const

export function getPartMotion(
  part: PartDefinition,
  stepIndex: number,
  mode: ExploreMode,
  selected: boolean,
): PartMotion {
  const revealStep = m4Steps.find((step) => step.id === part.stepId)!.index
  const revealed = stepIndex >= revealStep
  const outerShell =
    (mode === 'xray' || mode === 'principle') &&
    (part.id === 'hull-shell' || part.id === 'turret-shell')
  const dimmed =
    mode === 'explode' &&
    part.dimAfterStep !== undefined &&
    stepIndex > part.dimAfterStep

  const material = resolvePartMaterial({
    revealed: stepIndex === 0 || revealed,
    shell: outerShell,
    mode,
    dimmed,
    selected,
    role: part.id === 'crew-space' ? 'teaching-volume' : 'mechanical',
  })

  return {
    position:
      revealed && mode === 'explode'
        ? part.explodeOffset
        : ASSEMBLED_POSITION,
    material,
    scale: material.scale,
    emissiveIntensity: material.emissiveIntensity,
  }
}

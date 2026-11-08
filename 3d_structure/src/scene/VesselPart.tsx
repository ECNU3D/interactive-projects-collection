import type { ReactNode } from 'react'
import type { MeshStandardMaterial } from 'three'
import { asr10Steps } from '../content/asr10'
import type { Asr10PartId, PartDefinition } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  MechanicalPart,
  getMechanicalPartMotion,
  isMechanicalRaycastDisabled,
  isMechanicalShell,
  type MechanicalPartMotion,
} from './MechanicalPart'

export type VesselPartMotion = MechanicalPartMotion

const SHELL_IDS = new Set<Asr10PartId>([
  'vessel-hull-shell',
  'deck-superstructure',
])
const TEACHING_VOLUME_IDS = new Set<Asr10PartId>([
  'buoyancy-compartments',
])
const VESSEL_PART_OPTIONS = {
  shellIds: SHELL_IDS,
  teachingVolumeIds: TEACHING_VOLUME_IDS,
  steps: asr10Steps,
  shellOpacity: 0.14,
}

export function isVesselShell(partId: Asr10PartId) {
  return isMechanicalShell(partId, SHELL_IDS)
}

export function isVesselRaycastDisabled(
  partId: Asr10PartId,
  mode: ExploreMode,
) {
  return isMechanicalRaycastDisabled(partId, mode, SHELL_IDS)
}

export function getVesselPartMotion(
  part: PartDefinition<Asr10PartId>,
  stepIndex: number,
  mode: ExploreMode,
  selected: boolean,
): VesselPartMotion {
  return getMechanicalPartMotion(
    part,
    stepIndex,
    mode,
    selected,
    VESSEL_PART_OPTIONS,
  )
}

export interface VesselPartProps {
  definition: PartDefinition<Asr10PartId>
  stepIndex: number
  mode: ExploreMode
  selected: boolean
  reducedMotion: boolean
  onSelect: (partId: Asr10PartId) => void
  children:
    | ReactNode
    | ((material: MeshStandardMaterial) => ReactNode)
}

export function VesselPart({
  definition,
  stepIndex,
  mode,
  selected,
  reducedMotion,
  onSelect,
  children,
}: VesselPartProps) {
  return (
    <MechanicalPart
      definition={definition}
      stepIndex={stepIndex}
      mode={mode}
      selected={selected}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
      {...VESSEL_PART_OPTIONS}
      name={`teaching-vessel-part-${definition.id}`}
      userData={{
        exhibitKind: 'modern-rescue-vessel-teaching-composite',
        partId: definition.id,
      }}
    >
      {children}
    </MechanicalPart>
  )
}

import type { ReactNode } from 'react'
import type { MeshStandardMaterial } from 'three'
import { x57Steps } from '../content/x57'
import type { PartDefinition, X57PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  MechanicalPart,
  getMechanicalPartMotion,
  isMechanicalRaycastDisabled,
  isMechanicalShell,
  type MechanicalPartMotion,
} from './MechanicalPart'

export type AircraftPartMotion = MechanicalPartMotion

const SHELL_IDS = new Set<X57PartId>([
  'airframe-cabin',
  'high-aspect-wing',
])
const TEACHING_VOLUME_IDS = new Set<X57PartId>([
  'passive-cooling-path',
])
const AIRCRAFT_PART_OPTIONS = {
  shellIds: SHELL_IDS,
  teachingVolumeIds: TEACHING_VOLUME_IDS,
  steps: x57Steps,
  shellOpacity: 0.16,
}

export function isAircraftShell(partId: X57PartId) {
  return isMechanicalShell(partId, SHELL_IDS)
}

export function isAircraftRaycastDisabled(
  partId: X57PartId,
  mode: ExploreMode,
) {
  return isMechanicalRaycastDisabled(partId, mode, SHELL_IDS)
}

export function getAircraftPartMotion(
  part: PartDefinition<X57PartId>,
  stepIndex: number,
  mode: ExploreMode,
  selected: boolean,
): AircraftPartMotion {
  return getMechanicalPartMotion(
    part,
    stepIndex,
    mode,
    selected,
    AIRCRAFT_PART_OPTIONS,
  )
}

export interface AircraftPartProps {
  definition: PartDefinition<X57PartId>
  stepIndex: number
  mode: ExploreMode
  selected: boolean
  reducedMotion: boolean
  onSelect: (partId: X57PartId) => void
  children:
    | ReactNode
    | ((material: MeshStandardMaterial) => ReactNode)
}

export function AircraftPart({
  definition,
  stepIndex,
  mode,
  selected,
  reducedMotion,
  onSelect,
  children,
}: AircraftPartProps) {
  return (
    <MechanicalPart
      definition={definition}
      stepIndex={stepIndex}
      mode={mode}
      selected={selected}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
      {...AIRCRAFT_PART_OPTIONS}
      name={`aircraft-part-${definition.id}`}
    >
      {children}
    </MechanicalPart>
  )
}

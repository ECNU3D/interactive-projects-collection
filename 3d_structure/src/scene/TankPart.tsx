import type { ReactNode } from 'react'
import type { MeshStandardMaterial } from 'three'
import { m4Steps } from '../content/m4'
import type { PartDefinition, PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  MechanicalPart,
  type MechanicalMaterialPalette,
} from './MechanicalPart'

export const PART_MATERIAL_PALETTE = {
  brass: {
    color: '#9d7840',
    emissive: '#5e3e17',
    metalness: 0.38,
    roughness: 0.52,
  },
  oxide: {
    color: '#8b4431',
    emissive: '#4f1e13',
    metalness: 0.26,
    roughness: 0.62,
  },
  teal: {
    color: '#326f6d',
    emissive: '#123f40',
    metalness: 0.32,
    roughness: 0.58,
  },
} satisfies MechanicalMaterialPalette

const TANK_SHELL_IDS = new Set<PartId>([
  'hull-shell',
  'turret-shell',
])
const TANK_TEACHING_VOLUME_IDS = new Set<PartId>(['crew-space'])

export interface TankPartProps {
  definition: PartDefinition
  stepIndex: number
  mode: ExploreMode
  selected: boolean
  reducedMotion: boolean
  onSelect: (partId: PartId) => void
  children:
    | ReactNode
    | ((material: MeshStandardMaterial) => ReactNode)
}

export function TankPart({
  definition,
  stepIndex,
  mode,
  selected,
  reducedMotion,
  onSelect,
  children,
}: TankPartProps) {
  return (
    <MechanicalPart
      definition={definition}
      stepIndex={stepIndex}
      mode={mode}
      selected={selected}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
      shellIds={TANK_SHELL_IDS}
      teachingVolumeIds={TANK_TEACHING_VOLUME_IDS}
      steps={m4Steps}
      name={`tank-part-${definition.id}`}
      materialPalette={PART_MATERIAL_PALETTE}
    >
      {children}
    </MechanicalPart>
  )
}

import { Color, type MeshStandardMaterial } from 'three'
import type { ExploreMode } from '../experience/state'

export type PartMaterialState = 'solid' | 'pending' | 'xray' | 'dimmed'
export type PartMaterialEmphasis = 'idle' | 'hover' | 'selected'
export type PartMaterialRole = 'mechanical' | 'teaching-volume'

export interface PartMaterialRequest {
  revealed: boolean
  shell: boolean
  mode: ExploreMode
  dimmed?: boolean
  hovered?: boolean
  selected?: boolean
  role?: PartMaterialRole
}

export interface ResolvedPartMaterial {
  state: PartMaterialState
  role: PartMaterialRole
  opacity: number
  transparent: boolean
  depthWrite: boolean
  saturation: number
  emphasis: PartMaterialEmphasis
  scale: number
  emissiveIntensity: number
}

const MATERIAL_PROFILES: Record<
  PartMaterialState,
  Pick<
    ResolvedPartMaterial,
    'opacity' | 'transparent' | 'depthWrite' | 'saturation'
  > & { emissiveMultiplier: number }
> = {
  solid: {
    opacity: 1,
    transparent: false,
    depthWrite: true,
    saturation: 1,
    emissiveMultiplier: 1,
  },
  pending: {
    opacity: 1,
    transparent: false,
    depthWrite: true,
    saturation: 0.18,
    emissiveMultiplier: 0.25,
  },
  xray: {
    opacity: 0.16,
    transparent: true,
    depthWrite: false,
    saturation: 0.72,
    emissiveMultiplier: 1,
  },
  dimmed: {
    opacity: 1,
    transparent: false,
    depthWrite: true,
    saturation: 0.48,
    emissiveMultiplier: 0.55,
  },
}

const EMPHASIS_PROFILES: Record<
  PartMaterialEmphasis,
  Pick<ResolvedPartMaterial, 'scale' | 'emissiveIntensity'>
> = {
  idle: { scale: 1, emissiveIntensity: 0.06 },
  hover: { scale: 1.015, emissiveIntensity: 0.2 },
  selected: { scale: 1.035, emissiveIntensity: 0.48 },
}

const TEACHING_VOLUME_OPACITY: Record<PartMaterialState, number> = {
  solid: 0.3,
  pending: 0.2,
  xray: 0.16,
  dimmed: 0.22,
}

export function resolvePartMaterial({
  revealed,
  shell,
  mode,
  dimmed = false,
  hovered = false,
  selected = false,
  role = 'mechanical',
}: PartMaterialRequest): ResolvedPartMaterial {
  const state: PartMaterialState =
    shell && (mode === 'xray' || mode === 'principle')
      ? 'xray'
      : !revealed
        ? 'pending'
        : dimmed
          ? 'dimmed'
          : 'solid'
  const emphasis: PartMaterialEmphasis = selected
    ? 'selected'
    : hovered
      ? 'hover'
      : 'idle'
  const { emissiveMultiplier, ...materialProfile } =
    MATERIAL_PROFILES[state]
  const emphasisProfile = EMPHASIS_PROFILES[emphasis]
  const presentation =
    role === 'teaching-volume'
      ? {
          ...materialProfile,
          opacity: TEACHING_VOLUME_OPACITY[state],
          transparent: true,
          depthWrite: false,
        }
      : materialProfile

  return {
    state,
    role,
    ...presentation,
    emphasis,
    scale: emphasisProfile.scale,
    emissiveIntensity:
      emphasisProfile.emissiveIntensity * emissiveMultiplier,
  }
}

function setSaturation(color: Color, baseColor: string, saturation: number) {
  const hsl = new Color(baseColor).getHSL({ h: 0, s: 0, l: 0 })
  color.setHSL(hsl.h, hsl.s * saturation, hsl.l)
}

export function applyResolvedPartMaterial(
  material: MeshStandardMaterial,
  resolved: ResolvedPartMaterial,
  baseColor: string,
) {
  const pipelineChanged =
    material.transparent !== resolved.transparent ||
    material.depthWrite !== resolved.depthWrite

  material.transparent = resolved.transparent
  material.depthWrite = resolved.depthWrite
  material.opacity = resolved.opacity
  material.emissiveIntensity = resolved.emissiveIntensity
  setSaturation(material.color, baseColor, resolved.saturation)
  material.userData.partMaterialState = resolved.state
  material.userData.partMaterialRole = resolved.role
  material.userData.partMaterialEmphasis = resolved.emphasis

  if (pipelineChanged) {
    material.needsUpdate = true
  }

  return pipelineChanged
}

export function getResolvedPartMaterialColor(
  baseColor: string,
  saturation: number,
  target = new Color(),
) {
  setSaturation(target, baseColor, saturation)
  return target
}

export function synchronizePartMaterialPipeline(
  material: MeshStandardMaterial,
  resolved: ResolvedPartMaterial,
) {
  const pipelineChanged =
    material.transparent !== resolved.transparent ||
    material.depthWrite !== resolved.depthWrite

  material.transparent = resolved.transparent
  material.depthWrite = resolved.depthWrite
  material.userData.partMaterialState = resolved.state
  material.userData.partMaterialRole = resolved.role
  material.userData.partMaterialEmphasis = resolved.emphasis

  if (pipelineChanged) {
    material.needsUpdate = true
  }

  return pipelineChanged
}

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Color,
  Group,
  InstancedMesh,
  Line,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import type {
  ExhibitPartId,
  ExploreStep,
  PartDefinition,
} from '../content/types'
import type { ExploreMode } from '../experience/state'
import { isPartActivationGesture } from './partInteraction'
import { Select } from './SceneSelection'
import { MUSEUM_MECHANICAL_PALETTE } from './museumPalette'
import {
  applyResolvedPartMaterial,
  getResolvedPartMaterialColor,
  resolvePartMaterial,
  synchronizePartMaterialPipeline,
  type ResolvedPartMaterial,
} from './partMaterial'

export interface MechanicalPartMotion {
  position: readonly [number, number, number]
  material: ResolvedPartMaterial
  scale: number
  emissiveIntensity: number
}

export interface MechanicalPartMotionOptions<
  TPartId extends ExhibitPartId,
> {
  shellIds: ReadonlySet<TPartId>
  steps?: readonly Pick<ExploreStep, 'id' | 'index'>[]
  revealStepIndex?: number
  shellOpacity?: number
  hovered?: boolean
  teachingVolumeIds?: ReadonlySet<TPartId>
}

export interface MechanicalMaterialPaletteEntry {
  color: string
  emissive: string
  metalness: number
  roughness: number
}

export type MechanicalMaterialPalette = Record<
  PartDefinition['accent'],
  MechanicalMaterialPaletteEntry
>

export const MECHANICAL_MATERIAL_PALETTE: MechanicalMaterialPalette =
  MUSEUM_MECHANICAL_PALETTE

const ASSEMBLED_POSITION = [0, 0, 0] as const
const POSITION_DAMPING = 5.5
const SCALE_DAMPING = 8
const MATERIAL_DAMPING = 7
const SETTLED_EPSILON = 0.001
const DISABLED_RAYCAST: Object3D['raycast'] = () => undefined

const hoveredParts = new Set<symbol>()
let cursorBeforeMechanicalHover: string | null = null
const materialColorTargets = new WeakMap<MeshStandardMaterial, Color>()
const materialBaseColors = new WeakMap<MeshStandardMaterial, string>()

interface PendingMaterialDisposal {
  cancelled: boolean
}

const pendingMaterialDisposals = new WeakMap<
  MeshStandardMaterial,
  PendingMaterialDisposal
>()

export function isMechanicalShell<TPartId extends ExhibitPartId>(
  partId: TPartId,
  shellIds: ReadonlySet<TPartId>,
) {
  return shellIds.has(partId)
}

export function isMechanicalRaycastDisabled<
  TPartId extends ExhibitPartId,
>(
  partId: TPartId,
  mode: ExploreMode,
  shellIds: ReadonlySet<TPartId>,
) {
  return (
    isMechanicalShell(partId, shellIds) &&
    (mode === 'xray' || mode === 'principle')
  )
}

export function isMechanicalPartOutlineEnabled(
  selected: boolean,
  hovered: boolean,
) {
  return selected || hovered
}

export function beginMechanicalPartPointerHover(
  pointerIds: Set<number>,
  pointerId: number,
) {
  if (pointerIds.has(pointerId)) {
    return false
  }

  const becomesHovered = pointerIds.size === 0
  pointerIds.add(pointerId)
  return becomesHovered
}

export function endMechanicalPartPointerHover(
  pointerIds: Set<number>,
  pointerId: number,
) {
  return pointerIds.delete(pointerId) && pointerIds.size === 0
}

export function clearMechanicalPartPointerHovers(
  pointerIds: Set<number>,
) {
  const wasHovered = pointerIds.size > 0
  pointerIds.clear()
  return wasHovered
}

export function getMechanicalPartMotion<
  TPartId extends ExhibitPartId,
>(
  part: PartDefinition<TPartId>,
  stepIndex: number,
  mode: ExploreMode,
  selected: boolean,
  {
    shellIds,
    steps,
    revealStepIndex,
    shellOpacity = 0.16,
    hovered = false,
    teachingVolumeIds,
  }: MechanicalPartMotionOptions<TPartId>,
): MechanicalPartMotion {
  const revealStep =
    revealStepIndex ??
    steps?.find((step) => step.id === part.stepId)?.index ??
    0
  const revealed = stepIndex >= revealStep
  const shellIsTransparent =
    (mode === 'xray' || mode === 'principle') &&
    isMechanicalShell(part.id, shellIds)
  const dimmed =
    mode === 'explode' &&
    part.dimAfterStep !== undefined &&
    stepIndex > part.dimAfterStep

  const resolvedMaterial = resolvePartMaterial({
    revealed: stepIndex === 0 || revealed,
    shell: shellIsTransparent,
    mode,
    dimmed,
    hovered,
    selected,
    role: teachingVolumeIds?.has(part.id)
      ? 'teaching-volume'
      : 'mechanical',
  })
  const material =
    resolvedMaterial.state === 'xray'
      ? { ...resolvedMaterial, opacity: shellOpacity }
      : resolvedMaterial

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

export function setMechanicalPartHover(token: symbol, hovered: boolean) {
  if (typeof document === 'undefined' || !document.body) {
    return
  }

  if (hovered) {
    if (hoveredParts.has(token)) {
      return
    }

    if (hoveredParts.size === 0) {
      cursorBeforeMechanicalHover = document.body.style.cursor
    }

    hoveredParts.add(token)
    document.body.style.cursor = 'pointer'
    return
  }

  if (!hoveredParts.delete(token) || hoveredParts.size > 0) {
    return
  }

  document.body.style.cursor = cursorBeforeMechanicalHover ?? ''
  cursorBeforeMechanicalHover = null
}

export function applyMechanicalPartMotion(
  group: Group,
  material: MeshStandardMaterial,
  motion: MechanicalPartMotion,
) {
  group.position.set(...motion.position)
  group.scale.setScalar(motion.scale)
  applyResolvedPartMaterial(
    material,
    motion.material,
    getMechanicalPartBaseColor(material),
  )

  return isMechanicalPartMotionUnsettled(group, material, motion)
}

function canDisableRaycast(object: Object3D) {
  return (
    object instanceof Mesh ||
    object instanceof InstancedMesh ||
    object instanceof Line
  )
}

function isMechanicalPartMotionUnsettled(
  group: Group,
  material: MeshStandardMaterial,
  motion: MechanicalPartMotion,
) {
  return (
    Math.abs(group.position.x - motion.position[0]) > SETTLED_EPSILON ||
    Math.abs(group.position.y - motion.position[1]) > SETTLED_EPSILON ||
    Math.abs(group.position.z - motion.position[2]) > SETTLED_EPSILON ||
    Math.abs(group.scale.x - motion.scale) > SETTLED_EPSILON ||
    Math.abs(material.opacity - motion.material.opacity) > SETTLED_EPSILON ||
    Math.abs(
      material.emissiveIntensity - motion.emissiveIntensity,
    ) > SETTLED_EPSILON ||
    isColorUnsettled(
      material.color,
      getMechanicalPartTargetColor(material, motion.material.saturation),
    )
  )
}

function isColorUnsettled(color: Color, target: Color) {
  return (
    Math.abs(color.r - target.r) > SETTLED_EPSILON ||
    Math.abs(color.g - target.g) > SETTLED_EPSILON ||
    Math.abs(color.b - target.b) > SETTLED_EPSILON
  )
}

function getMechanicalPartBaseColor(material: MeshStandardMaterial) {
  const authoredBaseColor = material.userData.partMaterialBaseColor as
    | string
    | undefined

  if (authoredBaseColor) {
    materialBaseColors.set(material, authoredBaseColor)
    return authoredBaseColor
  }

  const cachedBaseColor = materialBaseColors.get(material)
  if (cachedBaseColor) {
    return cachedBaseColor
  }

  const baseColor = `#${material.color.getHexString()}`
  materialBaseColors.set(material, baseColor)
  return baseColor
}

function getMechanicalPartTargetColor(
  material: MeshStandardMaterial,
  saturation: number,
) {
  let target = materialColorTargets.get(material)

  if (!target) {
    target = new Color()
    materialColorTargets.set(material, target)
  }

  return getResolvedPartMaterialColor(
    getMechanicalPartBaseColor(material),
    saturation,
    target,
  )
}

export function dampMechanicalPartMotion(
  group: Group,
  material: MeshStandardMaterial,
  motion: MechanicalPartMotion,
  delta: number,
) {
  synchronizePartMaterialPipeline(material, motion.material)
  group.position.x = MathUtils.damp(
    group.position.x,
    motion.position[0],
    POSITION_DAMPING,
    delta,
  )
  group.position.y = MathUtils.damp(
    group.position.y,
    motion.position[1],
    POSITION_DAMPING,
    delta,
  )
  group.position.z = MathUtils.damp(
    group.position.z,
    motion.position[2],
    POSITION_DAMPING,
    delta,
  )
  const scale = MathUtils.damp(
    group.scale.x,
    motion.scale,
    SCALE_DAMPING,
    delta,
  )
  group.scale.setScalar(scale)
  material.opacity = MathUtils.damp(
    material.opacity,
    motion.material.opacity,
    MATERIAL_DAMPING,
    delta,
  )
  material.emissiveIntensity = MathUtils.damp(
    material.emissiveIntensity,
    motion.emissiveIntensity,
    MATERIAL_DAMPING,
    delta,
  )
  material.color.lerp(
    getMechanicalPartTargetColor(material, motion.material.saturation),
    1 - Math.exp(-MATERIAL_DAMPING * delta),
  )

  return isMechanicalPartMotionUnsettled(group, material, motion)
}

export function disableMechanicalPartRaycasts(root: Object3D) {
  const originalRaycasts = new Map<Object3D, Object3D['raycast']>()

  root.traverse((object) => {
    if (!canDisableRaycast(object)) {
      return
    }

    originalRaycasts.set(object, object.raycast)
    object.raycast = DISABLED_RAYCAST
  })

  return () => {
    originalRaycasts.forEach((raycast, object) => {
      object.raycast = raycast
    })
    originalRaycasts.clear()
  }
}

export function createMechanicalPartMaterial(
  palette: MechanicalMaterialPaletteEntry,
) {
  const material = new MeshStandardMaterial({
    color: palette.color,
    depthWrite: true,
    emissive: palette.emissive,
    emissiveIntensity: 0.06,
    metalness: palette.metalness,
    opacity: 1,
    roughness: palette.roughness,
    transparent: false,
  })
  material.userData.partMaterialBaseColor = palette.color
  materialBaseColors.set(material, palette.color)
  return material
}

function finalizeMechanicalPartMaterial(
  material: MeshStandardMaterial,
) {
  materialColorTargets.delete(material)
  materialBaseColors.delete(material)
  material.dispose()
}

export function retainMechanicalPartMaterial(
  material: MeshStandardMaterial,
) {
  const pendingDisposal = pendingMaterialDisposals.get(material)
  if (pendingDisposal) {
    pendingDisposal.cancelled = true
    pendingMaterialDisposals.delete(material)
  }

  let retained = true

  return () => {
    if (!retained) {
      return
    }
    retained = false

    const supersededDisposal = pendingMaterialDisposals.get(material)
    if (supersededDisposal) {
      supersededDisposal.cancelled = true
    }

    const disposal = { cancelled: false }
    pendingMaterialDisposals.set(material, disposal)
    queueMicrotask(() => {
      if (
        disposal.cancelled ||
        pendingMaterialDisposals.get(material) !== disposal
      ) {
        return
      }

      pendingMaterialDisposals.delete(material)
      finalizeMechanicalPartMaterial(material)
    })
  }
}

export interface MechanicalPartProps<
  TPartId extends ExhibitPartId,
> extends MechanicalPartMotionOptions<TPartId> {
  definition: PartDefinition<TPartId>
  stepIndex: number
  mode: ExploreMode
  selected: boolean
  reducedMotion: boolean
  onSelect: (partId: TPartId) => void
  name?: string
  userData?: Record<string, unknown>
  materialPalette?: MechanicalMaterialPalette
  children:
    | ReactNode
    | ((material: MeshStandardMaterial) => ReactNode)
}

export function MechanicalPart<TPartId extends ExhibitPartId>({
  definition,
  stepIndex,
  mode,
  selected,
  reducedMotion,
  onSelect,
  shellIds,
  steps,
  revealStepIndex,
  shellOpacity,
  teachingVolumeIds,
  name,
  userData,
  materialPalette = MECHANICAL_MATERIAL_PALETTE,
  children,
}: MechanicalPartProps<TPartId>) {
  const invalidate = useThree((state) => state.invalidate)
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<Group>(null)
  const initializedRef = useRef(false)
  const hoverPointerIdsRef = useRef(new Set<number>())
  const hoverToken = useMemo(() => Symbol(definition.id), [definition.id])
  const motion = useMemo(
    () =>
      getMechanicalPartMotion(definition, stepIndex, mode, selected, {
        shellIds,
        steps,
        revealStepIndex,
        shellOpacity,
        hovered,
        teachingVolumeIds,
      }),
    [
      definition,
      hovered,
      mode,
      revealStepIndex,
      selected,
      shellIds,
      shellOpacity,
      stepIndex,
      steps,
      teachingVolumeIds,
    ],
  )
  const material = useMemo(() => {
    const palette = materialPalette[definition.accent]

    return createMechanicalPartMaterial(palette)
  }, [definition.accent, materialPalette])
  const raycastDisabled = isMechanicalRaycastDisabled(
    definition.id,
    mode,
    shellIds,
  )

  useLayoutEffect(() => {
    const group = groupRef.current

    if (!group || (initializedRef.current && !reducedMotion)) {
      return
    }

    applyMechanicalPartMotion(group, material, motion)
    initializedRef.current = true
  }, [material, motion, reducedMotion])

  useLayoutEffect(() => {
    const group = groupRef.current

    if (!group || !raycastDisabled) {
      return
    }

    return disableMechanicalPartRaycasts(group)
  }, [raycastDisabled])

  useEffect(() => retainMechanicalPartMaterial(material), [material])

  useEffect(() => {
    invalidate()
  }, [invalidate, motion, raycastDisabled, reducedMotion])

  useEffect(
    () => () => {
      clearMechanicalPartPointerHovers(hoverPointerIdsRef.current)
      setMechanicalPartHover(hoverToken, false)
    },
    [hoverToken],
  )

  useFrame((_, delta) => {
    const group = groupRef.current

    if (!group || reducedMotion) {
      return
    }

    if (dampMechanicalPartMotion(group, material, motion, delta)) {
      invalidate()
    }
  })

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()

      if (isPartActivationGesture(event.delta)) {
        onSelect(definition.id)
      }
    },
    [definition.id, onSelect],
  )

  const handlePointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()

      if (
        !beginMechanicalPartPointerHover(
          hoverPointerIdsRef.current,
          event.pointerId,
        )
      ) {
        return
      }

      setMechanicalPartHover(hoverToken, true)
      setHovered(true)
      invalidate()
    },
    [hoverToken, invalidate],
  )

  const handlePointerOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()

      if (
        !endMechanicalPartPointerHover(
          hoverPointerIdsRef.current,
          event.pointerId,
        )
      ) {
        return
      }

      setMechanicalPartHover(hoverToken, false)
      setHovered(false)
      invalidate()
    },
    [hoverToken, invalidate],
  )

  return (
    <Select enabled={isMechanicalPartOutlineEnabled(selected, hovered)}>
      <group
        ref={groupRef}
        name={name ?? `mechanical-part-${definition.id}`}
        userData={{
          ...userData,
          partMaterial: motion.material.state,
          partMaterialRole: motion.material.role,
          'data-part-material': motion.material.state,
        }}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {typeof children === 'function' ? children(material) : children}
      </group>
    </Select>
  )
}

import { useFrame, useThree } from '@react-three/fiber'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import type { Group, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { firearmExhibits } from '../content/firearms'
import {
  firearmPartIds,
  type ExploreStep,
  type FirearmExhibitId,
  type FirearmPartId,
  type PartDefinition,
} from '../content/types'
import type { ExploreMode } from '../experience/state'
import { MechanicalPart } from './MechanicalPart'
import {
  FIREARM_CYCLE_PHASE_DURATION_MS,
  sampleFirearmCycle,
  type FirearmCycleSample,
} from './firearmCycle'
import {
  FIREARM_CONFIGS,
  type FirearmPartTransform,
} from './firearmConfigs'
import {
  BarrelAxis,
  BreechMember,
  CycleIndicator,
  ExtractionTrace,
  FeedSilhouette,
  InertRoundPath,
  IsolatedInputModule,
  LockDelayElement,
  ReceiverShell,
  ReturnDrive,
  SupportShell,
} from './FirearmGeometry'
import type { ExhibitCycleState, ExhibitSceneProps } from './types'

export const PROCEDURAL_FIREARM_PART_IDS = firearmPartIds

export interface FirearmSampleRequest {
  active: boolean
  phaseIndex: number
  phaseProgress: number
}

export function resolveFirearmPhaseProgress(
  currentProgress: number,
  previousPhaseIndex: number,
  previousRevision: number,
  mode: ExploreMode,
  cycleState: ExhibitCycleState | undefined,
  reducedMotion: boolean,
  elapsedMs: number,
) {
  if (mode !== 'principle') return 0
  if (reducedMotion || cycleState?.status === 'complete') return 1

  const phaseIndex = cycleState?.phaseIndex ?? 0
  const revision = cycleState?.revision ?? 0
  if (
    phaseIndex !== previousPhaseIndex ||
    revision !== previousRevision
  ) {
    return 0
  }

  const progress = Math.min(1, Math.max(0, currentProgress))
  if (cycleState?.status !== 'playing') return progress

  return Math.min(
    1,
    progress + Math.max(0, elapsedMs) / FIREARM_CYCLE_PHASE_DURATION_MS,
  )
}

export function getFirearmSampleRequest(
  mode: ExploreMode,
  cycleState: ExhibitCycleState | undefined,
  reducedMotion: boolean,
  phaseProgress: number,
): FirearmSampleRequest | null {
  if (mode !== 'principle') return null
  if (!cycleState) {
    return { active: false, phaseIndex: 0, phaseProgress: 0 }
  }
  if (cycleState.status === 'complete') {
    return { active: false, phaseIndex: 5, phaseProgress: 1 }
  }
  if (reducedMotion) {
    return {
      active: false,
      phaseIndex: cycleState.phaseIndex,
      phaseProgress: 1,
    }
  }

  const clampedProgress = Math.min(1, Math.max(0, phaseProgress))
  return {
    active: cycleState.status === 'playing' && clampedProgress < 1,
    phaseIndex: cycleState.phaseIndex,
    phaseProgress: clampedProgress,
  }
}

export function getProceduralFirearmPartCoverage(
  exhibitId: FirearmExhibitId,
): readonly FirearmPartId[] {
  return FIREARM_CONFIGS[exhibitId].partIds
}

export function getProjectileSubstituteOpacity(
  visible: boolean,
  projectileX: number,
) {
  if (!visible) return 0
  const fadeProgress = Math.min(1, Math.max(0, (projectileX - 0.52) / 0.24))
  return 0.58 * (1 - fadeProgress * 0.72)
}

export interface FirearmModelProps
  extends Pick<
    ExhibitSceneProps,
    | 'stepIndex'
    | 'mode'
    | 'selectedPartId'
    | 'autoplay'
    | 'reducedMotion'
    | 'onSelect'
    | 'cycleState'
  > {
  exhibitId: FirearmExhibitId
}

interface FirearmPartProps
  extends Pick<
    FirearmModelProps,
    'stepIndex' | 'mode' | 'selectedPartId' | 'reducedMotion' | 'onSelect'
  > {
  id: FirearmPartId
  definition: PartDefinition<FirearmPartId>
  transform: FirearmPartTransform
  shellIds: ReadonlySet<FirearmPartId>
  steps: readonly ExploreStep[]
  children: (material: MeshStandardMaterial) => ReactNode
}

function FirearmPart({
  id,
  definition,
  transform,
  shellIds,
  steps,
  stepIndex,
  mode,
  selectedPartId,
  reducedMotion,
  onSelect,
  children,
}: FirearmPartProps) {
  return (
    <MechanicalPart
      definition={definition}
      stepIndex={stepIndex}
      mode={mode}
      selected={selectedPartId === id}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
      shellIds={shellIds}
      steps={steps}
      name={`firearm-part-${id}`}
      userData={{ selectablePartId: id, authoredAs: 'dimensionless-teaching-form' }}
    >
      {(material) => (
        <group
          position={transform.position}
          rotation={transform.rotation}
          scale={transform.scale}
        >
          {children(material)}
        </group>
      )}
    </MechanicalPart>
  )
}

export interface FirearmCycleVisualRefs {
  breech: RefObject<Group | null>
  barrel: RefObject<Group | null>
  lock: RefObject<Group | null>
  drive: RefObject<Group | null>
  feed: RefObject<Group | null>
  extractedCase: RefObject<Group | null>
  extractedCaseMaterial: RefObject<MeshPhysicalMaterial | null>
  projectile: RefObject<Group | null>
  projectileMaterial: RefObject<MeshPhysicalMaterial | null>
  indicator: RefObject<Group | null>
  energy: RefObject<Group | null>
}

export function applyFirearmCycleVisuals(
  refs: FirearmCycleVisualRefs,
  sample: FirearmCycleSample | null,
) {
  if (refs.breech.current) {
    refs.breech.current.position.x = (sample?.breechX ?? 0) * 1.25
    refs.breech.current.rotation.x = sample?.breechRotation ?? 0
  }
  if (refs.barrel.current) {
    refs.barrel.current.position.x = (sample?.barrelX ?? 0) * 1.15
    refs.barrel.current.position.y = (sample?.barrelY ?? 0) * 1.4
  }
  if (refs.lock.current) {
    const amount = sample?.lockAmount ?? 0
    refs.lock.current.position.y = -amount * 0.13
    refs.lock.current.rotation.z = amount * 0.28
  }
  if (refs.drive.current) {
    refs.drive.current.position.x = (sample?.driveX ?? 0) * 1.3
    refs.drive.current.scale.x = 1 - (sample?.returnCompression ?? 0) * 0.32
  }
  if (refs.feed.current) {
    refs.feed.current.position.y = (sample?.feedLift ?? 0) * 0.72
  }
  if (refs.extractedCase.current) {
    refs.extractedCase.current.position.x = (sample?.caseX ?? 0) * 1.8
    refs.extractedCase.current.position.y = (sample?.caseY ?? 0) * 1.45
    refs.extractedCase.current.visible = sample?.caseVisible ?? false
  }
  if (refs.extractedCaseMaterial.current) {
    refs.extractedCaseMaterial.current.opacity = sample?.caseVisible ? 0.62 : 0
  }
  if (refs.projectile.current) {
    const projectileX = sample?.projectileX ?? 0
    refs.projectile.current.position.x = projectileX * 2.1
    refs.projectile.current.visible = sample?.projectileVisible ?? false
  }
  if (refs.projectileMaterial.current) {
    refs.projectileMaterial.current.opacity = getProjectileSubstituteOpacity(
      sample?.projectileVisible ?? false,
      sample?.projectileX ?? 0,
    )
  }
  if (refs.indicator.current) {
    const energy = sample?.energyAmount ?? 0
    refs.indicator.current.rotation.z = energy * Math.PI * 1.6
    refs.indicator.current.scale.setScalar(0.8 + energy * 0.35)
  }
  if (refs.energy.current) {
    const energy = sample?.energyAmount ?? 0
    refs.energy.current.visible = energy > 0.001
    refs.energy.current.scale.x = 0.35 + energy * 1.25
  }
}

function getPartDefinitions(exhibitId: FirearmExhibitId) {
  return firearmExhibits[exhibitId].parts as readonly PartDefinition<FirearmPartId>[]
}

export function FirearmModel(props: FirearmModelProps) {
  const config = FIREARM_CONFIGS[props.exhibitId]
  const exhibit = firearmExhibits[props.exhibitId]
  const definitions = getPartDefinitions(props.exhibitId)
  const partsById = useMemo(
    () =>
      Object.fromEntries(
        definitions.map((part) => [part.id, part]),
      ) as Record<FirearmPartId, PartDefinition<FirearmPartId>>,
    [definitions],
  )
  const shellIds = useMemo(() => new Set(config.shellIds), [config.shellIds])
  const phaseProgressRef = useRef(0)
  const phaseIndexRef = useRef(props.cycleState?.phaseIndex ?? 0)
  const phaseRevisionRef = useRef(props.cycleState?.revision ?? 0)
  const breechRef = useRef<Group>(null)
  const barrelRef = useRef<Group>(null)
  const lockRef = useRef<Group>(null)
  const driveRef = useRef<Group>(null)
  const feedRef = useRef<Group>(null)
  const extractedCaseRef = useRef<Group>(null)
  const extractedCaseMaterialRef = useRef<MeshPhysicalMaterial>(null)
  const projectileRef = useRef<Group>(null)
  const projectileMaterialRef = useRef<MeshPhysicalMaterial>(null)
  const indicatorRef = useRef<Group>(null)
  const energyRef = useRef<Group>(null)
  const invalidate = useThree((state) => state.invalidate)
  const motionRefs: FirearmCycleVisualRefs = {
    breech: breechRef,
    barrel: barrelRef,
    lock: lockRef,
    drive: driveRef,
    feed: feedRef,
    extractedCase: extractedCaseRef,
    extractedCaseMaterial: extractedCaseMaterialRef,
    projectile: projectileRef,
    projectileMaterial: projectileMaterialRef,
    indicator: indicatorRef,
    energy: energyRef,
  }

  useLayoutEffect(() => {
    phaseProgressRef.current = resolveFirearmPhaseProgress(
      phaseProgressRef.current,
      phaseIndexRef.current,
      phaseRevisionRef.current,
      props.mode,
      props.cycleState,
      props.reducedMotion,
      0,
    )
    phaseIndexRef.current = props.cycleState?.phaseIndex ?? 0
    phaseRevisionRef.current = props.cycleState?.revision ?? 0

    const request = getFirearmSampleRequest(
      props.mode,
      props.cycleState,
      props.reducedMotion,
      phaseProgressRef.current,
    )
    const sample = request
      ? sampleFirearmCycle(
          config.cycleKind,
          request.phaseIndex,
          request.phaseProgress,
        )
      : null
    applyFirearmCycleVisuals(motionRefs, sample)
    invalidate()
  }, [
    config.cycleKind,
    invalidate,
    props.cycleState?.phaseIndex,
    props.cycleState?.revision,
    props.cycleState?.status,
    props.mode,
    props.reducedMotion,
  ])

  useFrame((_, delta) => {
    const request = getFirearmSampleRequest(
      props.mode,
      props.cycleState,
      props.reducedMotion,
      phaseProgressRef.current,
    )
    if (!request?.active) return

    phaseProgressRef.current = resolveFirearmPhaseProgress(
      phaseProgressRef.current,
      phaseIndexRef.current,
      phaseRevisionRef.current,
      props.mode,
      props.cycleState,
      props.reducedMotion,
      delta * 1_000,
    )
    const sample = sampleFirearmCycle(
      config.cycleKind,
      request.phaseIndex,
      phaseProgressRef.current,
    )
    applyFirearmCycleVisuals(motionRefs, sample)
    invalidate()
  })

  const partProps = {
    stepIndex: props.stepIndex,
    mode: props.mode,
    selectedPartId: props.selectedPartId,
    reducedMotion: props.reducedMotion,
    onSelect: props.onSelect,
    shellIds,
    steps: exhibit.steps,
  }

  return (
    <group
      name={`procedural-firearm-${props.exhibitId}`}
      position={[0, -0.16, 0]}
      userData={{
        exhibitId: props.exhibitId,
        orientation: 'museum-side-profile',
        units: 'dimensionless-teaching-coordinates',
        safetyScope: 'mechanical-relationships-only',
      }}
    >
      <FirearmPart
        {...partProps}
        id="firearm-support-shell"
        definition={partsById['firearm-support-shell']}
        transform={config.partTransforms['firearm-support-shell']}
      >
        {(material) => (
          <SupportShell
            material={material}
            profile={config.profile}
            supportLength={config.proportions.supportLength}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-receiver-shell"
        definition={partsById['firearm-receiver-shell']}
        transform={config.partTransforms['firearm-receiver-shell']}
      >
        {(material) => (
          <ReceiverShell
            material={material}
            bodyLength={config.proportions.bodyLength}
            profile={config.profile}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-barrel-chamber"
        definition={partsById['firearm-barrel-chamber']}
        transform={config.partTransforms['firearm-barrel-chamber']}
      >
        {(material) => (
          <BarrelAxis
            material={material}
            barrelLength={config.proportions.barrelLength}
            motionRef={barrelRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-breech-member"
        definition={partsById['firearm-breech-member']}
        transform={config.partTransforms['firearm-breech-member']}
      >
        {(material) => (
          <BreechMember
            material={material}
            bodyLength={config.proportions.bodyLength}
            motionRef={breechRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-lock-delay-system"
        definition={partsById['firearm-lock-delay-system']}
        transform={config.partTransforms['firearm-lock-delay-system']}
      >
        {(material) => (
          <LockDelayElement
            material={material}
            cycleKind={config.cycleKind}
            motionRef={lockRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-return-drive-system"
        definition={partsById['firearm-return-drive-system']}
        transform={config.partTransforms['firearm-return-drive-system']}
      >
        {(material) => (
          <ReturnDrive
            material={material}
            cycleKind={config.cycleKind}
            motionRef={driveRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-input-linkage"
        definition={partsById['firearm-input-linkage']}
        transform={config.partTransforms['firearm-input-linkage']}
      >
        {(material) => <IsolatedInputModule material={material} />}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-feed-module"
        definition={partsById['firearm-feed-module']}
        transform={config.partTransforms['firearm-feed-module']}
      >
        {(material) => (
          <FeedSilhouette
            material={material}
            profile={config.profile}
            motionRef={feedRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-extraction-path"
        definition={partsById['firearm-extraction-path']}
        transform={config.partTransforms['firearm-extraction-path']}
      >
        {(material) => (
          <ExtractionTrace
            material={material}
            substituteRef={extractedCaseRef}
            substituteMaterialRef={extractedCaseMaterialRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-inert-round-path"
        definition={partsById['firearm-inert-round-path']}
        transform={config.partTransforms['firearm-inert-round-path']}
      >
        {() => (
          <InertRoundPath
            projectileRef={projectileRef}
            projectileMaterialRef={projectileMaterialRef}
          />
        )}
      </FirearmPart>
      <FirearmPart
        {...partProps}
        id="firearm-cycle-indicator"
        definition={partsById['firearm-cycle-indicator']}
        transform={config.partTransforms['firearm-cycle-indicator']}
      >
        {(material) => (
          <CycleIndicator
            material={material}
            indicatorRef={indicatorRef}
            energyRef={energyRef}
          />
        )}
      </FirearmPart>
    </group>
  )
}

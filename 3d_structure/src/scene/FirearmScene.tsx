import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { firearmExhibits } from '../content/firearms'
import {
  firearmExhibitIds,
  type ExhibitId,
  type ExhibitPartId,
  type FirearmExhibitId,
  type FirearmPartId,
  type PartDefinition,
} from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  advanceCameraFocusTarget,
  applyCameraCommand,
  type CameraCommand,
  type CameraVector,
} from './cameraControls'
import { FirearmModel } from './FirearmModel'
import { FIREARM_CYCLE_PHASE_DURATION_MS } from './firearmCycle'
import {
  FIREARM_CONFIGS,
  type FirearmProfile,
} from './firearmConfigs'
import { getMechanicalPartMotion } from './MechanicalPart'
import {
  getContactShadowRevision,
  getSceneQualityProfile,
  type SceneQualityProfile,
} from './sceneQuality'
import { ScenePresentation } from './ScenePresentation'
import { getSceneCanvasSettings } from './sceneSupport'
import type { ExhibitCycleState, ExhibitSceneProps } from './types'

export type FirearmSceneProps = ExhibitSceneProps

export const DEFAULT_FIREARM_CAMERA_TARGET: CameraVector = [0, 0.28, 0]

export interface FirearmCameraPreset {
  position: CameraVector
  fov: number
  minDistance: number
  maxDistance: number
}

const CAMERA_PRESETS = {
  rifle: {
    position: [0.32, 2.25, 11.2],
    fov: 39,
    minDistance: 7.4,
    maxDistance: 15,
  },
  pistol: {
    position: [0.24, 1.8, 7.1],
    fov: 41,
    minDistance: 4.8,
    maxDistance: 10.2,
  },
  compact: {
    position: [0.28, 2, 8.3],
    fov: 40,
    minDistance: 5.5,
    maxDistance: 11.8,
  },
} as const satisfies Record<FirearmProfile, FirearmCameraPreset>

const FIREARM_ID_SET = new Set<ExhibitId>(firearmExhibitIds)

export function isFirearmSceneExhibit(
  exhibitId: ExhibitId,
): exhibitId is FirearmExhibitId {
  return FIREARM_ID_SET.has(exhibitId)
}

export function getFirearmSceneLabel(exhibitId: FirearmExhibitId) {
  return firearmExhibits[exhibitId].modelLabel
}

export function getFirearmStageConfig(exhibitId: FirearmExhibitId) {
  const profile = FIREARM_CONFIGS[exhibitId].profile

  return {
    floorY: -1.5,
    radius: profile === 'rifle' ? 4.8 : 3.8,
    label: getFirearmSceneLabel(exhibitId)
      .replace('可交互机械循环教学模型', '')
      .trim(),
  } as const
}

export function getFirearmCameraPreset(
  profile: FirearmProfile,
): FirearmCameraPreset {
  return CAMERA_PRESETS[profile]
}

function toFirearmPartId(
  exhibitId: FirearmExhibitId,
  partId: ExhibitPartId | null | undefined,
): FirearmPartId | null {
  if (!partId) return null
  return FIREARM_CONFIGS[exhibitId].partIds.includes(partId as FirearmPartId)
    ? (partId as FirearmPartId)
    : null
}

export function getFirearmFocusTarget(
  exhibitId: FirearmExhibitId,
  partId: FirearmPartId | null,
  stepIndex: number,
  mode: ExploreMode,
): CameraVector {
  if (!partId) return DEFAULT_FIREARM_CAMERA_TARGET

  const config = FIREARM_CONFIGS[exhibitId]
  const exhibit = firearmExhibits[exhibitId]
  const definition = exhibit.parts.find(
    (part) => part.id === partId,
  ) as PartDefinition<FirearmPartId> | undefined
  if (!definition) return DEFAULT_FIREARM_CAMERA_TARGET

  const motion = getMechanicalPartMotion(
    definition,
    stepIndex,
    mode,
    false,
    {
      shellIds: new Set(config.shellIds),
      steps: exhibit.steps,
    },
  )
  const focus = config.focusPoints[partId]

  return [
    focus[0] + motion.position[0],
    focus[1] + motion.position[1] - 0.16,
    focus[2] + motion.position[2],
  ]
}

export function getFirearmFrameloop(
  mode: ExploreMode,
  cycleState: ExhibitCycleState | undefined,
  reducedMotion: boolean,
) {
  return mode === 'principle' &&
    cycleState?.status === 'playing' &&
    !reducedMotion
    ? 'always'
    : 'demand'
}

interface FirearmShadowState {
  stepIndex: number
  mode: ExploreMode
  autoplay: boolean
  resetToken: number
  cycleState?: ExhibitCycleState
}

export function getFirearmContactShadowRevision(
  state: FirearmShadowState,
) {
  const { cycleState, ...sceneState } = state
  return `${getContactShadowRevision({
    ...sceneState,
    selectedPartId: null,
  })}:${cycleState?.phaseIndex ?? 0}:${
    cycleState?.status ?? 'idle'
  }:${cycleState?.revision ?? 0}`
}

export function getFirearmContactShadowFrames(
  sceneQuality: Pick<
    SceneQualityProfile,
    'shadowFrames' | 'shadowResolution'
  >,
  cycleState: ExhibitCycleState | undefined,
  reducedMotion: boolean,
) {
  if (reducedMotion) return 1
  if (cycleState?.status === 'playing') {
    const captureFps = sceneQuality.shadowResolution >= 512 ? 60 : 30
    return Math.max(
      1,
      Math.ceil(
        (FIREARM_CYCLE_PHASE_DURATION_MS / 1_000) * captureFps,
      ),
    )
  }
  if (
    cycleState?.status === 'paused' ||
    cycleState?.status === 'complete'
  ) {
    return 1
  }

  return Number.isFinite(sceneQuality.shadowFrames)
    ? Math.max(1, Math.trunc(sceneQuality.shadowFrames))
    : 1
}

interface SceneControlsProps {
  resetToken: number
  reducedMotion: boolean
  focusTarget: CameraVector
  cameraCommand?: CameraCommand
  preset: FirearmCameraPreset
  onReady?: () => void
}

function SceneControls({
  resetToken,
  reducedMotion,
  focusTarget,
  cameraCommand,
  preset,
  onReady,
}: SceneControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastCameraCommandTokenRef = useRef<number | null>(null)
  const { camera, invalidate } = useThree()

  useLayoutEffect(() => {
    camera.position.set(...preset.position)
    camera.lookAt(...DEFAULT_FIREARM_CAMERA_TARGET)
    camera.updateProjectionMatrix()
    controlsRef.current?.target.set(...DEFAULT_FIREARM_CAMERA_TARGET)
    controlsRef.current?.update()
    lastCameraCommandTokenRef.current = null
    invalidate()
    onReady?.()
  }, [camera, invalidate, onReady, preset, resetToken])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    if (
      cameraCommand &&
      lastCameraCommandTokenRef.current !== cameraCommand.token
    ) {
      const result = applyCameraCommand(
        camera.position.toArray() as unknown as CameraVector,
        controls.target.toArray() as unknown as CameraVector,
        focusTarget,
        cameraCommand.type,
        { min: preset.minDistance, max: preset.maxDistance },
      )
      camera.position.set(...result.position)
      controls.target.set(...result.target)
      controls.update()
      lastCameraCommandTokenRef.current = cameraCommand.token
      invalidate()
      return
    }

    const currentTarget = controls.target.toArray() as unknown as CameraVector
    const nextTarget = advanceCameraFocusTarget(
      currentTarget,
      focusTarget,
      delta,
      reducedMotion,
    )

    if (
      nextTarget.some(
        (coordinate, index) => coordinate !== currentTarget[index],
      )
    ) {
      controls.target.set(...nextTarget)
      controls.update()
      invalidate()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping={!reducedMotion}
      dampingFactor={0.075}
      minDistance={preset.minDistance}
      maxDistance={preset.maxDistance}
      minPolarAngle={0.78}
      maxPolarAngle={1.52}
      minAzimuthAngle={-0.42}
      maxAzimuthAngle={0.42}
      target={DEFAULT_FIREARM_CAMERA_TARGET}
    />
  )
}

interface ValidFirearmSceneProps extends FirearmSceneProps {
  exhibitId: FirearmExhibitId
}

function ValidFirearmScene({
  exhibitId,
  stepIndex,
  mode,
  selectedPartId,
  focusPartId = selectedPartId,
  autoplay,
  reducedMotion,
  resetToken,
  cameraCommand,
  onSelect,
  onReady,
  cycleState,
  cycleDescriptionId,
}: ValidFirearmSceneProps) {
  const config = FIREARM_CONFIGS[exhibitId]
  const selectedFirearmPartId = toFirearmPartId(exhibitId, selectedPartId)
  const focusFirearmPartId = toFirearmPartId(exhibitId, focusPartId)
  const focusTarget = useMemo(
    () =>
      getFirearmFocusTarget(
        exhibitId,
        focusFirearmPartId,
        stepIndex,
        mode,
      ),
    [exhibitId, focusFirearmPartId, mode, stepIndex],
  )
  const preset = getFirearmCameraPreset(config.profile)
  const sceneQuality = useMemo(
    () =>
      getSceneQualityProfile({
        viewportWidth:
          typeof window === 'undefined'
            ? Number.POSITIVE_INFINITY
            : window.innerWidth,
        coarsePointer:
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(pointer: coarse)').matches,
      }),
    [],
  )
  const shadowRevision = getFirearmContactShadowRevision({
    stepIndex,
    mode,
    autoplay,
    resetToken,
    cycleState,
  })
  const shadowFrames = getFirearmContactShadowFrames(
    sceneQuality,
    cycleState,
    reducedMotion,
  )

  return (
    <Canvas
      aria-label={getFirearmSceneLabel(exhibitId)}
      aria-describedby={cycleDescriptionId}
      role="img"
      tabIndex={0}
      data-scene-profile={sceneQuality.postprocessing ? 'desktop' : 'constrained'}
      data-canvas-shadows={sceneQuality.shadows ? 'on' : 'off'}
      data-postprocessing={sceneQuality.postprocessing ? 'on' : 'off'}
      data-shadow-mode={sceneQuality.shadowMode}
      frameloop={getFirearmFrameloop(mode, cycleState, reducedMotion)}
      {...getSceneCanvasSettings(sceneQuality)}
      camera={{
        position: preset.position,
        fov: preset.fov,
        near: 0.1,
        far: 80,
      }}
    >
      <ScenePresentation
        quality={sceneQuality}
        reducedMotion={reducedMotion}
        shadowRevision={shadowRevision}
        shadowFrames={shadowFrames}
        principleAnimationActive={
          getFirearmFrameloop(mode, cycleState, reducedMotion) === 'always'
        }
        stage={getFirearmStageConfig(exhibitId)}
      >
        <FirearmModel
          key={resetToken}
          exhibitId={exhibitId}
          stepIndex={stepIndex}
          mode={mode}
          selectedPartId={selectedFirearmPartId}
          autoplay={autoplay}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          cycleState={cycleState}
        />
      </ScenePresentation>
      <SceneControls
        resetToken={resetToken}
        reducedMotion={reducedMotion}
        focusTarget={focusTarget}
        cameraCommand={cameraCommand}
        preset={preset}
        onReady={onReady}
      />
    </Canvas>
  )
}

export default function FirearmScene(props: FirearmSceneProps) {
  if (!isFirearmSceneExhibit(props.exhibitId)) return null
  return <ValidFirearmScene {...props} exhibitId={props.exhibitId} />
}

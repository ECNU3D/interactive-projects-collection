import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { asr10Parts, asr10Steps } from '../content/asr10'
import type {
  Asr10PartId,
  ExhibitPartId,
  PartDefinition,
} from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  advanceCameraFocusTarget,
  applyCameraCommand,
  type CameraCommand,
  type CameraVector,
} from './cameraControls'
import {
  getContactShadowRevision,
  getSceneQualityProfile,
} from './sceneQuality'
import { ScenePresentation } from './ScenePresentation'
import { getSceneCanvasSettings } from './sceneSupport'
import type { ExhibitSceneProps } from './types'
import {
  VESSEL_FOCUS_POINTS,
  VESSEL_MODEL_POSITION,
  VESSEL_MODEL_SCALE,
  VESSEL_PROCEDURAL_PART_IDS,
  VesselModel,
} from './VesselModel'
import { getVesselPartMotion } from './VesselPart'

export type { CameraCommand, CameraCommandType } from './cameraControls'
export { getSceneQualityProfile } from './sceneQuality'

export type VesselSceneProps = ExhibitSceneProps

export const VESSEL_SCENE_LABEL =
  '现代救援船教学复合模型可交互三维结构模型'
export const DEFAULT_VESSEL_CAMERA_FOV = 40
export const DEFAULT_VESSEL_CAMERA_TARGET: CameraVector = [0, 0.35, 0]
const DEFAULT_VESSEL_CAMERA_POSITION: CameraVector = [8.4, 5.2, 9.4]
const VESSEL_MIN_CAMERA_DISTANCE = 5.8
const VESSEL_MAX_CAMERA_DISTANCE = 15
export const VESSEL_STAGE_CONFIG = {
  floorY: -0.55,
  radius: 5.15,
  label: '现代救援船教学复合模型',
  variant: 'water',
} as const

export function getVesselFrameloop(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
    ? 'always'
    : 'demand'
}

export function isVesselWaterAnimated(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
}

const VESSEL_PART_IDS = new Set<Asr10PartId>(
  VESSEL_PROCEDURAL_PART_IDS,
)
const PARTS_BY_ID = Object.fromEntries(
  asr10Parts.map((part) => [part.id, part]),
) as Record<Asr10PartId, PartDefinition<Asr10PartId>>

function toVesselPartId(partId: ExhibitPartId | null | undefined) {
  return partId && VESSEL_PART_IDS.has(partId as Asr10PartId)
    ? (partId as Asr10PartId)
    : null
}

export function getVesselFocusTarget(
  partId: Asr10PartId | null,
  stepIndex: number,
  mode: ExploreMode,
): CameraVector {
  if (!partId) return DEFAULT_VESSEL_CAMERA_TARGET

  const part = PARTS_BY_ID[partId]
  const base = VESSEL_FOCUS_POINTS[partId]
  const motion = getVesselPartMotion(part, stepIndex, mode, false)

  return [
    VESSEL_MODEL_POSITION[0] +
      (base[0] + motion.position[0]) * VESSEL_MODEL_SCALE,
    VESSEL_MODEL_POSITION[1] +
      (base[1] + motion.position[1]) * VESSEL_MODEL_SCALE,
    VESSEL_MODEL_POSITION[2] +
      (base[2] + motion.position[2]) * VESSEL_MODEL_SCALE,
  ]
}

interface SceneControlsProps {
  resetToken: number
  reducedMotion: boolean
  focusTarget: CameraVector
  cameraCommand?: CameraCommand
  onReady?: () => void
}

function SceneControls({
  resetToken,
  reducedMotion,
  focusTarget,
  cameraCommand,
  onReady,
}: SceneControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastCameraCommandTokenRef = useRef<number | null>(null)
  const { camera, invalidate } = useThree()

  useLayoutEffect(() => {
    camera.position.set(...DEFAULT_VESSEL_CAMERA_POSITION)
    camera.lookAt(...DEFAULT_VESSEL_CAMERA_TARGET)
    camera.updateProjectionMatrix()
    controlsRef.current?.target.set(...DEFAULT_VESSEL_CAMERA_TARGET)
    controlsRef.current?.update()
    lastCameraCommandTokenRef.current = null
    invalidate()
    onReady?.()
  }, [camera, invalidate, onReady, resetToken])

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
        {
          min: VESSEL_MIN_CAMERA_DISTANCE,
          max: VESSEL_MAX_CAMERA_DISTANCE,
        },
      )
      camera.position.set(...result.position)
      controls.target.set(...result.target)
      controls.update()
      lastCameraCommandTokenRef.current = cameraCommand.token
      invalidate()
      return
    }

    const current = controls.target.toArray() as unknown as CameraVector
    const next = advanceCameraFocusTarget(
      current,
      focusTarget,
      delta,
      reducedMotion,
    )

    if (next.some((coordinate, index) => coordinate !== current[index])) {
      controls.target.set(...next)
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
      minDistance={VESSEL_MIN_CAMERA_DISTANCE}
      maxDistance={VESSEL_MAX_CAMERA_DISTANCE}
      minPolarAngle={0.48}
      maxPolarAngle={1.48}
      target={DEFAULT_VESSEL_CAMERA_TARGET}
    />
  )
}

export default function VesselScene({
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
}: VesselSceneProps) {
  const selectedVesselPartId = toVesselPartId(selectedPartId)
  const focusVesselPartId = toVesselPartId(focusPartId)
  const focusTarget = useMemo(
    () => getVesselFocusTarget(focusVesselPartId, stepIndex, mode),
    [focusVesselPartId, mode, stepIndex],
  )
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
  const shadowRevision = getContactShadowRevision({
    stepIndex,
    mode,
    selectedPartId: null,
    autoplay,
    resetToken,
  })

  return (
    <Canvas
      aria-label={VESSEL_SCENE_LABEL}
      role="img"
      tabIndex={0}
      data-scene-profile={sceneQuality.postprocessing ? 'desktop' : 'constrained'}
      data-canvas-shadows={sceneQuality.shadows ? 'on' : 'off'}
      data-postprocessing={sceneQuality.postprocessing ? 'on' : 'off'}
      data-shadow-mode={sceneQuality.shadowMode}
      frameloop={getVesselFrameloop(mode, autoplay, reducedMotion)}
      {...getSceneCanvasSettings(sceneQuality)}
      camera={{
        position: DEFAULT_VESSEL_CAMERA_POSITION,
        fov: DEFAULT_VESSEL_CAMERA_FOV,
        near: 0.1,
        far: 90,
      }}
    >
      <ScenePresentation
        quality={sceneQuality}
        reducedMotion={reducedMotion}
        shadowRevision={shadowRevision}
        principleAnimationActive={isVesselWaterAnimated(
          mode,
          autoplay,
          reducedMotion,
        )}
        stage={VESSEL_STAGE_CONFIG}
      >
        <VesselModel
          key={resetToken}
          stepIndex={stepIndex}
          mode={mode}
          selectedPartId={selectedVesselPartId}
          autoplay={autoplay}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      </ScenePresentation>
      <SceneControls
        resetToken={resetToken}
        reducedMotion={reducedMotion}
        focusTarget={focusTarget}
        cameraCommand={cameraCommand}
        onReady={onReady}
      />
    </Canvas>
  )
}

export const VESSEL_STEP_COUNT = asr10Steps.length

import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { x57Parts } from '../content/x57'
import type {
  ExhibitPartId,
  PartDefinition,
  X57PartId,
} from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  advanceCameraFocusTarget,
  applyCameraCommand,
  type CameraCommand,
  type CameraVector,
} from './cameraControls'
import {
  AIRCRAFT_FOCUS_POINTS,
  AIRCRAFT_MODEL_POSITION,
  AIRCRAFT_MODEL_SCALE,
  AIRCRAFT_PROCEDURAL_PART_IDS,
  AircraftModel,
} from './AircraftModel'
import { getAircraftPartMotion } from './AircraftPart'
import {
  getContactShadowRevision,
  getSceneQualityProfile,
} from './sceneQuality'
import { ScenePresentation } from './ScenePresentation'
import { getSceneCanvasSettings } from './sceneSupport'
import type { ExhibitSceneProps } from './types'

export type { CameraCommand, CameraCommandType } from './cameraControls'
export { getSceneQualityProfile } from './sceneQuality'

export type AircraftSceneProps = ExhibitSceneProps

export const DEFAULT_AIRCRAFT_CAMERA_FOV = 40
export const DEFAULT_AIRCRAFT_CAMERA_TARGET: CameraVector = [0, 0.3, 0]
export const DEFAULT_AIRCRAFT_CAMERA_POSITION: CameraVector = [7, 4.6, 9.4]
export const AIRCRAFT_STAGE_CONFIG = {
  floorY: -1.03,
  radius: 5.5,
  label: 'X-57 电动飞机',
} as const
const AIRCRAFT_MIN_CAMERA_DISTANCE = 6.8
export const AIRCRAFT_MAX_CAMERA_DISTANCE = 13

export function getAircraftFrameloop(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
    ? 'always'
    : 'demand'
}

const X57_PART_IDS = new Set<X57PartId>(AIRCRAFT_PROCEDURAL_PART_IDS)
const PARTS_BY_ID = Object.fromEntries(
  x57Parts.map((part) => [part.id, part]),
) as Record<X57PartId, PartDefinition<X57PartId>>

function toX57PartId(partId: ExhibitPartId | null | undefined) {
  return partId && X57_PART_IDS.has(partId as X57PartId)
    ? (partId as X57PartId)
    : null
}

export function getAircraftFocusTarget(
  partId: X57PartId | null,
  stepIndex: number,
  mode: ExploreMode,
): CameraVector {
  if (!partId) return DEFAULT_AIRCRAFT_CAMERA_TARGET

  const part = PARTS_BY_ID[partId]
  const base = AIRCRAFT_FOCUS_POINTS[partId]
  const motion = getAircraftPartMotion(part, stepIndex, mode, false)

  return [
    AIRCRAFT_MODEL_POSITION[0] +
      (base[0] + motion.position[0]) * AIRCRAFT_MODEL_SCALE,
    AIRCRAFT_MODEL_POSITION[1] +
      (base[1] + motion.position[1]) * AIRCRAFT_MODEL_SCALE,
    AIRCRAFT_MODEL_POSITION[2] +
      (base[2] + motion.position[2]) * AIRCRAFT_MODEL_SCALE,
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
    camera.position.set(...DEFAULT_AIRCRAFT_CAMERA_POSITION)
    camera.lookAt(...DEFAULT_AIRCRAFT_CAMERA_TARGET)
    camera.updateProjectionMatrix()
    controlsRef.current?.target.set(...DEFAULT_AIRCRAFT_CAMERA_TARGET)
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
          min: AIRCRAFT_MIN_CAMERA_DISTANCE,
          max: AIRCRAFT_MAX_CAMERA_DISTANCE,
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
      minDistance={AIRCRAFT_MIN_CAMERA_DISTANCE}
      maxDistance={AIRCRAFT_MAX_CAMERA_DISTANCE}
      minPolarAngle={0.5}
      maxPolarAngle={1.5}
      target={DEFAULT_AIRCRAFT_CAMERA_TARGET}
    />
  )
}

export default function AircraftScene({
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
}: AircraftSceneProps) {
  const selectedX57PartId = toX57PartId(selectedPartId)
  const focusX57PartId = toX57PartId(focusPartId)
  const focusTarget = useMemo(
    () => getAircraftFocusTarget(focusX57PartId, stepIndex, mode),
    [focusX57PartId, mode, stepIndex],
  )
  const sceneQuality = useMemo(
    () =>
      getSceneQualityProfile({
        viewportWidth:
          typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth,
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
      aria-label="X-57 电动飞机可交互三维结构模型"
      role="img"
      tabIndex={0}
      data-scene-profile={sceneQuality.postprocessing ? 'desktop' : 'constrained'}
      data-canvas-shadows={sceneQuality.shadows ? 'on' : 'off'}
      data-postprocessing={sceneQuality.postprocessing ? 'on' : 'off'}
      data-shadow-mode={sceneQuality.shadowMode}
      frameloop={getAircraftFrameloop(mode, autoplay, reducedMotion)}
      {...getSceneCanvasSettings(sceneQuality)}
      camera={{
        position: DEFAULT_AIRCRAFT_CAMERA_POSITION,
        fov: DEFAULT_AIRCRAFT_CAMERA_FOV,
        near: 0.1,
        far: 90,
      }}
    >
      <ScenePresentation
        quality={sceneQuality}
        reducedMotion={reducedMotion}
        shadowRevision={shadowRevision}
        principleAnimationActive={
          getAircraftFrameloop(mode, autoplay, reducedMotion) === 'always'
        }
        stage={AIRCRAFT_STAGE_CONFIG}
      >
        <AircraftModel
          key={resetToken}
          stepIndex={stepIndex}
          mode={mode}
          selectedPartId={selectedX57PartId}
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

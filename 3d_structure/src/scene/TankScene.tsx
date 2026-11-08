import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { ExhibitId, PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  advanceCameraFocusTarget,
  applyCameraCommand,
  DEFAULT_CAMERA_TARGET,
  getCameraFocusTarget,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  type CameraCommand,
  type CameraVector,
} from './cameraControls'
import {
  getContactShadowRevision,
  getSceneQualityProfile,
} from './sceneQuality'
import { ScenePresentation } from './ScenePresentation'
import { getSceneCanvasSettings } from './sceneSupport'
import { TankModel } from './TankModel'
import type { ExhibitCycleState } from './types'

export {
  advanceCameraFocusTarget,
  applyCameraCommand,
  getCameraFocusTarget,
} from './cameraControls'
export type { CameraCommand, CameraCommandType } from './cameraControls'
export {
  getContactShadowRevision,
  getSceneQualityProfile,
} from './sceneQuality'

export interface TankSceneProps {
  /** Optional here so legacy injected M4 scene loaders remain source-compatible. */
  exhibitId?: ExhibitId
  stepIndex: number
  mode: ExploreMode
  selectedPartId: PartId | null
  focusPartId?: PartId | null
  autoplay: boolean
  reducedMotion: boolean
  resetToken: number
  cameraCommand?: CameraCommand
  onSelect: (partId: PartId) => void
  onReady?: () => void
  cycleState?: ExhibitCycleState
}

const DEFAULT_CAMERA_POSITION = [7.8, 4.8, 8.6] as const
export const DEFAULT_CAMERA_FOV = 40
export const TANK_STAGE_CONFIG = {
  floorY: -1.03,
  radius: 4.2,
  label: 'M4 中型坦克',
} as const

export function getTankFrameloop(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
    ? 'always'
    : 'demand'
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
    camera.position.set(...DEFAULT_CAMERA_POSITION)
    camera.lookAt(...DEFAULT_CAMERA_TARGET)
    camera.updateProjectionMatrix()
    controlsRef.current?.target.set(...DEFAULT_CAMERA_TARGET)
    controlsRef.current?.update()
    invalidate()
    onReady?.()
  }, [camera, invalidate, onReady, resetToken])

  useFrame((_, delta) => {
    const controls = controlsRef.current

    if (!controls) {
      return
    }

    if (
      cameraCommand &&
      lastCameraCommandTokenRef.current !== cameraCommand.token
    ) {
      const result = applyCameraCommand(
        camera.position.toArray() as unknown as CameraVector,
        controls.target.toArray() as unknown as CameraVector,
        focusTarget,
        cameraCommand.type,
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
      minDistance={MIN_CAMERA_DISTANCE}
      maxDistance={MAX_CAMERA_DISTANCE}
      minPolarAngle={0.65}
      maxPolarAngle={1.52}
      target={DEFAULT_CAMERA_TARGET}
    />
  )
}

export default function TankScene({
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
}: TankSceneProps) {
  const focusTarget = useMemo(
    () => getCameraFocusTarget(focusPartId, stepIndex, mode),
    [focusPartId, mode, stepIndex],
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
    selectedPartId,
    autoplay,
    resetToken,
  })

  return (
    <Canvas
      aria-label="M4 中型坦克可交互三维结构模型"
      role="img"
      tabIndex={0}
      data-scene-profile={sceneQuality.postprocessing ? 'desktop' : 'constrained'}
      data-canvas-shadows={sceneQuality.shadows ? 'on' : 'off'}
      data-postprocessing={sceneQuality.postprocessing ? 'on' : 'off'}
      data-shadow-mode={sceneQuality.shadowMode}
      frameloop={getTankFrameloop(mode, autoplay, reducedMotion)}
      {...getSceneCanvasSettings(sceneQuality)}
      camera={{
        position: DEFAULT_CAMERA_POSITION,
        fov: DEFAULT_CAMERA_FOV,
        near: 0.1,
        far: 80,
      }}
    >
      <ScenePresentation
        quality={sceneQuality}
        reducedMotion={reducedMotion}
        shadowRevision={shadowRevision}
        principleAnimationActive={
          getTankFrameloop(mode, autoplay, reducedMotion) === 'always'
        }
        stage={TANK_STAGE_CONFIG}
      >
        <TankModel
          key={resetToken}
          stepIndex={stepIndex}
          mode={mode}
          selectedPartId={selectedPartId}
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

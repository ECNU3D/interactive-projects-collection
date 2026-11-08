import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import type { ExploreMode } from '../experience/state'
import {
  isPrinciplePlaybackActive,
  resetPrincipleSample,
  samplePrincipleMotion,
  type PrincipleMotionKind,
  type PrincipleSample,
} from './principleRules'

interface PrincipleMotionProps {
  kind: PrincipleMotionKind
  mode: ExploreMode
  autoplay: boolean
  reducedMotion: boolean
  children: ReactNode
}

function applySample(group: Group, sample: PrincipleSample) {
  group.position.x = sample.positionX
  group.position.y = sample.positionY
  group.rotation.x = sample.rotationX
  group.scale.setScalar(sample.scale)
}

export function PrincipleMotion({
  kind,
  mode,
  autoplay,
  reducedMotion,
  children,
}: PrincipleMotionProps) {
  const groupRef = useRef<Group>(null)
  const elapsedRef = useRef(0)
  const sampleRef = useRef<PrincipleSample>({
    positionX: 0,
    positionY: 0,
    rotationX: 0,
    scale: 1,
  })
  const active = isPrinciplePlaybackActive(mode, autoplay, reducedMotion)

  useLayoutEffect(() => {
    const group = groupRef.current

    if (!group || (mode === 'principle' && !reducedMotion)) {
      return
    }

    elapsedRef.current = 0
    applySample(group, resetPrincipleSample(sampleRef.current))
  }, [mode, reducedMotion])

  useFrame((_, delta) => {
    const group = groupRef.current

    if (!group || !active) {
      return
    }

    elapsedRef.current += delta
    applySample(
      group,
      samplePrincipleMotion(kind, elapsedRef.current, sampleRef.current),
    )
  })

  return (
    <group ref={groupRef} name={`principle-motion-${kind}`}>
      {children}
    </group>
  )
}

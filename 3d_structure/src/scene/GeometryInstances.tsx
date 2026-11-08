import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  Object3D,
  type BufferGeometry,
  type InstancedMesh,
  type MeshStandardMaterial,
} from 'three'

export type GeometryInstanceTuple = readonly [number, number, number]

export interface GeometryInstanceTransform {
  position: GeometryInstanceTuple
  rotation?: GeometryInstanceTuple
  scale?: GeometryInstanceTuple
}

export interface GeometryInstancesProps {
  /** Geometry remains an external input owned by the calling model. */
  geometry: BufferGeometry
  /** Material remains an external input owned by the selectable part. */
  material: MeshStandardMaterial
  transforms: readonly GeometryInstanceTransform[]
  castShadow?: boolean
  receiveShadow?: boolean
}

const ZERO_ROTATION = [0, 0, 0] as const
const UNIT_SCALE = [1, 1, 1] as const

/**
 * Reuses one transform helper and one externally owned geometry/material pair.
 * The InstancedMesh keeps its own disposal lifecycle; selection stays on the
 * enclosing part group rather than individual instances.
 */
export function GeometryInstances({
  geometry,
  material,
  transforms,
  castShadow = true,
  receiveShadow = true,
}: GeometryInstancesProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const transformHelper = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current

    if (!mesh) {
      return
    }

    transforms.forEach((transform, index) => {
      transformHelper.position.set(...transform.position)
      transformHelper.rotation.set(...(transform.rotation ?? ZERO_ROTATION))
      transformHelper.scale.set(...(transform.scale ?? UNIT_SCALE))
      transformHelper.updateMatrix()
      mesh.setMatrixAt(index, transformHelper.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [geometry, material, transformHelper, transforms])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, transforms.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

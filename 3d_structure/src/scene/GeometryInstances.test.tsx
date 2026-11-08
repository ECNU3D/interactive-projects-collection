import type { ReactElement } from 'react'
import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'

const hookHarness = vi.hoisted(() => ({
  currentMesh: null as unknown,
  effects: [] as Array<{
    callback: () => void
    dependencies: readonly unknown[]
  }>,
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()

  return {
    ...actual,
    useLayoutEffect: (
      callback: () => void,
      dependencies: readonly unknown[],
    ) => {
      hookHarness.effects.push({ callback, dependencies })
    },
    useMemo: (factory: () => unknown) => factory(),
    useRef: () => ({ current: hookHarness.currentMesh }),
  }
})

import { GeometryInstances } from './GeometryInstances'

const resources: Array<
  InstancedMesh | BoxGeometry | MeshStandardMaterial
> = []

function createResources(count: number) {
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial()
  const mesh = new InstancedMesh(geometry, material, count)
  resources.push(mesh, geometry, material)
  return { geometry, material, mesh }
}

beforeEach(() => {
  hookHarness.effects.length = 0
  hookHarness.currentMesh = null
})

afterEach(() => {
  resources.splice(0).forEach((resource) => resource.dispose())
})

it('rewrites matrices and bounds when geometry and material identities change', () => {
  const transforms = [
    { position: [1, 2, 3] as const },
    {
      position: [-2, 0.5, 1] as const,
      rotation: [0, Math.PI / 4, 0] as const,
      scale: [0.8, 1.2, 0.9] as const,
    },
  ] as const
  const first = createResources(transforms.length)
  hookHarness.currentMesh = first.mesh

  GeometryInstances({
    geometry: first.geometry,
    material: first.material,
    transforms,
  })

  const firstEffect = hookHarness.effects.at(-1)!
  expect(firstEffect.dependencies).toContain(first.geometry)
  expect(firstEffect.dependencies).toContain(first.material)
  firstEffect.callback()
  const firstMatrix = new Matrix4()
  first.mesh.getMatrixAt(0, firstMatrix)
  expect(new Vector3().setFromMatrixPosition(firstMatrix).toArray()).toEqual([
    1, 2, 3,
  ])
  expect(first.mesh.boundingSphere).not.toBeNull()

  const replacement = createResources(transforms.length)
  hookHarness.currentMesh = replacement.mesh
  GeometryInstances({
    geometry: replacement.geometry,
    material: replacement.material,
    transforms,
  })

  const replacementEffect = hookHarness.effects.at(-1)!
  expect(replacementEffect.dependencies).toContain(replacement.geometry)
  expect(replacementEffect.dependencies).toContain(replacement.material)
  replacementEffect.callback()
  const replacementMatrix = new Matrix4()
  replacement.mesh.getMatrixAt(1, replacementMatrix)
  expect(
    new Vector3().setFromMatrixPosition(replacementMatrix).toArray(),
  ).toEqual([-2, 0.5, 1])
  expect(replacement.mesh.boundingSphere).not.toBeNull()
})

it('allows the instance resource to dispose without owning external inputs', () => {
  const external = createResources(1)
  hookHarness.currentMesh = external.mesh
  const element = GeometryInstances({
    geometry: external.geometry,
    material: external.material,
    transforms: [{ position: [0, 0, 0] }],
  }) as ReactElement<{ dispose?: null }>
  let meshDisposed = false
  let geometryDisposed = false
  let materialDisposed = false
  external.mesh.addEventListener('dispose', () => {
    meshDisposed = true
  })
  external.geometry.addEventListener('dispose', () => {
    geometryDisposed = true
  })
  external.material.addEventListener('dispose', () => {
    materialDisposed = true
  })

  expect(element.props.dispose).toBeUndefined()
  external.mesh.dispose()

  expect(meshDisposed).toBe(true)
  expect(geometryDisposed).toBe(false)
  expect(materialDisposed).toBe(false)
  expect(hookHarness.effects.at(-1)?.dependencies).toContainEqual(
    expect.any(Object3D),
  )
})

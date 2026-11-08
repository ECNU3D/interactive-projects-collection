import {
  BoxGeometry,
  Group,
  Line,
  BufferGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import {
  collectSelectionMeshes,
  createSelectionRegistry,
} from './SceneSelection'

describe('museum selection bridge', () => {
  it('collects only mesh descendants for the desktop Outline effect', () => {
    const root = new Group()
    const nested = new Group()
    const first = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const second = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const instances = new InstancedMesh(
      new BoxGeometry(),
      new MeshBasicMaterial(),
      2,
    )
    const line = new Line(new BufferGeometry(), new MeshBasicMaterial())
    nested.add(second, instances, line)
    root.add(first, nested)

    expect(collectSelectionMeshes(root)).toEqual([first, second, instances])

    first.geometry.dispose()
    second.geometry.dispose()
    ;(first.material as MeshBasicMaterial).dispose()
    ;(second.material as MeshBasicMaterial).dispose()
    instances.geometry.dispose()
    ;(instances.material as MeshBasicMaterial).dispose()
    line.geometry.dispose()
    ;(line.material as MeshBasicMaterial).dispose()
  })

  it('updates dynamic registrations without duplicates and removes cleanup owners', () => {
    const first = new Group()
    const second = new Group()
    const third = new Group()

    const registry = createSelectionRegistry()
    const cleanupFirstOwner = registry.register([first, second])
    const cleanupDynamicOwner = registry.register([second, third])

    expect(registry.getSelected()).toEqual([first, second, third])

    cleanupFirstOwner()
    expect(registry.getSelected()).toEqual([second, third])

    cleanupDynamicOwner()
    expect(registry.getSelected()).toEqual([])
  })
})

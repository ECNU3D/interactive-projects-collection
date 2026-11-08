import type { ThreeElements } from '@react-three/fiber'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Group, type Object3D } from 'three'

interface MuseumSelectionApi {
  enabled: boolean
  selected: Object3D[]
  register: (objects: Object3D[]) => () => void
}

const MuseumSelectionContext = createContext<MuseumSelectionApi | null>(null)

export function collectSelectionMeshes(root: Object3D) {
  const meshes: Object3D[] = []

  root.traverse((object) => {
    if (object.type === 'Mesh' || object.type === 'InstancedMesh') {
      meshes.push(object)
    }
  })

  return meshes
}

export function createSelectionRegistry() {
  const owners = new Map<Object3D, number>()

  return {
    getSelected: () => [...owners.keys()],
    register(objects: Object3D[]) {
      const uniqueObjects = [...new Set(objects)]

      for (const object of uniqueObjects) {
        owners.set(object, (owners.get(object) ?? 0) + 1)
      }

      let registered = true
      return () => {
        if (!registered) return
        registered = false

        for (const object of uniqueObjects) {
          const ownerCount = owners.get(object) ?? 0
          if (ownerCount <= 1) owners.delete(object)
          else owners.set(object, ownerCount - 1)
        }
      }
    },
  }
}

export function Selection({
  children,
  enabled = true,
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const [selected, setSelected] = useState<Object3D[]>([])
  const registryRef = useRef(createSelectionRegistry())
  const register = useCallback((objects: Object3D[]) => {
    const registry = registryRef.current
    const unregister = registry.register(objects)
    setSelected(registry.getSelected())

    return () => {
      unregister()
      setSelected(registry.getSelected())
    }
  }, [])
  const value = useMemo(
    () => ({ enabled, selected, register }),
    [enabled, register, selected],
  )

  return (
    <MuseumSelectionContext.Provider value={value}>
      {children}
    </MuseumSelectionContext.Provider>
  )
}

type SelectProps = Omit<ThreeElements['group'], 'ref'> & {
  enabled?: boolean
}

export function Select({
  enabled = false,
  children,
  ...props
}: SelectProps) {
  const groupRef = useRef<Group>(null)
  const selection = useContext(MuseumSelectionContext)

  useEffect(() => {
    const group = groupRef.current
    if (!selection?.enabled || !enabled || !group) return

    return selection.register(collectSelectionMeshes(group))
  }, [children, enabled, selection?.enabled, selection?.register])

  return (
    <group ref={groupRef} {...props}>
      {children}
    </group>
  )
}

export function useMuseumSelection() {
  return useContext(MuseumSelectionContext)?.selected ?? []
}

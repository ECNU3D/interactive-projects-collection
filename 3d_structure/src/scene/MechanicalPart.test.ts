import { m4Parts, m4Steps } from '../content/m4'
import { x57Parts, x57Steps } from '../content/x57'
import type { ExhibitPartId, X57PartId } from '../content/types'
import { render } from '@testing-library/react'
import { createElement, StrictMode, useEffect } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'
import {
  applyMechanicalPartMotion,
  beginMechanicalPartPointerHover,
  clearMechanicalPartPointerHovers,
  createMechanicalPartMaterial,
  dampMechanicalPartMotion,
  disableMechanicalPartRaycasts,
  endMechanicalPartPointerHover,
  getMechanicalPartMotion,
  isMechanicalRaycastDisabled,
  isMechanicalPartOutlineEnabled,
  isMechanicalShell,
  retainMechanicalPartMaterial,
  setMechanicalPartHover,
} from './MechanicalPart'
import { resolvePartMaterial } from './partMaterial'

function MaterialOwner({ material }: { material: MeshStandardMaterial }) {
  useEffect(() => retainMechanicalPartMaterial(material), [material])
  return null
}

describe('mechanical part interaction', () => {
  it('registers hover and selection for the shared outline selection context', () => {
    expect(isMechanicalPartOutlineEnabled(false, false)).toBe(false)
    expect(isMechanicalPartOutlineEnabled(false, true)).toBe(true)
    expect(isMechanicalPartOutlineEnabled(true, false)).toBe(true)
  })

  it('makes only configured shells click-through in xray and principle modes', () => {
    const shellIds = new Set<ExhibitPartId>([
      'firearm-receiver-shell',
    ])

    expect(
      isMechanicalRaycastDisabled(
        'firearm-receiver-shell',
        'xray',
        shellIds,
      ),
    ).toBe(true)
    expect(
      isMechanicalRaycastDisabled(
        'firearm-receiver-shell',
        'principle',
        shellIds,
      ),
    ).toBe(true)
    expect(
      isMechanicalRaycastDisabled(
        'firearm-breech-member',
        'xray',
        shellIds,
      ),
    ).toBe(false)
    expect(
      isMechanicalRaycastDisabled(
        'firearm-receiver-shell',
        'explode',
        shellIds,
      ),
    ).toBe(false)
    expect(isMechanicalShell('firearm-receiver-shell', shellIds)).toBe(
      true,
    )
  })

  it('reveals authored parts by exhibit steps and uses their explode offsets', () => {
    const battery = x57Parts.find(
      (part) => part.id === 'battery-modules',
    )!
    const shellIds = new Set<X57PartId>([
      'airframe-cabin',
      'high-aspect-wing',
    ])
    const options = { shellIds, steps: x57Steps }

    expect(
      getMechanicalPartMotion(battery, 2, 'explode', false, options),
    ).toMatchObject({
      position: [0, 0, 0],
      material: { state: 'pending', opacity: 1 },
    })
    expect(
      getMechanicalPartMotion(battery, 3, 'explode', false, options)
        .position,
    ).toEqual(battery.explodeOffset)
  })

  it('accepts an explicit reveal index when authored steps are unavailable', () => {
    const battery = x57Parts.find(
      (part) => part.id === 'battery-modules',
    )!
    const options = {
      revealStepIndex: 3,
      shellIds: new Set<X57PartId>(),
    }

    expect(
      getMechanicalPartMotion(battery, 2, 'explode', false, options)
        .position,
    ).toEqual([0, 0, 0])
    expect(
      getMechanicalPartMotion(battery, 3, 'explode', false, options)
        .position,
    ).toEqual(battery.explodeOffset)
  })

  it('preserves X-ray and dimmed states while layering selected highlights', () => {
    const airframe = x57Parts.find(
      (part) => part.id === 'airframe-cabin',
    )!
    const aircraftShellIds = new Set<X57PartId>([
      'airframe-cabin',
      'high-aspect-wing',
    ])
    const aircraftOptions = {
      shellIds: aircraftShellIds,
      steps: x57Steps,
    }

    expect(
      getMechanicalPartMotion(
        airframe,
        5,
        'xray',
        false,
        aircraftOptions,
      ).material,
    ).toMatchObject({ state: 'xray', opacity: 0.16 })
    expect(
      getMechanicalPartMotion(
        airframe,
        5,
        'xray',
        true,
        aircraftOptions,
      ),
    ).toMatchObject({
      material: { state: 'xray', emphasis: 'selected' },
      scale: 1.035,
      emissiveIntensity: 0.48,
    })

    const hull = m4Parts.find((part) => part.id === 'hull-shell')!
    expect(
      getMechanicalPartMotion(hull, 4, 'explode', false, {
        shellIds: new Set(['hull-shell'] as const),
        steps: m4Steps,
      }).material.state,
    ).toBe('dimmed')
  })
})

describe('mechanical part lifecycle', () => {
  it('disables traversed geometry raycasts and restores each exact original', () => {
    const root = new Group()
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const instances = new InstancedMesh(
      new BoxGeometry(),
      new MeshBasicMaterial(),
      1,
    )
    const line = new Line(new BufferGeometry(), new LineBasicMaterial())
    const meshRaycast = vi.fn()
    const instancesRaycast = vi.fn()
    const lineRaycast = vi.fn()
    mesh.raycast = meshRaycast
    instances.raycast = instancesRaycast
    line.raycast = lineRaycast
    root.add(mesh, instances, line)

    const restore = disableMechanicalPartRaycasts(root)

    expect(mesh.raycast).not.toBe(meshRaycast)
    expect(instances.raycast).not.toBe(instancesRaycast)
    expect(line.raycast).not.toBe(lineRaycast)

    restore()

    expect(mesh.raycast).toBe(meshRaycast)
    expect(instances.raycast).toBe(instancesRaycast)
    expect(line.raycast).toBe(lineRaycast)

    mesh.geometry.dispose()
    instances.geometry.dispose()
    line.geometry.dispose()
    ;(mesh.material as MeshBasicMaterial).dispose()
    ;(instances.material as MeshBasicMaterial).dispose()
    ;(line.material as LineBasicMaterial).dispose()
  })

  it('restores the prior cursor only after the final hover owner leaves', () => {
    const first = Symbol('first mechanical part')
    const second = Symbol('second mechanical part')
    document.body.style.cursor = 'crosshair'

    try {
      setMechanicalPartHover(first, true)
      expect(document.body.style.cursor).toBe('pointer')

      setMechanicalPartHover(second, true)
      setMechanicalPartHover(first, false)
      expect(document.body.style.cursor).toBe('pointer')

      setMechanicalPartHover(second, false)
      expect(document.body.style.cursor).toBe('crosshair')
    } finally {
      setMechanicalPartHover(first, false)
      setMechanicalPartHover(second, false)
      document.body.style.cursor = ''
    }
  })

  it('keeps hover active until every pointer has left and clears on unmount', () => {
    const pointerIds = new Set<number>()

    expect(beginMechanicalPartPointerHover(pointerIds, 11)).toBe(true)
    expect(beginMechanicalPartPointerHover(pointerIds, 22)).toBe(false)
    expect(beginMechanicalPartPointerHover(pointerIds, 11)).toBe(false)
    expect(endMechanicalPartPointerHover(pointerIds, 11)).toBe(false)
    expect(endMechanicalPartPointerHover(pointerIds, 22)).toBe(true)
    expect(pointerIds.size).toBe(0)

    beginMechanicalPartPointerHover(pointerIds, 33)
    expect(clearMechanicalPartPointerHovers(pointerIds)).toBe(true)
    expect(pointerIds.size).toBe(0)
    expect(clearMechanicalPartPointerHovers(pointerIds)).toBe(false)
  })

  it('creates an opaque material from the configured palette', () => {
    const material = createMechanicalPartMaterial(
      {
        color: '#123456',
        emissive: '#654321',
        metalness: 0.37,
        roughness: 0.59,
      },
    )

    expect(material.color.getHexString()).toBe('123456')
    expect(material.emissive.getHexString()).toBe('654321')
    expect(material.metalness).toBe(0.37)
    expect(material.roughness).toBe(0.59)
    expect(material.depthWrite).toBe(true)
    expect(material.transparent).toBe(false)
    expect(material.opacity).toBe(1)

    material.dispose()
  })

  it('cancels StrictMode cleanup and disposes on real unmount', async () => {
    const material = new MeshStandardMaterial()
    const dispose = vi.spyOn(material, 'dispose')

    const view = render(
      createElement(
        StrictMode,
        null,
        createElement(MaterialOwner, { material }),
      ),
    )
    await Promise.resolve()

    expect(dispose).not.toHaveBeenCalled()

    view.unmount()
    await Promise.resolve()

    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes a replaced material while retaining its replacement', async () => {
    const previousMaterial = new MeshStandardMaterial()
    const nextMaterial = new MeshStandardMaterial()
    const disposePrevious = vi.spyOn(previousMaterial, 'dispose')
    const disposeNext = vi.spyOn(nextMaterial, 'dispose')
    const view = render(
      createElement(
        StrictMode,
        null,
        createElement(MaterialOwner, { material: previousMaterial }),
      ),
    )
    view.rerender(
      createElement(
        StrictMode,
        null,
        createElement(MaterialOwner, { material: nextMaterial }),
      ),
    )
    await Promise.resolve()

    expect(disposePrevious).toHaveBeenCalledTimes(1)
    expect(disposeNext).not.toHaveBeenCalled()

    view.unmount()
    await Promise.resolve()
    expect(disposeNext).toHaveBeenCalledTimes(1)
  })

  it('damps toward motion targets until settled and applies immediate targets exactly', () => {
    const target = {
      position: [3, -2, 1] as const,
      material: {
        state: 'xray' as const,
        role: 'mechanical' as const,
        opacity: 0.24,
        transparent: true,
        depthWrite: false,
        saturation: 0.72,
        emphasis: 'selected' as const,
        scale: 1.18,
        emissiveIntensity: 0.44,
      },
      scale: 1.18,
      emissiveIntensity: 0.44,
    }
    const animatedGroup = new Group()
    const animatedMaterial = new MeshStandardMaterial({
      emissiveIntensity: 0.06,
      opacity: 0.84,
      transparent: true,
    })

    let unsettled = dampMechanicalPartMotion(
      animatedGroup,
      animatedMaterial,
      target,
      1 / 60,
    )
    expect(unsettled).toBe(true)

    for (let frame = 0; frame < 1_000 && unsettled; frame += 1) {
      unsettled = dampMechanicalPartMotion(
        animatedGroup,
        animatedMaterial,
        target,
        1 / 60,
      )
    }
    expect(unsettled).toBe(false)

    const immediateGroup = new Group()
    const immediateMaterial = new MeshStandardMaterial()
    expect(
      applyMechanicalPartMotion(
        immediateGroup,
        immediateMaterial,
        target,
      ),
    ).toBe(false)
    expect(immediateGroup.position.toArray()).toEqual(target.position)
    expect(immediateGroup.scale.toArray()).toEqual([
      target.scale,
      target.scale,
      target.scale,
    ])
    expect(immediateMaterial.opacity).toBe(target.material.opacity)
    expect(immediateMaterial.emissiveIntensity).toBe(
      target.emissiveIntensity,
    )

    animatedMaterial.dispose()
    immediateMaterial.dispose()
  })

  it('caches the first external base color so saturation can recover', () => {
    const group = new Group()
    const material = new MeshStandardMaterial({ color: '#ff0000' })
    const pendingMaterial = resolvePartMaterial({
      revealed: false,
      shell: false,
      mode: 'explode',
    })
    const solidMaterial = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
    })
    const pendingMotion = {
      position: [0, 0, 0] as const,
      material: pendingMaterial,
      scale: pendingMaterial.scale,
      emissiveIntensity: pendingMaterial.emissiveIntensity,
    }
    const solidMotion = {
      position: [0, 0, 0] as const,
      material: solidMaterial,
      scale: solidMaterial.scale,
      emissiveIntensity: solidMaterial.emissiveIntensity,
    }

    for (let frame = 0; frame < 360; frame += 1) {
      dampMechanicalPartMotion(group, material, pendingMotion, 1 / 60)
    }
    for (let frame = 0; frame < 360; frame += 1) {
      dampMechanicalPartMotion(group, material, solidMotion, 1 / 60)
    }

    expect(material.color.r).toBeGreaterThan(0.95)
    expect(material.color.g).toBeLessThan(0.05)
    expect(material.color.b).toBeLessThan(0.05)
    material.dispose()
  })
})

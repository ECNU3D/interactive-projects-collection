import { MeshStandardMaterial } from 'three'
import {
  applyResolvedPartMaterial,
  resolvePartMaterial,
} from './partMaterial'

describe('resolvePartMaterial', () => {
  it('keeps a revealed part physically opaque in ordinary modes', () => {
    expect(
      resolvePartMaterial({
        revealed: true,
        shell: false,
        mode: 'explode',
      }),
    ).toMatchObject({
      state: 'solid',
      opacity: 1,
      transparent: false,
      depthWrite: true,
      saturation: 1,
      emphasis: 'idle',
    })
  })

  it('renders future parts as opaque low-saturation wax', () => {
    const pending = resolvePartMaterial({
      revealed: false,
      shell: false,
      mode: 'explode',
    })
    const solid = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
    })

    expect(pending).toMatchObject({
      state: 'pending',
      opacity: 1,
      transparent: false,
      depthWrite: true,
    })
    expect(pending.saturation).toBeLessThan(0.3)
    expect(pending.emissiveIntensity).toBeLessThan(
      solid.emissiveIntensity * 0.5,
    )
  })

  it('layers hover and selection over pending wax without replacing its state', () => {
    const idle = resolvePartMaterial({
      revealed: false,
      shell: false,
      mode: 'explode',
    })
    const hovered = resolvePartMaterial({
      revealed: false,
      shell: false,
      mode: 'explode',
      hovered: true,
    })
    const selected = resolvePartMaterial({
      revealed: false,
      shell: false,
      mode: 'explode',
      hovered: true,
      selected: true,
    })

    expect([idle.state, hovered.state, selected.state]).toEqual([
      'pending',
      'pending',
      'pending',
    ])
    expect(hovered.emissiveIntensity).toBeGreaterThan(
      idle.emissiveIntensity,
    )
    expect(selected.emissiveIntensity).toBeGreaterThan(
      hovered.emissiveIntensity,
    )
  })

  it('uses a dedicated transparent X-ray shell', () => {
    expect(
      resolvePartMaterial({
        revealed: true,
        shell: true,
        mode: 'xray',
      }),
    ).toMatchObject({
      state: 'xray',
      transparent: true,
      depthWrite: false,
    })
    expect(
      resolvePartMaterial({
        revealed: true,
        shell: true,
        mode: 'xray',
      }).opacity,
    ).toBeLessThan(0.3)
  })

  it('keeps an authored dim state opaque and readable', () => {
    const dimmed = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
      dimmed: true,
    })

    expect(dimmed).toMatchObject({
      state: 'dimmed',
      opacity: 1,
      transparent: false,
      depthWrite: true,
    })
    expect(dimmed.saturation).toBeGreaterThan(0.3)
    expect(dimmed.saturation).toBeLessThan(0.7)
  })

  it('keeps a teaching volume semantically solid while presenting it as transparent', () => {
    const idle = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
      role: 'teaching-volume',
    })
    const selected = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
      role: 'teaching-volume',
      selected: true,
    })

    expect(idle).toMatchObject({
      state: 'solid',
      role: 'teaching-volume',
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
    })
    expect(selected).toMatchObject({
      state: 'solid',
      role: 'teaching-volume',
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
      emphasis: 'selected',
    })
  })

  it('does not let selection replace the X-ray material state', () => {
    expect(
      resolvePartMaterial({
        revealed: true,
        shell: true,
        mode: 'xray',
        selected: true,
      }),
    ).toMatchObject({
      state: 'xray',
      transparent: true,
      depthWrite: false,
      emphasis: 'selected',
    })
  })

  it('gives hover a quieter emphasis than selection', () => {
    const hovered = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
      hovered: true,
    })
    const selected = resolvePartMaterial({
      revealed: true,
      shell: false,
      mode: 'explode',
      hovered: true,
      selected: true,
    })

    expect(hovered.emphasis).toBe('hover')
    expect(selected.emphasis).toBe('selected')
    expect(hovered.emissiveIntensity).toBeLessThan(
      selected.emissiveIntensity,
    )
    expect(hovered.scale).toBeLessThan(selected.scale)
  })
})

describe('applyResolvedPartMaterial', () => {
  it('does not rebuild a material when only opacity or saturation changes', () => {
    const material = new MeshStandardMaterial({
      color: '#a27c3f',
      depthWrite: true,
      transparent: false,
    })
    const version = material.version

    applyResolvedPartMaterial(
      material,
      resolvePartMaterial({
        revealed: true,
        shell: false,
        mode: 'explode',
        dimmed: true,
      }),
      '#a27c3f',
    )

    expect(material.version).toBe(version)
    material.dispose()
  })

  it('rebuilds a material exactly when transparency or depth semantics change', () => {
    const material = new MeshStandardMaterial({
      color: '#a27c3f',
      depthWrite: true,
      transparent: false,
    })
    const xray = resolvePartMaterial({
      revealed: true,
      shell: true,
      mode: 'xray',
    })
    const initialVersion = material.version

    applyResolvedPartMaterial(material, xray, '#a27c3f')
    expect(material.version).toBe(initialVersion + 1)

    applyResolvedPartMaterial(material, { ...xray, opacity: 0.2 }, '#a27c3f')
    expect(material.version).toBe(initialVersion + 1)

    applyResolvedPartMaterial(
      material,
      resolvePartMaterial({
        revealed: true,
        shell: false,
        mode: 'explode',
      }),
      '#a27c3f',
    )
    expect(material.version).toBe(initialVersion + 2)
    material.dispose()
  })
})

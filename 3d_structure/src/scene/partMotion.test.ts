import { m4Parts } from '../content/m4'
import { getPartMotion } from './partMotion'

const engine = m4Parts.find((part) => part.id === 'engine-module')!
const hull = m4Parts.find((part) => part.id === 'hull-shell')!
const crewSpace = m4Parts.find((part) => part.id === 'crew-space')!

describe('getPartMotion', () => {
  it('keeps the assembled overview solid and fully legible', () => {
    expect(getPartMotion(engine, 0, 'explode', false).material).toMatchObject({
      state: 'solid',
      opacity: 1,
      transparent: false,
    })
  })

  it('keeps future parts at the assembly origin', () => {
    expect(getPartMotion(engine, 1, 'explode', false).position).toEqual([
      0, 0, 0,
    ])
  })

  it('moves revealed parts along their authored explode offset', () => {
    expect(getPartMotion(engine, 3, 'explode', false).position).toEqual(
      engine.explodeOffset,
    )
  })

  it('renders an unselected outer shell with the X-ray material', () => {
    expect(getPartMotion(hull, 4, 'xray', false).material).toMatchObject({
      state: 'xray',
      transparent: true,
      depthWrite: false,
    })
  })

  it('keeps a selected outer shell in the X-ray material state', () => {
    expect(getPartMotion(hull, 4, 'xray', true).material).toMatchObject({
      state: 'xray',
      emphasis: 'selected',
    })
  })

  it('keeps an outer shell in the X-ray material in principle mode', () => {
    expect(getPartMotion(hull, 4, 'principle', false).material.state).toBe(
      'xray',
    )
  })

  it('keeps a revealed part solid before its dim threshold', () => {
    expect(getPartMotion(hull, 2, 'explode', false).material.state).toBe(
      'solid',
    )
  })

  it('keeps a revealed part solid exactly at its dim threshold', () => {
    expect(getPartMotion(hull, 3, 'explode', false).material.state).toBe(
      'solid',
    )
  })

  it('dims a revealed part after its authored dim threshold', () => {
    expect(getPartMotion(hull, 4, 'explode', false).material.state).toBe(
      'dimmed',
    )
  })

  it('emphasizes selection without replacing an authored dim state', () => {
    expect(getPartMotion(hull, 4, 'explode', true).material).toMatchObject({
      state: 'dimmed',
      emphasis: 'selected',
    })
  })

  it('emphasizes selected parts with scale and emissive light', () => {
    const selected = getPartMotion(engine, 3, 'explode', true)
    const unselected = getPartMotion(engine, 3, 'explode', false)

    expect(selected.scale).toBeGreaterThan(unselected.scale)
    expect(selected.emissiveIntensity).toBeGreaterThan(
      unselected.emissiveIntensity,
    )
  })

  it('does not apply authored explode offsets in principle mode', () => {
    expect(getPartMotion(engine, 3, 'principle', false).position).toEqual([
      0, 0, 0,
    ])
  })

  it('keeps the crew-space teaching volume transparent without changing its state', () => {
    expect(getPartMotion(crewSpace, 5, 'explode', false).material).toMatchObject({
      state: 'solid',
      role: 'teaching-volume',
      transparent: true,
      depthWrite: false,
    })
  })
})

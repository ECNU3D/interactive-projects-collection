import {
  isPrinciplePlaybackActive,
  resetPrincipleSample,
  samplePrincipleMotion,
  type PrincipleSample,
} from './principleRules'

const createSample = (): PrincipleSample => ({
  positionX: 99,
  positionY: 99,
  rotationX: 99,
  scale: 99,
})

describe('principle motion rules', () => {
  it('plays only in principle mode with autoplay and full motion', () => {
    expect(isPrinciplePlaybackActive('principle', true, false)).toBe(true)
    expect(isPrinciplePlaybackActive('principle', false, false)).toBe(false)
    expect(isPrinciplePlaybackActive('principle', true, true)).toBe(false)
    expect(isPrinciplePlaybackActive('explode', true, false)).toBe(false)
  })

  it('mutates a supplied sample without allocating a result', () => {
    const sample = createSample()

    expect(samplePrincipleMotion('engine', 2, sample)).toBe(sample)
    expect(sample).toEqual({
      positionX: 0,
      positionY: 0,
      rotationX: 0.44,
      scale: 1,
    })
  })

  it('alternates left and right suspension offsets', () => {
    const left = samplePrincipleMotion('suspension-left', 1, createSample())
    const right = samplePrincipleMotion('suspension-right', 1, createSample())

    expect(left.positionY).toBeCloseTo(-right.positionY)
    expect(Math.abs(left.positionY)).toBeLessThanOrEqual(0.035)
  })

  it('keeps transmission travel and pulse restrained', () => {
    const sample = samplePrincipleMotion('transmission', 1, createSample())

    expect(Math.abs(sample.positionX)).toBeLessThanOrEqual(0.06)
    expect(sample.scale).toBeGreaterThanOrEqual(1)
    expect(sample.scale).toBeLessThanOrEqual(1.025)
  })

  it('models recoil as a short decaying translation and resets to neutral', () => {
    const early = samplePrincipleMotion('recoil', 0.2, createSample())
    const late = samplePrincipleMotion('recoil', 1, createSample())
    const reset = resetPrincipleSample(createSample())

    expect(Math.abs(early.positionX)).toBeGreaterThan(
      Math.abs(late.positionX),
    )
    expect(reset).toEqual({
      positionX: 0,
      positionY: 0,
      rotationX: 0,
      scale: 1,
    })
  })
})

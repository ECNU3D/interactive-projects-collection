import {
  DEFAULT_VESSEL_CAMERA_FOV,
  VESSEL_SCENE_LABEL,
  getVesselFocusTarget,
  getVesselFrameloop,
  isVesselWaterAnimated,
  VESSEL_STAGE_CONFIG,
} from './VesselScene'

describe('modern rescue vessel teaching-composite scene', () => {
  it('uses a complete-vessel overview and an explicit educational label', () => {
    expect(getVesselFocusTarget(null, 0, 'explode')).toEqual([0, 0.35, 0])
    expect(DEFAULT_VESSEL_CAMERA_FOV).toBeGreaterThanOrEqual(38)
    expect(VESSEL_SCENE_LABEL).toContain('现代救援船教学复合模型')
    expect(VESSEL_SCENE_LABEL).not.toContain('精确复刻')
  })

  it('follows revealed engines to their authored exploded position', () => {
    const assembled = getVesselFocusTarget(
      'twin-engine-modules',
      2,
      'explode',
    )
    const exploded = getVesselFocusTarget(
      'twin-engine-modules',
      3,
      'explode',
    )

    expect(exploded[0]).toBeLessThan(assembled[0])
    expect(exploded[1]).toBeGreaterThan(assembled[1])
    expect(getVesselFocusTarget('twin-engine-modules', 3, 'xray')).toEqual(
      assembled,
    )
  })

  it('renders continuously only while a visible principle animation is active', () => {
    expect(getVesselFrameloop('principle', true, false)).toBe('always')
    expect(getVesselFrameloop('principle', false, false)).toBe('demand')
    expect(getVesselFrameloop('principle', true, true)).toBe('demand')
    expect(getVesselFrameloop('xray', true, false)).toBe('demand')
  })

  it('animates the abstract water only with visible full-motion principle playback', () => {
    expect(isVesselWaterAnimated('principle', true, false)).toBe(true)
    expect(isVesselWaterAnimated('principle', false, false)).toBe(false)
    expect(isVesselWaterAnimated('principle', true, true)).toBe(false)
    expect(isVesselWaterAnimated('xray', true, false)).toBe(false)
  })

  it('keeps the water stage explicitly abstract rather than a sea-state model', () => {
    expect(VESSEL_STAGE_CONFIG).toMatchObject({
      variant: 'water',
      label: '现代救援船教学复合模型',
    })
  })
})

import {
  AIRCRAFT_MAX_CAMERA_DISTANCE,
  DEFAULT_AIRCRAFT_CAMERA_FOV,
  DEFAULT_AIRCRAFT_CAMERA_POSITION,
  getAircraftFocusTarget,
  getAircraftFrameloop,
  AIRCRAFT_STAGE_CONFIG,
} from './AircraftScene'

describe('X-57 scene framing and focus', () => {
  it('uses a wide-aircraft overview when no part is selected', () => {
    expect(getAircraftFocusTarget(null, 0, 'explode')).toEqual([0, 0.3, 0])
    expect(DEFAULT_AIRCRAFT_CAMERA_FOV).toBeGreaterThanOrEqual(38)
  })

  it('starts inside the same orbit limit used by camera buttons', () => {
    const target = getAircraftFocusTarget(null, 0, 'explode')
    const distance = Math.hypot(
      DEFAULT_AIRCRAFT_CAMERA_POSITION[0] - target[0],
      DEFAULT_AIRCRAFT_CAMERA_POSITION[1] - target[1],
      DEFAULT_AIRCRAFT_CAMERA_POSITION[2] - target[2],
    )

    expect(distance).toBeLessThanOrEqual(AIRCRAFT_MAX_CAMERA_DISTANCE)
  })

  it('follows a revealed battery module to its exploded position', () => {
    const assembled = getAircraftFocusTarget('battery-modules', 2, 'explode')
    const exploded = getAircraftFocusTarget('battery-modules', 3, 'explode')

    expect(exploded[0]).toBeLessThan(assembled[0])
    expect(exploded[1]).toBeGreaterThan(assembled[1])
    expect(getAircraftFocusTarget('battery-modules', 3, 'xray')).toEqual(
      assembled,
    )
  })

  it('renders continuously only while a visible principle animation is active', () => {
    expect(getAircraftFrameloop('principle', true, false)).toBe('always')
    expect(getAircraftFrameloop('principle', false, false)).toBe('demand')
    expect(getAircraftFrameloop('principle', true, true)).toBe('demand')
    expect(getAircraftFrameloop('explode', true, false)).toBe('demand')
  })

  it('gives the wide airframe a shared museum podium', () => {
    expect(AIRCRAFT_STAGE_CONFIG).toMatchObject({
      floorY: -1.03,
      label: 'X-57 电动飞机',
    })
    expect(AIRCRAFT_STAGE_CONFIG.radius).toBeGreaterThan(5)
  })
})

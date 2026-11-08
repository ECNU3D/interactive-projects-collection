import { canUseWebGL, getSceneCanvasSettings } from './sceneSupport'

describe('canUseWebGL', () => {
  function createMockCanvas(
    contexts: Partial<Record<'webgl2' | 'webgl', unknown>>,
  ) {
    const canvas = document.createElement('canvas')
    const getContext = vi.fn((contextId: 'webgl2' | 'webgl') =>
      contexts[contextId] ?? null,
    )

    Object.defineProperty(canvas, 'getContext', {
      configurable: true,
      value: getContext,
    })

    return { canvas, getContext }
  }

  it('returns false without browser globals', () => {
    expect(canUseWebGL({})).toBe(false)
  })

  it('rejects a canvas that can only create a WebGL1 context', () => {
    const webgl1Context = { getExtension: () => null }
    const { canvas, getContext } = createMockCanvas({
      webgl: webgl1Context,
    })

    expect(
      canUseWebGL({
        window: {
          WebGLRenderingContext: class WebGLRenderingContext {},
          WebGL2RenderingContext: class WebGL2RenderingContext {},
        },
        document: { createElement: () => canvas },
      }),
    ).toBe(false)
    expect(getContext.mock.calls.map(([contextId]) => contextId)).toEqual([
      'webgl2',
    ])
  })

  it('returns false when canvas access throws', () => {
    const createElement = vi.fn(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(
      canUseWebGL({
        window: { WebGL2RenderingContext: class WebGL2RenderingContext {} },
        document: { createElement },
      }),
    ).toBe(false)
    expect(createElement).toHaveBeenCalledTimes(1)
  })

  it('returns false when reading the WebGL2 constructor throws', () => {
    const hostileWindow = {}
    const createElement = vi.fn(() => createMockCanvas({}).canvas)
    let result: boolean | undefined

    Object.defineProperty(hostileWindow, 'WebGL2RenderingContext', {
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })

    expect(() => {
      result = canUseWebGL({
        window: hostileWindow,
        document: { createElement },
      })
    }).not.toThrow()
    expect(result).toBe(false)
    expect(createElement).not.toHaveBeenCalled()
  })

  it('accepts a WebGL2 context and releases the probe context', () => {
    const loseContext = vi.fn()
    const webgl2Context = {
      getExtension: () => ({ loseContext }),
    }
    const { canvas, getContext } = createMockCanvas({
      webgl2: webgl2Context,
    })

    expect(
      canUseWebGL({
        window: { WebGL2RenderingContext: class WebGL2RenderingContext {} },
        document: { createElement: () => canvas },
      }),
    ).toBe(true)
    expect(getContext.mock.calls.map(([contextId]) => contextId)).toEqual([
      'webgl2',
    ])
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('calls context cleanup with the extension as its receiver', () => {
    let receivedThis: unknown
    const extension = {
      loseContext() {
        receivedThis = this
      },
    }

    const { canvas } = createMockCanvas({
      webgl2: {
        getExtension: () => extension,
      },
    })

    expect(
      canUseWebGL({
        window: { WebGL2RenderingContext: class WebGL2RenderingContext {} },
        document: { createElement: () => canvas },
      }),
    ).toBe(true)
    expect(receivedThis).toBe(extension)
  })

  it('returns false when requesting the WebGL2 context throws', () => {
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getContext', {
      configurable: true,
      value: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    })

    expect(
      canUseWebGL({
        window: { WebGL2RenderingContext: class WebGL2RenderingContext {} },
        document: { createElement: () => canvas },
      }),
    ).toBe(false)
  })

  it('does not touch canvas APIs when WebGL constructors are absent', () => {
    const createElement = vi.fn(() => ({
      getContext: () => ({ getExtension: () => null }),
    }))

    expect(
      canUseWebGL({
        window: {},
        document: { createElement },
      }),
    ).toBe(false)
    expect(createElement).not.toHaveBeenCalled()
  })
})

describe('getSceneCanvasSettings', () => {
  it('maps adaptive quality to the shared Canvas contract', () => {
    expect(
      getSceneCanvasSettings({
        dpr: [1, 2],
        shadows: true,
        antialias: false,
      }),
    ).toEqual({
      dpr: [1, 2],
      shadows: true,
      gl: {
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
      },
    })

    expect(
      getSceneCanvasSettings({
        dpr: [1, 1.25],
        shadows: false,
        antialias: true,
      }),
    ).toMatchObject({
      dpr: [1, 1.25],
      shadows: false,
      gl: { antialias: true },
    })
  })
})

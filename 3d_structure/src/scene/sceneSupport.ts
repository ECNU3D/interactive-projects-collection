interface WebGLContextLike {
  getExtension?: (
    extensionName: string,
  ) => { loseContext?: () => void } | null
}

interface CanvasLike {
  getContext: (contextId: 'webgl2' | 'webgl') => unknown
}

interface SceneCanvasQuality {
  dpr: [number, number]
  shadows: boolean
  antialias: boolean
}

export function getSceneCanvasSettings(quality: SceneCanvasQuality) {
  return {
    dpr: quality.dpr,
    shadows: quality.shadows,
    gl: {
      antialias: quality.antialias,
      alpha: true,
      powerPreference: 'high-performance' as const,
    },
  }
}

export interface WebGLEnvironment {
  window?: {
    WebGLRenderingContext?: unknown
    WebGL2RenderingContext?: unknown
  }
  document?: {
    createElement: (tagName: 'canvas') => CanvasLike
  }
}

function getBrowserEnvironment(): WebGLEnvironment {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {}
  }

  return {
    window: window as typeof window & WebGLEnvironment['window'],
    document: {
      createElement: () => document.createElement('canvas'),
    },
  }
}

export function canUseWebGL(
  environment: WebGLEnvironment = getBrowserEnvironment(),
) {
  if (!environment.window || !environment.document) {
    return false
  }

  try {
    if (!environment.window.WebGL2RenderingContext) {
      return false
    }

    const canvas = environment.document.createElement('canvas')
    const context = canvas.getContext('webgl2')

    if (!context) {
      return false
    }

    try {
      const extension = (context as WebGLContextLike).getExtension?.(
        'WEBGL_lose_context',
      )
      extension?.loseContext?.()
    } catch {
      // Context cleanup is best-effort; successful creation proves support.
    }

    return true
  } catch {
    return false
  }
}

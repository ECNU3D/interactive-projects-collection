import type { ComponentType } from 'react'

export interface OptionalSceneEffectsModule {
  default: ComponentType
}

export type OptionalSceneEffectsImporter = () => Promise<OptionalSceneEffectsModule>

export function NoopSceneEffects() {
  return null
}

const importSceneEffects: OptionalSceneEffectsImporter = () =>
  import('./SceneEffects')

/** Keeps the museum usable when the desktop-only effects chunk is unavailable. */
export async function loadOptionalSceneEffects(
  importer: OptionalSceneEffectsImporter = importSceneEffects,
): Promise<OptionalSceneEffectsModule> {
  try {
    return await importer()
  } catch {
    return { default: NoopSceneEffects }
  }
}

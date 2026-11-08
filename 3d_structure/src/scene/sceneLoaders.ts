import type { ComponentType } from 'react'
import type { ExhibitId } from '../content/types'
import type { ExhibitSceneLoader, ExhibitSceneProps } from './types'

const loadTankScene: ExhibitSceneLoader = () =>
  import('./TankScene').then((module) => ({
    default: module.default as ComponentType<ExhibitSceneProps>,
  }))

const loadAircraftScene: ExhibitSceneLoader = () =>
  import('./AircraftScene').then((module) => ({
    default: module.default as ComponentType<ExhibitSceneProps>,
  }))

const loadVesselScene: ExhibitSceneLoader = () =>
  import('./VesselScene').then((module) => ({
    default: module.default as ComponentType<ExhibitSceneProps>,
  }))

const loadFirearmScene: ExhibitSceneLoader = () =>
  import('./FirearmScene').then((module) => ({
    default: module.default as ComponentType<ExhibitSceneProps>,
  }))

/**
 * Exhibit-specific scenes stay behind dynamic imports so opening the gallery or
 * a static lesson never downloads WebGL code.
 */
export const exhibitSceneLoaders: Partial<
  Record<ExhibitId, ExhibitSceneLoader>
> = {
  m4: loadTankScene,
  x57: loadAircraftScene,
  asr10: loadVesselScene,
  m1903: loadFirearmScene,
  m1911a1: loadFirearmScene,
  'm1-garand': loadFirearmScene,
  mp5: loadFirearmScene,
}

export function getExhibitSceneLoader(
  exhibitId: ExhibitId,
): ExhibitSceneLoader | undefined {
  return exhibitSceneLoaders[exhibitId]
}

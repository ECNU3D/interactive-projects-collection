import { exhibitIds, firearmExhibitIds } from '../content/types'
import { getExhibitSceneLoader } from './sceneLoaders'

it('provides a lazy scene module for every supported exhibit', async () => {
  for (const exhibitId of exhibitIds) {
    const loader = getExhibitSceneLoader(exhibitId)

    expect(loader, `${exhibitId} should have a scene loader`).toBeDefined()

    const sceneModule = await loader?.()
    expect(sceneModule?.default).toEqual(expect.any(Function))
  }
})

it('shares one lazy FirearmScene loader across all four firearm exhibits', async () => {
  const loaders = firearmExhibitIds.map((exhibitId) =>
    getExhibitSceneLoader(exhibitId),
  )

  expect(loaders.every(Boolean)).toBe(true)
  for (const loader of loaders.slice(1)) {
    expect(loader).toBe(loaders[0])
  }

  const sceneModule = await loaders[0]?.()
  expect(sceneModule).toHaveProperty('default', expect.any(Function))
})

import { render, screen } from '@testing-library/react'
import { catalog } from '../content/catalog'
import {
  firearmExhibitIds,
  type FirearmExhibitId,
} from '../content/types'
import { ExplorerPage } from '../pages/ExplorerPage'
import { CollectionCard } from './CollectionCard'
import { TankDiagram } from './TankDiagram'

const firearmTitles = Object.fromEntries(
  catalog
    .filter((item) => item.category === 'firearm')
    .map((item) => [item.id, item.title]),
) as Record<FirearmExhibitId, string>

function geometrySignature(root: Element): string {
  return Array.from(root.querySelectorAll('.diagram__profile-shape'))
    .map((shape) => shape.getAttribute('d'))
    .join('|')
}

describe('firearm teaching silhouettes', () => {
  it('gives the four canonical exhibits distinct accessible profiles and geometry', () => {
    const { container } = render(
      <>
        {firearmExhibitIds.map((exhibitId) => (
          <TankDiagram
            firearmExhibitId={exhibitId}
            key={exhibitId}
            label={`${firearmTitles[exhibitId]} 粗粒度侧视教学轮廓`}
            variant="firearm"
          />
        ))}
      </>,
    )

    const signatures = firearmExhibitIds.map((exhibitId) => {
      const diagram = screen.getByRole('img', {
        name: `${firearmTitles[exhibitId]} 粗粒度侧视教学轮廓`,
      })
      const profile = diagram.querySelector(
        `[data-firearm-profile="${exhibitId}"]`,
      )

      expect(profile).toHaveAttribute('data-firearm-geometry')
      expect(profile).toHaveClass('firearm-silhouette')

      const signature = geometrySignature(profile!)
      expect(signature).not.toBe('')
      return signature
    })

    expect(new Set(signatures).size).toBe(firearmExhibitIds.length)
    expect(
      container.querySelectorAll('[data-firearm-profile]'),
    ).toHaveLength(firearmExhibitIds.length)
  })

  it.each(firearmExhibitIds)(
    'reuses the %s profile geometry in the gallery and static diagram',
    (exhibitId) => {
      const item = catalog.find((entry) => entry.id === exhibitId)
      if (!item) throw new Error(`Missing catalog item ${exhibitId}`)

      const { container } = render(
        <>
          <CollectionCard
            archiveIndex={4}
            item={item}
            onExplore={vi.fn()}
          />
          <ExplorerPage
            exhibitId={exhibitId}
            forceStatic
            onExit={vi.fn()}
          />
        </>,
      )

      const profiles = Array.from(
        container.querySelectorAll(
          `.firearm-silhouette[data-firearm-profile="${exhibitId}"]`,
        ),
      )

      expect(profiles).toHaveLength(2)
      expect(profiles[0]).toHaveAttribute(
        'data-firearm-geometry',
        profiles[1].getAttribute('data-firearm-geometry'),
      )
      expect(geometrySignature(profiles[0])).toBe(
        geometrySignature(profiles[1]),
      )
    },
  )
})

import {
  firearmExhibitIds,
  type CatalogItem,
  type ExhibitId,
} from '../content/types'
import type { CSSProperties, FocusEvent, PointerEvent } from 'react'
import { TankDiagram } from './TankDiagram'

interface CollectionCardProps {
  archiveIndex: number
  item: CatalogItem
  onExplore: (id: ExhibitId) => void
}

const centeredSpotlight = {
  '--spotlight-x': '50%',
  '--spotlight-y': '50%',
} as CSSProperties

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function centerSpotlight(card: HTMLElement) {
  card.style.setProperty('--spotlight-x', '50%')
  card.style.setProperty('--spotlight-y', '50%')
  card.dataset.spotlightMode = 'center'
}

export function CollectionCard({
  archiveIndex,
  item,
  onExplore,
}: CollectionCardProps) {
  const titleId = `collection-${item.id}-title`
  const archiveLabel = String(archiveIndex).padStart(2, '0')
  const firearmExhibitId = firearmExhibitIds.find(
    (candidate) => candidate === item.id,
  )
  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const card = event.currentTarget
    const bounds = card.getBoundingClientRect()

    if (bounds.width <= 0 || bounds.height <= 0) {
      centerSpotlight(card)
      return
    }

    const x = clampPercentage(
      ((event.clientX - bounds.left) / bounds.width) * 100,
    )
    const y = clampPercentage(
      ((event.clientY - bounds.top) / bounds.height) * 100,
    )

    card.style.setProperty('--spotlight-x', `${x}%`)
    card.style.setProperty('--spotlight-y', `${y}%`)
    card.dataset.spotlightMode = 'pointer'
  }
  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    centerSpotlight(event.currentTarget)
  }

  return (
    <article
      aria-labelledby={titleId}
      className={`collection-card collection-card--${item.category} collection-card--${item.id} collection-card--${item.status}`}
      data-spotlight-mode="center"
      onFocusCapture={handleFocus}
      onPointerLeave={(event) => centerSpotlight(event.currentTarget)}
      onPointerMove={handlePointerMove}
      style={centeredSpotlight}
    >
      <p className="collection-card__archive" aria-hidden="true">
        ARCHIVE / {archiveLabel}
      </p>

      <div className="collection-card__visual">
        <TankDiagram
          className="collection-card__diagram"
          decorative
          firearmExhibitId={firearmExhibitId}
          variant={item.silhouette}
        />
      </div>

      <div className="collection-card__content">
        <p className="collection-card__eyebrow">{item.eyebrow}</p>
        <h4 id={titleId}>{item.title}</h4>
        <p className="collection-card__subtitle">{item.subtitle}</p>
        <p className="collection-card__description">{item.description}</p>

        <ul className="collection-card__facts" aria-label={`${item.title}概览`}>
          {item.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>

        <div className="collection-card__action">
          {item.status === 'available' ? (
            <button
              aria-label={`开始探索 ${item.title}`}
              className="collection-card__button"
              onClick={() => onExplore(item.id)}
              type="button"
            >
              <span>开始探索</span>
              <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <span className="collection-card__preview">
              <span aria-hidden="true">◇</span>
              即将开放
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

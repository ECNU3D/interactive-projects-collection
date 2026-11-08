import { m4Parts } from '../content/m4'
import type { ExhibitPartId, PartDefinition } from '../content/types'
import { MUSEUM_ACCENT_TOKENS } from '../scene/museumPalette'

interface PartNavigatorProps {
  parts?: readonly PartDefinition<ExhibitPartId>[]
  selected: ExhibitPartId | null
  onSelect: (id: ExhibitPartId) => void
}

export function PartNavigator({
  parts = m4Parts,
  selected,
  onSelect,
}: PartNavigatorProps) {
  return (
    <div
      className="part-navigator"
      id="explorer-parts"
      role="group"
      aria-label="结构零件"
      tabIndex={-1}
    >
      {parts.map((part, index) => (
        <button
          type="button"
          className="ui-button ui-button--secondary"
          key={part.id}
          aria-pressed={selected === part.id}
          aria-label={`查看${part.label}`}
          data-accent={part.accent}
          onClick={() => onSelect(part.id)}
        >
          <span className="part-navigator__index">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            className="part-navigator__accent"
            data-part-accent-token={MUSEUM_ACCENT_TOKENS[part.accent]}
            aria-hidden="true"
          />
          <span className="part-navigator__label">{part.label}</span>
        </button>
      ))}
    </div>
  )
}

import { useId, type ReactNode } from 'react'

export interface ExplorerInspectorProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: ReactNode
}

export function ExplorerInspector({
  expanded,
  onExpandedChange,
  children,
}: ExplorerInspectorProps) {
  const panelId = useId()

  return (
    <section
      className={`explorer-inspector explorer-inspector--${
        expanded ? 'expanded' : 'collapsed'
      } surface-glass`}
      aria-label="结构观察面板"
    >
      <button
        type="button"
        className="explorer-inspector__toggle ui-button ui-button--secondary"
        aria-controls={panelId}
        aria-expanded={expanded}
        aria-label={expanded ? '收起结构观察面板' : '展开结构观察面板'}
        onClick={() => onExpandedChange(!expanded)}
      >
        <span aria-hidden="true">{expanded ? '›' : '‹'}</span>
        <span>观察面板</span>
      </button>
      <div
        className="explorer-sidebar explorer-inspector__panel"
        id={panelId}
        data-testid="explorer-inspector-panel"
        data-sheet-state={expanded ? 'expanded' : 'collapsed'}
        hidden={!expanded}
      >
        {children}
      </div>
    </section>
  )
}

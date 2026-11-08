import { sources } from '../content/sources'
import type {
  ExhibitPartId,
  PartDefinition,
} from '../content/types'
import { PartGlyph } from './PartGlyph'
import { SpeechButton } from './SpeechButton'

interface KnowledgePanelProps {
  selected: PartDefinition<ExhibitPartId> | null
  safetyNotice?: string
}

type KnowledgeSectionKind = 'fact' | 'concept' | 'question'

function KnowledgeSectionIcon({ kind }: { kind: KnowledgeSectionKind }) {
  const path =
    kind === 'fact'
      ? 'M5 17h14M7 17V9l5-4 5 4v8M10 17v-4h4v4'
      : kind === 'concept'
        ? 'M4 15c3-6 6-6 9 0s5 4 7-2M4 9c3-5 6-5 9 0s5 4 7-2'
        : 'M9 9a3 3 0 1 1 4 2.8c-1.2.5-1.8 1.2-1.8 2.2M11.2 18h.01'

  return (
    <span
      className="knowledge-panel__section-icon"
      data-testid="knowledge-section-icon"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <path d={path} />
      </svg>
    </span>
  )
}

export function KnowledgePanel({
  selected,
  safetyNotice,
}: KnowledgePanelProps) {
  const notice = safetyNotice
    ? `惰性示意弹 / 非拆装顺序 · ${safetyNotice}`
    : '教育性重建 · 非工程图纸'

  if (!selected) {
    return (
      <aside
        className="knowledge-panel knowledge-panel--empty"
        id="knowledge-panel"
        aria-label="结构知识卡"
        tabIndex={-1}
      >
        <p className="knowledge-panel__index">结构知识卡</p>
        <p className="knowledge-panel__empty-prompt">选择一个发光标记</p>
        <p
          className={`knowledge-panel__notice${
            safetyNotice ? ' knowledge-panel__safety-notice' : ''
          }`}
        >
          {notice}
        </p>
      </aside>
    )
  }

  const source = sources.find((record) => record.id === selected.sourceId)

  return (
    <aside
      className={`knowledge-panel knowledge-panel--${selected.accent}`}
      id="knowledge-panel"
      aria-label="结构知识卡"
      tabIndex={-1}
    >
      <header className="knowledge-panel__header">
        <PartGlyph system={selected.system} accent={selected.accent} />
        <p className="knowledge-panel__system">{selected.system}</p>
        <h2>{selected.label}</h2>
        <p className="knowledge-panel__english" lang="en">
          {selected.englishLabel}
        </p>
      </header>

      <section
        className="knowledge-panel__section knowledge-panel__section--fact"
        data-knowledge-section="fact"
      >
        <div className="knowledge-panel__section-heading">
          <KnowledgeSectionIcon kind="fact" />
          <h3>史实依据</h3>
        </div>
        <p className="knowledge-panel__summary">{selected.historicalFact}</p>
        {source && (
          <a
            className="knowledge-panel__source"
            href={source.url}
            rel="noreferrer"
            target="_blank"
          >
            史实来源 · {source.organization} ↗
          </a>
        )}
      </section>

      <section
        className="knowledge-panel__section knowledge-panel__section--concept"
        data-knowledge-section="concept"
      >
        <div className="knowledge-panel__section-heading">
          <KnowledgeSectionIcon kind="concept" />
          <h3>简化示意</h3>
        </div>
        <p className="knowledge-panel__summary">
          {selected.simplifiedPrinciple}
        </p>
      </section>

      <div
        className="knowledge-panel__prompt knowledge-panel__prompt--question"
        data-knowledge-section="question"
      >
        <div className="knowledge-panel__section-heading">
          <KnowledgeSectionIcon kind="question" />
          <h3>观察问题</h3>
        </div>
        <p>{selected.prompt}</p>
      </div>

      <div className="knowledge-panel__actions">
        <SpeechButton
          text={`史实依据。${selected.historicalFact} 简化示意。${selected.simplifiedPrinciple} 观察问题。${selected.prompt}`}
        />
      </div>

      <p
        className={`knowledge-panel__notice${
          safetyNotice ? ' knowledge-panel__safety-notice' : ''
        }`}
      >
        {notice}
      </p>
    </aside>
  )
}

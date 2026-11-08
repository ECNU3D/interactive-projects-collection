import { m4Steps } from '../content/m4'
import type { ExploreStep } from '../content/types'

interface StageTimelineProps {
  steps?: readonly ExploreStep[]
  current: number
  onChange: (index: number) => void
}

export function StageTimeline({
  steps = m4Steps,
  current,
  onChange,
}: StageTimelineProps) {
  const total = String(steps.length).padStart(2, '0')

  return (
    <nav className="stage-timeline" aria-label="拆解步骤">
      <div className="stage-timeline__meta">
        <strong>拆解进度</strong>
        <span>
          {String(current + 1).padStart(2, '0')} / {total}
        </span>
      </div>

      <ol className="stage-timeline__steps">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              className="ui-button ui-button--ghost"
              aria-current={current === step.index ? 'step' : undefined}
              aria-label={`${step.shortLabel}：${step.label}`}
              onClick={() => onChange(step.index)}
            >
              <span className="stage-timeline__number">
                {String(step.index + 1).padStart(2, '0')}
              </span>
              <span className="stage-timeline__label">{step.shortLabel}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { ExploreStep } from '../content/types'

export interface LearningGuideProps {
  activeStep: ExploreStep
  guided: boolean
  demoPlaying: boolean
  reducedMotion: boolean
  atLastStep: boolean
  modeControls?: ReactNode
  onGuidedChange: (guided: boolean) => void
  onToggleDemo: () => void
}

export function LearningGuide({
  activeStep,
  guided,
  demoPlaying,
  reducedMotion,
  atLastStep,
  modeControls,
  onGuidedChange,
  onToggleDemo,
}: LearningGuideProps) {
  const hintId = useId()
  const [hintVisible, setHintVisible] = useState(false)
  const [conclusionVisible, setConclusionVisible] = useState(false)

  useEffect(() => {
    setHintVisible(false)
    setConclusionVisible(false)
  }, [activeStep.id, guided])

  if (!guided) {
    return (
      <aside className="learning-guide learning-guide--free">
        <div>
          <strong role="status" aria-live="polite" aria-atomic="true">
            自由探索已开启
          </strong>
          <h1 className="learning-guide__question">{activeStep.question}</h1>
          <p>你可以自己选择阶段、零件和观察模式，随时再打开导览。</p>
        </div>
        <button
          type="button"
          className="ui-button ui-button--primary"
          onClick={() => onGuidedChange(true)}
        >
          打开新手导览
        </button>
        {modeControls && (
          <div className="learning-guide__mode-context">{modeControls}</div>
        )}
      </aside>
    )
  }

  const demoDisabled = reducedMotion || (atLastStep && !demoPlaying)

  return (
    <aside className="learning-guide" aria-label="新手导览">
      <header className="learning-guide__header">
        <div>
          <p>
            阶段 {String(activeStep.index + 1).padStart(2, '0')} ·{' '}
            {activeStep.shortLabel}
          </p>
          <strong className="learning-guide__title">新手导览</strong>
        </div>
        <button
          type="button"
          className="ui-button ui-button--ghost"
          onClick={() => onGuidedChange(false)}
        >
          切换到自由探索
        </button>
      </header>

      <h1 className="learning-guide__question">{activeStep.question}</h1>

      <div className="learning-guide__actions">
        <button
          type="button"
          className="ui-button ui-button--secondary"
          aria-controls={hintId}
          aria-expanded={hintVisible}
          onClick={() => setHintVisible((visible) => !visible)}
        >
          {hintVisible ? '收起提示' : '看提示'}
        </button>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          aria-pressed={demoPlaying}
          disabled={demoDisabled}
          onClick={onToggleDemo}
        >
          {demoPlaying ? '暂停演示' : '自动演示'}
        </button>
        {!conclusionVisible && (
          <button
            type="button"
            className="ui-button ui-button--primary"
            onClick={() => setConclusionVisible(true)}
          >
            我想好了
          </button>
        )}
      </div>

      {hintVisible && (
        <p className="learning-guide__hint" id={hintId}>
          <strong>观察提示</strong>
          {activeStep.hint}
        </p>
      )}

      {conclusionVisible && (
        <div className="learning-guide__conclusion" role="status">
          <strong>没有标准答案</strong>
          <p>{activeStep.takeaway}</p>
          <button
            type="button"
            className="ui-button ui-button--primary"
            onClick={() => setConclusionVisible(false)}
          >
            再试一次
          </button>
        </div>
      )}

      {reducedMotion && (
        <p className="learning-guide__motion-note" role="note">
          减少动态已开启，自动演示保持暂停；你仍可手动切换阶段。
        </p>
      )}
      {atLastStep && !reducedMotion && (
        <p className="learning-guide__motion-note">
          已经到最后一个阶段；选择前面的阶段可以再次自动演示。
        </p>
      )}
      {modeControls && (
        <div className="learning-guide__mode-context">{modeControls}</div>
      )}
    </aside>
  )
}

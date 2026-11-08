import { m4Steps } from '../content/m4'
import type { ExploreStep } from '../content/types'
import { StageTimeline } from './StageTimeline'

export interface JourneyBarProps {
  steps?: readonly ExploreStep[]
  current: number
  onChange: (index: number) => void
}

export function JourneyBar({
  steps = m4Steps,
  current,
  onChange,
}: JourneyBarProps) {
  return (
    <footer className="explorer-footer journey-bar">
      <StageTimeline steps={steps} current={current} onChange={onChange} />
    </footer>
  )
}

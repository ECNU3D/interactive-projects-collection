import type { ExhibitCycleState } from '../scene/types'

export interface FirearmCycleControlsProps {
  cycleDescriptionId: string
  cycleState: ExhibitCycleState
  reducedMotion: boolean
  onPlay: () => void
  onPause: () => void
  onPrevious: () => void
  onNext: () => void
  onReset: () => void
}

export const FIREARM_CYCLE_PHASE_DESCRIPTIONS = [
  '准备观察',
  '抽象能量出现',
  '惰性示意替代物沿内部路径移动',
  '闭锁或延迟关系改变',
  '往复与抽取替身运动',
  '返回并完成单次循环',
] as const

export function FirearmCycleControls({
  cycleDescriptionId,
  cycleState,
  reducedMotion,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onReset,
}: FirearmCycleControlsProps) {
  const playing = cycleState.status === 'playing'
  const complete = cycleState.status === 'complete'
  const phaseDescription =
    FIREARM_CYCLE_PHASE_DESCRIPTIONS[cycleState.phaseIndex]

  return (
    <section
      className="firearm-cycle-controls"
      aria-label="机械循环控制"
    >
      <div className="firearm-cycle-controls__actions">
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={cycleState.phaseIndex === 0}
          onClick={onPrevious}
        >
          上一循环阶段
        </button>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={reducedMotion || playing}
          onClick={onPlay}
        >
          {complete ? '再次播放机械循环' : '播放一次机械循环'}
        </button>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={!playing}
          onClick={onPause}
        >
          暂停机械循环
        </button>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={cycleState.phaseIndex === 5}
          onClick={onNext}
        >
          下一循环阶段
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost"
          onClick={onReset}
        >
          复原循环
        </button>
      </div>
      <p
        id={cycleDescriptionId}
        className="firearm-cycle-controls__status"
        role="status"
        aria-atomic="true"
        aria-live="polite"
      >
        循环阶段 {cycleState.phaseIndex + 1} / 6：{phaseDescription}。
      </p>
      {reducedMotion && (
        <p className="firearm-cycle-controls__reduced-motion">
          已减少动态；可使用上一/下一循环阶段逐步查看。
        </p>
      )}
      <p className="firearm-cycle-controls__legend">
        惰性示意弹 / 非拆装顺序
      </p>
    </section>
  )
}

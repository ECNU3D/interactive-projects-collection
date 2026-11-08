import { Component, Fragment, createRef, type ReactNode } from 'react'
import { TankDiagram, type TankDiagramProps } from './TankDiagram'

interface SceneBoundaryProps {
  children: ReactNode
  onExit: () => void
  onError?: () => void
  onRetry?: () => void
  diagramVariant?: TankDiagramProps['variant']
  diagramLabel?: string
  firearmExhibitId?: TankDiagramProps['firearmExhibitId']
  firearmGuideStep?: TankDiagramProps['firearmGuideStep']
  firearmPhase?: TankDiagramProps['firearmPhase']
}

interface SceneBoundaryState {
  failed: boolean
  retryKey: number
}

export class SceneBoundary extends Component<
  SceneBoundaryProps,
  SceneBoundaryState
> {
  private fallbackRef = createRef<HTMLDivElement>()

  state: SceneBoundaryState = {
    failed: false,
    retryKey: 0,
  }

  static getDerivedStateFromError(): Partial<SceneBoundaryState> {
    return { failed: true }
  }

  componentDidCatch() {
    this.fallbackRef.current?.focus()
    this.props.onError?.()
  }

  private retry = () => {
    this.props.onRetry?.()
    this.setState((state) => ({
      failed: false,
      retryKey: state.retryKey + 1,
    }))
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          ref={this.fallbackRef}
          className="scene-fallback surface-glass"
          role="alert"
          tabIndex={-1}
        >
          <TankDiagram
            variant={this.props.diagramVariant ?? 'tank'}
            label={this.props.diagramLabel}
            className="scene-fallback__diagram"
            firearmExhibitId={this.props.firearmExhibitId}
            firearmGuideStep={this.props.firearmGuideStep}
            firearmPhase={this.props.firearmPhase}
          />
          <div className="scene-fallback__message">
            <strong>3D 展示暂时不可用</strong>
            <p>你仍然可以使用下方步骤和零件按钮继续观察。</p>
            <div className="scene-fallback__actions">
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={this.retry}
              >
                重新尝试
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={this.props.onExit}
              >
                返回藏品大厅
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>
    )
  }
}

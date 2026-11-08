import { Component, createRef, type ReactNode } from 'react'

interface RouteBoundaryProps {
  children: ReactNode
  onExit: () => void
  onRetry: () => void
}

interface RouteBoundaryState {
  failed: boolean
}

export class RouteBoundary extends Component<
  RouteBoundaryProps,
  RouteBoundaryState
> {
  private headingRef = createRef<HTMLHeadingElement>()

  state: RouteBoundaryState = {
    failed: false,
  }

  static getDerivedStateFromError(): RouteBoundaryState {
    return { failed: true }
  }

  componentDidCatch() {
    this.headingRef.current?.focus()
  }

  render() {
    if (this.state.failed) {
      return (
        <main
          className="route-loading surface-glass"
          role="alert"
          aria-labelledby="route-error-title"
        >
          <h1 id="route-error-title" ref={this.headingRef} tabIndex={-1}>
            探索室加载失败
          </h1>
          <p>别担心，模型没有丢失。请再试一次，或者先回大厅看看。</p>
          <div>
            <button
              type="button"
              className="ui-button ui-button--primary"
              onClick={this.props.onRetry}
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
        </main>
      )
    }

    return this.props.children
  }
}

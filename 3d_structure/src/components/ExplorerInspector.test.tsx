import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExplorerInspector } from './ExplorerInspector'

describe('ExplorerInspector', () => {
  it('exposes a controlled disclosure contract without hiding its toggle', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    const { rerender } = render(
      <ExplorerInspector
        expanded={false}
        onExpandedChange={onExpandedChange}
      >
        <p>观察内容</p>
      </ExplorerInspector>,
    )

    const toggle = screen.getByRole('button', { name: '展开结构观察面板' })
    const panel = screen.getByTestId('explorer-inspector-panel')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveClass('ui-button--secondary')
    expect(toggle.closest('section')).toHaveClass(
      'explorer-inspector--collapsed',
      'surface-glass',
    )
    expect(toggle).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('data-sheet-state', 'collapsed')
    expect(panel).toHaveAttribute('hidden')
    expect(panel).not.toBeVisible()

    await user.click(toggle)
    expect(onExpandedChange).toHaveBeenCalledWith(true)
    expect(panel).toHaveAttribute('hidden')
    expect(panel).not.toBeVisible()

    rerender(
      <ExplorerInspector
        expanded
        onExpandedChange={onExpandedChange}
      >
        <p>观察内容</p>
      </ExplorerInspector>,
    )

    expect(
      screen.getByRole('button', { name: '收起结构观察面板' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveAttribute('data-sheet-state', 'expanded')
    expect(panel.closest('section')).toHaveClass(
      'explorer-inspector--expanded',
    )
    expect(panel).not.toHaveAttribute('hidden')
    expect(screen.getByText('观察内容')).toBeVisible()
  })
})

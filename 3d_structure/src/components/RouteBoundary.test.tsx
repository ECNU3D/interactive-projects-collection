import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { RouteBoundary } from './RouteBoundary'

describe('RouteBoundary', () => {
  it('keeps its focused alert and retry hierarchy stable after a route error', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    function BrokenRoute(): ReactNode {
      throw new Error('route failed')
    }

    try {
      render(
        <RouteBoundary onExit={vi.fn()} onRetry={onRetry}>
          <BrokenRoute />
        </RouteBoundary>,
      )

      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('surface-glass')
      expect(
        screen.getByRole('heading', { name: '探索室加载失败' }),
      ).toHaveFocus()
      expect(screen.getByRole('button', { name: '重新尝试' })).toHaveClass(
        'ui-button--primary',
      )
      expect(
        screen.getByRole('button', { name: '返回藏品大厅' }),
      ).toHaveClass('ui-button--secondary')

      await user.click(screen.getByRole('button', { name: '重新尝试' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    } finally {
      consoleError.mockRestore()
    }
  })
})

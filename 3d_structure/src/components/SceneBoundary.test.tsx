import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { SceneBoundary } from './SceneBoundary'

describe('SceneBoundary', () => {
  it('keeps a semantic fallback usable and remounts the scene on retry', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    let shouldThrow = true
    let sceneInstances = 0

    function FlakyScene() {
      sceneInstances += 1

      if (shouldThrow) {
        throw new Error('scene failed')
      }

      return <p>三维场景已恢复</p>
    }

    try {
      render(
        <SceneBoundary onExit={onExit}>
          <FlakyScene />
        </SceneBoundary>,
      )

      expect(screen.getByText('3D 展示暂时不可用')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveFocus()
      expect(screen.getByRole('alert')).toHaveClass('surface-glass')
      expect(screen.getByRole('button', { name: '重新尝试' })).toHaveClass(
        'ui-button--primary',
      )
      expect(
        screen.getByRole('button', { name: '返回藏品大厅' }),
      ).toHaveClass('ui-button--secondary')
      expect(
        screen.getByRole('img', { name: 'M4 中型坦克静态结构示意' }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '返回藏品大厅' }))
      expect(onExit).toHaveBeenCalledTimes(1)

      shouldThrow = false
      await user.click(screen.getByRole('button', { name: '重新尝试' }))

      expect(await screen.findByText('三维场景已恢复')).toBeInTheDocument()
      expect(sceneInstances).toBeGreaterThan(1)
      expect(
        screen.queryByText('3D 展示暂时不可用'),
      ).not.toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('uses the active firearm diagram and exact exhibit label after an error', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    function BrokenScene(): ReactNode {
      throw new Error('firearm scene failed')
    }

    try {
      render(
        <SceneBoundary
          diagramVariant="firearm"
          diagramLabel="HK MP5 静态结构示意"
          firearmExhibitId="mp5"
          firearmGuideStep={3}
          firearmPhase={4}
          onExit={vi.fn()}
        >
          <BrokenScene />
        </SceneBoundary>,
      )

      expect(
        screen.getByRole('img', { name: 'HK MP5 静态结构示意' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('img', {
          name: 'M4 中型坦克静态结构示意',
        }),
      ).not.toBeInTheDocument()
      const diagram = screen.getByRole('img', {
        name: 'HK MP5 静态结构示意',
      })
      expect(diagram).toHaveAttribute('data-firearm-phase', '4')
      expect(diagram).toHaveAttribute('data-firearm-guide-step', '3')
      expect(
        diagram.querySelector('[data-firearm-profile="mp5"]'),
      ).toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
    }
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CameraCommandType } from '../scene/cameraControls'
import { CameraControls } from './CameraControls'

describe('CameraControls', () => {
  it('emits the existing five commands and disables focus without a selection', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn<(command: CameraCommandType) => void>()
    const { rerender } = render(
      <CameraControls selectedPartId={null} onCommand={onCommand} />,
    )
    const controls = screen.getByRole('group', { name: '三维视角控制' })
    const buttons = within(controls).getAllByRole('button', {
      name: /视角|旋转|拉近|拉远|聚焦/,
    })

    expect(buttons).toHaveLength(5)
    expect(
      within(controls).getByRole('button', { name: '聚焦已选零件' }),
    ).toBeDisabled()

    for (const [name, command] of [
      ['向左旋转视角', 'rotate-left'],
      ['向右旋转视角', 'rotate-right'],
      ['拉近视角', 'zoom-in'],
      ['拉远视角', 'zoom-out'],
    ] as const) {
      const button = within(controls).getByRole('button', { name })
      expect(button).toHaveAttribute('data-camera-command', command)
      await user.click(button)
    }

    rerender(
      <CameraControls
        selectedPartId="engine-module"
        onCommand={onCommand}
      />,
    )
    const focus = within(controls).getByRole('button', {
      name: '聚焦已选零件',
    })
    expect(focus).toBeEnabled()
    expect(focus).toHaveAttribute('data-camera-command', 'focus-selected')
    await user.click(focus)

    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([
      'rotate-left',
      'rotate-right',
      'zoom-in',
      'zoom-out',
      'focus-selected',
    ])
  })
})

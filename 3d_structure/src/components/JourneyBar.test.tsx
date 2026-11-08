import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { m4Steps } from '../content/m4'
import { JourneyBar } from './JourneyBar'

describe('JourneyBar', () => {
  it('contains one compact stage timeline and no duplicate question copy', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <JourneyBar steps={m4Steps} current={0} onChange={onChange} />,
    )

    const timeline = screen.getByRole('navigation', { name: '拆解步骤' })
    expect(within(timeline).getAllByRole('button')).toHaveLength(6)
    expect(within(timeline).getByText('01')).toBeVisible()
    expect(within(timeline).getByText(m4Steps[0].shortLabel)).toBeVisible()
    expect(within(timeline).queryByText(m4Steps[0].question)).not.toBeInTheDocument()

    await user.click(
      within(timeline).getByRole('button', {
        name: `${m4Steps[3].shortLabel}：${m4Steps[3].label}`,
      }),
    )
    expect(onChange).toHaveBeenCalledWith(3)
  })
})

import { render, screen } from '@testing-library/react'
import { SpeechButton } from './SpeechButton'

class MockSpeechSynthesisUtterance {
  lang = ''

  constructor(readonly text: string) {}
}

describe('SpeechButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cancels speech when content changes and when its route unmounts', () => {
    const cancel = vi.fn()
    vi.stubGlobal('speechSynthesis', {
      cancel,
      speak: vi.fn(),
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      MockSpeechSynthesisUtterance,
    )

    const { rerender, unmount } = render(<SpeechButton text="第一张知识卡" />)

    expect(screen.getByRole('button', { name: '朗读当前知识卡' })).toHaveClass(
      'ui-button--secondary',
    )

    rerender(<SpeechButton text="第二张知识卡" />)
    expect(cancel).toHaveBeenCalledTimes(1)

    unmount()
    expect(cancel).toHaveBeenCalledTimes(2)
  })
})

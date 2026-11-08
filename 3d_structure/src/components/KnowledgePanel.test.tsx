import { render, screen, within } from '@testing-library/react'
import { m4Parts, m4Steps } from '../content/m4'
import { MUSEUM_ACCENT_TOKENS } from '../scene/museumPalette'
import { KnowledgePanel } from './KnowledgePanel'

describe('KnowledgePanel', () => {
  it('keeps the empty card useful without repeating the active stage question', () => {
    render(<KnowledgePanel selected={null} />)

    const card = screen.getByRole('complementary', { name: '结构知识卡' })
    expect(card).toHaveTextContent('选择一个发光标记')
    expect(card).toHaveTextContent('教育性重建 · 非工程图纸')
    expect(within(card).queryByText(m4Steps[0].question)).not.toBeInTheDocument()
  })

  it('presents one labelled glyph and three icon-banded knowledge sections', () => {
    const selected = m4Parts[2]
    render(<KnowledgePanel selected={selected} />)

    const card = screen.getByRole('complementary', { name: '结构知识卡' })
    const headings = within(card).getAllByRole('heading')
    const glyph = within(card).getByTestId('knowledge-part-glyph')

    expect(headings.map((heading) => heading.textContent)).toEqual([
      selected.label,
      '史实依据',
      '简化示意',
      '观察问题',
    ])
    expect(glyph).toHaveAttribute('data-accent', selected.accent)
    expect(glyph).toHaveAttribute(
      'data-accent-token',
      MUSEUM_ACCENT_TOKENS[selected.accent],
    )
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    const sectionIcons = within(card).getAllByTestId('knowledge-section-icon')
    expect(sectionIcons).toHaveLength(3)
    for (const icon of sectionIcons) {
      expect(icon.querySelector('svg')).toHaveAttribute('fill', 'none')
      expect(icon.querySelector('svg')).toHaveAttribute(
        'stroke',
        'currentColor',
      )
    }
    expect(card.querySelectorAll('[data-knowledge-section]')).toHaveLength(3)
    expect(within(card).getByText(selected.historicalFact)).toBeVisible()
    expect(within(card).getByText(selected.simplifiedPrinciple)).toBeVisible()
    expect(within(card).getByText(selected.prompt)).toBeVisible()
    expect(within(card).getByRole('link', { name: /史实来源/ })).toBeVisible()
    expect(within(card).getByRole('button')).toHaveTextContent('朗读内容')
  })

  it('retains the prominent firearm safety boundary', () => {
    render(
      <KnowledgePanel
        selected={null}
        safetyNotice="仅用于观察抽象循环。"
      />,
    )

    const notice = screen
      .getByRole('complementary', { name: '结构知识卡' })
      .querySelector('.knowledge-panel__safety-notice')
    expect(notice).toHaveTextContent(
      '惰性示意弹 / 非拆装顺序 · 仅用于观察抽象循环。',
    )
  })
})

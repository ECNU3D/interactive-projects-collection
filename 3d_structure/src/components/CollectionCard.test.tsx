import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalog } from '../content/catalog'
import { CollectionCard } from './CollectionCard'

const tank = catalog[0]

function renderCard() {
  const onExplore = vi.fn()

  render(
    <CollectionCard archiveIndex={1} item={tank} onExplore={onExplore} />,
  )

  return {
    card: screen.getByRole('article'),
    explore: screen.getByRole('button', { name: '开始探索 M4 中型坦克' }),
    onExplore,
  }
}

it('moves the card spotlight with a clamped pointer position and resets it on leave', () => {
  const { card } = renderCard()

  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
    bottom: 250,
    height: 200,
    left: 100,
    right: 500,
    top: 50,
    width: 400,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  })

  fireEvent.pointerMove(card, { clientX: 200, clientY: 100 })

  expect(card).toHaveStyle({
    '--spotlight-x': '25%',
    '--spotlight-y': '25%',
  })
  expect(card).toHaveAttribute('data-spotlight-mode', 'pointer')

  fireEvent.pointerMove(card, { clientX: 900, clientY: -50 })
  expect(card).toHaveStyle({
    '--spotlight-x': '100%',
    '--spotlight-y': '0%',
  })

  fireEvent.pointerLeave(card)
  expect(card).toHaveStyle({
    '--spotlight-x': '50%',
    '--spotlight-y': '50%',
  })
  expect(card).toHaveAttribute('data-spotlight-mode', 'center')
})

it('gives keyboard focus a centered spotlight without requiring a pointer event', async () => {
  const user = userEvent.setup()
  const { card, explore } = renderCard()

  await user.tab()

  expect(explore).toHaveFocus()
  expect(card).toHaveStyle({
    '--spotlight-x': '50%',
    '--spotlight-y': '50%',
  })
  expect(card).toHaveAttribute('data-spotlight-mode', 'center')
})

it('retains the accessible action and its minimum touch-target contract', async () => {
  const user = userEvent.setup()
  const { explore, onExplore } = renderCard()

  expect(explore).toHaveClass('collection-card__button')
  await user.click(explore)
  expect(onExplore).toHaveBeenCalledWith('m4')
})

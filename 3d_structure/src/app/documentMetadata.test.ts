import html from '../../index.html?raw'

it('declares the museum favicon instead of requesting a missing default icon', () => {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const icon = document.querySelector('link[rel~="icon"]')

  expect(icon?.getAttribute('href')).toBe('/favicon.svg')
})

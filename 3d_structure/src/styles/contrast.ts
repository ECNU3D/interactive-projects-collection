type WcagTextSize = 'normal' | 'large'

function channelToLinear(channel: number) {
  const normalized = channel / 255

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function parseHexColor(hex: string) {
  const normalized = hex.trim().replace(/^#/, '')

  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalized)) {
    throw new Error(`Expected a three- or six-digit hex color, received "${hex}"`)
  }

  const expanded = normalized.length === 3
    ? normalized
        .split('')
        .map((digit) => `${digit}${digit}`)
        .join('')
    : normalized

  return [0, 2, 4].map((offset) =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16),
  )
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = parseHexColor(hex).map(channelToLinear)

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsWcagContrast(
  foreground: string,
  background: string,
  textSize: WcagTextSize,
) {
  return contrastRatio(foreground, background) >= (textSize === 'large' ? 3 : 4.5)
}

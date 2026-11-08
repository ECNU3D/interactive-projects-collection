import { exhibitIds } from '../content/types'

export const supportedExhibitIds = exhibitIds

export type SupportedExhibitId = (typeof supportedExhibitIds)[number]

function isSupportedExhibitId(id: string): id is SupportedExhibitId {
  return supportedExhibitIds.some((supportedId) => supportedId === id)
}

export function parseExploreHash(hash: string): SupportedExhibitId | null {
  const match = /^#\/explore\/([^/?#]+)(?:\?[^#]*)?$/.exec(hash)
  const id = match?.[1]

  return id && isSupportedExhibitId(id) ? id : null
}

export function buildExploreHash(id: string): string | null {
  return isSupportedExhibitId(id) ? `#/explore/${id}` : null
}

export const stepIds = [
  'whole',
  'exterior',
  'hull',
  'power',
  'running',
  'details',
] as const

export type StepId = (typeof stepIds)[number]

export type Category = 'tank' | 'aircraft' | 'vessel' | 'firearm'

export const firearmExhibitIds = [
  'm1903',
  'm1911a1',
  'm1-garand',
  'mp5',
] as const

export type FirearmExhibitId = (typeof firearmExhibitIds)[number]

export type FirearmCycleKind =
  | 'manual-bolt'
  | 'short-recoil'
  | 'gas-op-rod'
  | 'roller-delay'

export const exhibitIds = [
  'm4',
  'x57',
  'asr10',
  ...firearmExhibitIds,
] as const

export type ExhibitId = (typeof exhibitIds)[number]

export type SourceId =
  | 'm4-cutaway'
  | 'smithsonian-open'
  | 'nasa-3d'
  | 'maritime-cc0'
  | 'tank-museum-m4a1'
  | 'nasa-x57-project'
  | 'nasa-x57-overview'
  | 'ntrs-x57-modiv-performance'
  | 'ntrs-x57-power'
  | 'ntrs-x57-cockpit'
  | 'scottish-maritime-asr10'
  | 'noaa-boat-buoyancy'
  | 'imo-damage-stability'
  | 'rnli-brede-lifeboat'
  | 'rnli-sims-bridge'
  | 'nps-m1903-history'
  | 'nps-m1903-production'
  | 'smithsonian-m1911a1'
  | 'army-browning-m1911'
  | 'army-firearm-systems'
  | 'nps-springfield-ww2'
  | 'nps-m1-variations'
  | 'smithsonian-m1'
  | 'hk-mp5-official'
  | 'hk-roller-delay-history'

export type M4PartId =
  | 'hull-shell'
  | 'turret-shell'
  | 'engine-module'
  | 'transmission-path'
  | 'suspension-left'
  | 'suspension-right'
  | 'track-left'
  | 'track-right'
  | 'crew-space'
  | 'observation-system'
  | 'recoil-concept'

export type X57PartId =
  | 'airframe-cabin'
  | 'high-aspect-wing'
  | 'tail-control-surfaces'
  | 'landing-gear'
  | 'wingtip-cruise-motors'
  | 'high-lift-motor-array'
  | 'battery-modules'
  | 'dual-power-bus'
  | 'inverter-controllers'
  | 'cockpit-monitoring'
  | 'passive-cooling-path'

export type Asr10PartId =
  | 'vessel-hull-shell'
  | 'deck-superstructure'
  | 'buoyancy-compartments'
  | 'twin-engine-modules'
  | 'shaft-paths'
  | 'propeller-concept'
  | 'rudder-steering'
  | 'bilge-pump-path'
  | 'wheelhouse-observation-mast'
  | 'rescue-work-deck'
  | 'survivor-space'

export const firearmPartIds = [
  'firearm-support-shell',
  'firearm-receiver-shell',
  'firearm-barrel-chamber',
  'firearm-breech-member',
  'firearm-lock-delay-system',
  'firearm-return-drive-system',
  'firearm-input-linkage',
  'firearm-feed-module',
  'firearm-extraction-path',
  'firearm-inert-round-path',
  'firearm-cycle-indicator',
] as const

export type FirearmPartId = (typeof firearmPartIds)[number]

export type ExhibitPartId =
  | M4PartId
  | X57PartId
  | Asr10PartId
  | FirearmPartId

/** Backwards-compatible alias for the existing tank scene. New generic UI uses ExhibitPartId. */
export type PartId = M4PartId

export interface MuseumSource {
  id: SourceId
  title: string
  organization: string
  url: string
  licenseNote: string
}

export interface ExploreStep {
  id: StepId
  index: number
  label: string
  shortLabel: string
  question: string
  hint: string
  takeaway: string
}

export interface PartDefinition<
  TPartId extends ExhibitPartId = PartId,
> {
  id: TPartId
  label: string
  englishLabel: string
  system: string
  stepId: StepId
  historicalFact: string
  simplifiedPrinciple: string
  prompt: string
  sourceId: SourceId
  accent: 'brass' | 'oxide' | 'teal'
  explodeOffset: readonly [number, number, number]
  dimAfterStep?: number
}

export interface CatalogItem {
  id: ExhibitId
  category: Category
  eyebrow: string
  title: string
  subtitle: string
  description: string
  status: 'available' | 'preview'
  silhouette: Category
  facts: readonly string[]
}

export interface ExhibitDefinition {
  id: ExhibitId
  category: Category
  title: string
  subtitle: string
  diagramVariant: Category
  cycleKind?: FirearmCycleKind
  modelLabel: string
  reconstructionNote: string
  steps: readonly ExploreStep[]
  parts: readonly PartDefinition<ExhibitPartId>[]
}

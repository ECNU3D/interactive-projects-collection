import type { ComponentType } from 'react'
import type { ExhibitId, ExhibitPartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import type { CameraCommand } from './cameraControls'

export interface ExhibitCycleState {
  phaseIndex: number
  status: 'idle' | 'playing' | 'paused' | 'complete'
  revision: number
}

export interface ExhibitSceneProps {
  exhibitId: ExhibitId
  stepIndex: number
  mode: ExploreMode
  selectedPartId: ExhibitPartId | null
  focusPartId?: ExhibitPartId | null
  autoplay: boolean
  reducedMotion: boolean
  resetToken: number
  cameraCommand?: CameraCommand
  onSelect: (partId: ExhibitPartId) => void
  onReady?: () => void
  cycleState?: ExhibitCycleState
  cycleDescriptionId?: string
}

export type ExhibitSceneLoader = () => Promise<{
  default: ComponentType<ExhibitSceneProps>
}>

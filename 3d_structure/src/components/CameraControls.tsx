import type { ExhibitPartId } from '../content/types'
import type { CameraCommandType } from '../scene/cameraControls'

export interface CameraControlsProps {
  selectedPartId: ExhibitPartId | null
  onCommand: (command: CameraCommandType) => void
}

const cameraActions = [
  {
    command: 'rotate-left',
    label: '向左旋转视角',
    glyph: '↶',
    shortLabel: '左转',
  },
  {
    command: 'rotate-right',
    label: '向右旋转视角',
    glyph: '↷',
    shortLabel: '右转',
  },
  {
    command: 'zoom-in',
    label: '拉近视角',
    glyph: '＋',
    shortLabel: '拉近',
  },
  {
    command: 'zoom-out',
    label: '拉远视角',
    glyph: '−',
    shortLabel: '拉远',
  },
  {
    command: 'focus-selected',
    label: '聚焦已选零件',
    glyph: '◎',
    shortLabel: '聚焦',
  },
] as const satisfies readonly {
  command: CameraCommandType
  label: string
  glyph: string
  shortLabel: string
}[]

export function CameraControls({
  selectedPartId,
  onCommand,
}: CameraControlsProps) {
  return (
    <fieldset className="explorer-camera-controls">
      <legend>三维视角控制</legend>
      {cameraActions.map((action) => (
        <button
          type="button"
          className="ui-button ui-button--ghost"
          key={action.command}
          aria-label={action.label}
          data-camera-command={action.command}
          disabled={action.command === 'focus-selected' && !selectedPartId}
          onClick={() => onCommand(action.command)}
        >
          <span aria-hidden="true">{action.glyph}</span>
          {action.shortLabel}
        </button>
      ))}
    </fieldset>
  )
}

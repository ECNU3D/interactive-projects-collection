import { useId } from 'react'
import type { FirearmExhibitId } from '../content/types'
import { FirearmSilhouette } from './FirearmSilhouette'

export interface TankDiagramProps {
  variant: 'tank' | 'aircraft' | 'vessel' | 'firearm'
  decorative?: boolean
  className?: string
  label?: string
  firearmExhibitId?: FirearmExhibitId
  firearmGuideStep?: 0 | 1 | 2 | 3 | 4 | 5
  firearmPhase?: 0 | 1 | 2 | 3 | 4 | 5
}

const diagramLabels: Record<TankDiagramProps['variant'], string> = {
  tank: 'M4 中型坦克静态结构示意',
  aircraft: 'X-57 电动飞机静态结构示意',
  vessel: '现代救援船教学复合模型静态结构示意',
  firearm: '枪械机械循环教学模型静态结构示意',
}

export function TankDiagram({
  variant,
  decorative = false,
  className,
  label,
  firearmExhibitId = 'm1903',
  firearmGuideStep = 0,
  firearmPhase = 0,
}: TankDiagramProps) {
  const titleId = useId()
  const classes = [
    'tank-diagram',
    `tank-diagram--${variant}`,
    variant === 'firearm'
      ? `tank-diagram--firearm-phase-${firearmPhase}`
      : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      aria-labelledby={decorative ? undefined : titleId}
      className={classes}
      focusable="false"
      role={decorative ? undefined : 'img'}
      data-firearm-phase={variant === 'firearm' ? firearmPhase : undefined}
      data-firearm-guide-step={
        variant === 'firearm' ? firearmGuideStep : undefined
      }
      viewBox="0 0 720 360"
      xmlns="http://www.w3.org/2000/svg"
    >
      {!decorative && (
        <title id={titleId}>{label ?? diagramLabels[variant]}</title>
      )}

      {variant !== 'firearm' && (
        <g className="diagram__drafting" aria-hidden="true">
          <path d="M48 310H672" />
          <path d="M73 326H646" />
          <path d="M72 300V320M648 300V320" />
          <path d="M106 52H614" />
        </g>
      )}

      {variant === 'tank' && (
        <g className="diagram__assembly diagram__assembly--tank">
          <path
            className="diagram__shadow"
            d="M91 270c8-46 43-76 91-76h341c56 0 96 32 105 78l-32 25H123Z"
          />
          <path
            className="diagram__teal"
            d="M101 244c9-35 38-57 78-57h355c44 0 76 25 84 61l-31 37H132c-24-8-35-21-31-41Z"
          />
          <path
            className="diagram__dark"
            d="M127 242c10-24 31-38 60-38h337c31 0 54 15 65 40l-23 23H146c-18-5-25-13-19-25Z"
          />
          <g className="diagram__wheels">
            {[176, 245, 314, 383, 452, 521].map((x) => (
              <g key={x}>
                <circle className="diagram__brass" cx={x} cy="239" r="26" />
                <circle className="diagram__dark" cx={x} cy="239" r="14" />
                <path d={`M${x - 9} 239h18M${x} 230v18`} />
              </g>
            ))}
          </g>
          <path
            className="diagram__oxide"
            d="m139 178 43-51h292l78 49 37 55-41 8H133l-21-25Z"
          />
          <path
            className="diagram__ivory"
            d="m205 126 28-48h171l47 18 18 38H205Z"
          />
          <path
            className="diagram__brass"
            d="m433 101 183-5 45 9-4 15-205 14Z"
          />
          <path className="diagram__dark" d="m632 96 34 5-2 21-32-3Z" />
          <path
            className="diagram__teal"
            d="M170 178h164v56H143l-17-20Zm177-35h130l69 40-28 51H347Z"
          />
          <path
            className="diagram__oxide diagram__oxide--soft"
            d="M365 157h88v58h-88z"
          />
          <path className="diagram__dark" d="M376 167h18v39h-18zm27 0h18v39h-18zm27 0h13v39h-13z" />
          <path className="diagram__brass diagram__linework" d="M157 194h165M335 143v91M472 151l-27 83" />
          <path className="diagram__linework" d="m192 128 19 15h126l18-17M241 78l23 24h142l25-8" />
          <path className="diagram__linework" d="M199 179v55m47-55v55m47-55v55M487 167l31 16-20 34" />
          <g className="diagram__rivets">
            {[159, 207, 255, 303, 496, 530].map((x) => (
              <circle key={x} cx={x} cy="184" r="3.5" />
            ))}
          </g>
          <path className="diagram__measure" d="M101 166V78m0 0h84m-84 0 12-8m-12 8 12 8" />
        </g>
      )}

      {variant === 'aircraft' && (
        <g className="diagram__assembly diagram__assembly--aircraft">
          <path
            className="diagram__shadow"
            d="m70 206 242-54 27-91h43l29 91 239 51-12 31-229-17-30 81h-39l-31-81-229 20Z"
          />
          <path
            className="diagram__teal"
            d="m78 190 236-47 32-84h30l31 84 235 46-8 25-232-14-32 91h-20l-33-91-232 15Z"
          />
          <path
            className="diagram__ivory"
            d="M343 58h34l17 107-21 126h-27l-19-126Z"
          />
          <path className="diagram__oxide" d="m348 67 24-1 8 100-30 1Z" />
          <path className="diagram__brass" d="m340 181 40-1-9 103h-21Z" />
          <path
            className="diagram__dark"
            d="m125 186 196-36-6 47-190 9Zm274-36 197 37-1 19-190-10Z"
          />
          <g className="diagram__battery-cells">
            {[168, 202, 236, 270].map((x) => (
              <rect key={`left-${x}`} x={x} y="171" width="23" height="18" rx="2" />
            ))}
            {[429, 463, 497, 531].map((x) => (
              <rect key={`right-${x}`} x={x} y="171" width="23" height="18" rx="2" />
            ))}
          </g>
          <g className="diagram__motors">
            {[133, 193, 253, 467, 527, 587].map((x) => (
              <g key={x}>
                <circle cx={x} cy={x < 360 ? 178 : 179} r="12" />
                <path d={`M${x - 19} 178h38M${x} 159v38`} />
              </g>
            ))}
          </g>
          <path className="diagram__linework" d="M107 203 315 160m298 44-209-44M360 69v205" />
          <path className="diagram__linework" d="m333 232-89 40m143-40 88 40" />
          <path className="diagram__oxide diagram__oxide--soft" d="m301 259 39-20 7 46-61 22Z" />
          <path className="diagram__oxide diagram__oxide--soft" d="m379 239 41 20 15 48-62-22Z" />
          <path className="diagram__measure" d="M83 116h168m-168 0 11-7m-11 7 11 7" />
        </g>
      )}

      {variant === 'vessel' && (
        <g className="diagram__assembly diagram__assembly--vessel">
          <path
            className="diagram__shadow"
            d="m68 211 580-7-72 100H178c-35-8-68-37-91-69Z"
          />
          <path
            className="diagram__teal"
            d="m78 198 561-4-70 92H185c-34-8-62-31-88-63Z"
          />
          <path
            className="diagram__dark"
            d="m116 224 467-8-30 52H193c-27-5-53-20-77-44Z"
          />
          <path className="diagram__oxide" d="m92 197 548-3-20 29-506 5Z" />
          <path
            className="diagram__ivory"
            d="M208 126h174l42 71H167l20-53Z"
          />
          <path className="diagram__teal" d="m232 139 119 1 30 46H211Z" />
          <path className="diagram__dark" d="m248 147 45 1-6 30h-52zm56 1 42 1 16 29h-64Z" />
          <path className="diagram__brass" d="M276 92h12v35h-12zm-22 0h56l-7-15h-40Z" />
          <path className="diagram__linework" d="M191 126h247M159 197h485M211 228v55m66-55v55m66-55v55m66-55v55m66-55v55" />
          <path className="diagram__oxide diagram__oxide--soft" d="M297 236h112v34H297Z" />
          <path className="diagram__dark" d="M309 244h29v18h-29zm36 0h23v18h-23zm30 0h23v18h-23z" />
          <path className="diagram__brass diagram__linework" d="M409 253h101l43 21" />
          <circle className="diagram__brass" cx="518" cy="260" r="11" />
          <path className="diagram__brass" d="m552 268 32 4-5 31-29-11Z" />
          <path className="diagram__linework" d="M142 235h406M168 253h380" />
          <path className="diagram__water" d="M78 316c52-12 92 11 144 0s92 10 144 0 92 10 144 0 92 10 144 0" />
          <path className="diagram__water" d="M118 334c48-10 84 8 132 0s84 8 132 0 84 8 132 0 84 8 132 0" />
          <path className="diagram__measure" d="M117 105h100m-100 0 11-7m-11 7 11 7" />
        </g>
      )}

      {variant === 'firearm' && (
        <FirearmSilhouette
          exhibitId={firearmExhibitId}
          guideStep={firearmGuideStep}
          phase={firearmPhase}
        />
      )}
    </svg>
  )
}

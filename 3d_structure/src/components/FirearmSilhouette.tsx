import type { FirearmExhibitId } from '../content/types'

type FirearmPhase = 0 | 1 | 2 | 3 | 4 | 5

interface SubstituteGeometry {
  height: number
  transform: string
  width: number
  x: number
  y: number
}

interface FirearmProfileGeometry {
  geometry: string
  shadow: string
  support: string
  supportInset: string
  receiver: string
  barrel: string
  endCap: string
  cutaway: string
  movingBlock: string
  movingBlockInset: string
  movingTransforms: readonly [string, string, string, string, string, string]
  energyPath: string
  inert: SubstituteGeometry
  extraction: SubstituteGeometry
  linework: string
  brassLinework: string
  secondaryPath?: string
}

const firearmProfiles = {
  m1903: {
    geometry: 'long-slender-traditional-support',
    shadow:
      'M63 237 110 185l119-39 61 4 44-12h109l31 10 175 1v34l-178 4-34 25-112 3-76 54H86l30-34Z',
    support:
      'm72 221 49-43 106-35 66 9-20 55-50 48H94l33-31Z',
    supportInset:
      'm105 215 34-25 82-27 43 7-14 31-38 34h-91l22-22Z',
    receiver: 'm263 145 183-1 36 19-31 50-177-1-24-28Z',
    barrel: 'm438 151 205-2v27l-207 5Z',
    endCap: 'm631 149 17 1v26l-17 1Z',
    cutaway:
      'M94 218 149 180l83-25 49 10h158l29 11 157-10M272 198h163l31-22',
    movingBlock: 'm317 155 91 1 25 18-18 36-96-2-16-24Z',
    movingBlockInset: 'm337 166 52 1 22 12-11 18-64-1-10-14Z',
    movingTransforms: [
      'translate(0 0)',
      'translate(0 0)',
      'translate(0 0)',
      'translate(-18 0)',
      'translate(-54 0)',
      'translate(0 0)',
    ],
    energyPath: 'M285 184c27-24 55 23 86-1s58 17 91-4',
    inert: {
      height: 22,
      transform: 'translate(22 -34)',
      width: 43,
      x: 433,
      y: 191,
    },
    extraction: {
      height: 18,
      transform: 'translate(-46 -18)',
      width: 36,
      x: 433,
      y: 191,
    },
    linework: 'M276 151v56m17-57v58m129-60 19 12-17 51M151 224h103',
    brassLinework: 'M489 158h126M489 169h126',
  },
  m1911a1: {
    geometry: 'compact-slide-pronounced-grip',
    shadow:
      'M155 112h390l14 17-15 65H435l-25 28-18 92h-99l24-106-45-17H168l-20-28Z',
    support:
      'm219 164 211 1-28 48-18 88h-74l21-102-67-20h-50Z',
    supportInset: 'm317 211 70 2-16 74h-47l16-71Z',
    receiver: 'm164 118 373 1 12 17-12 51-354-1-24-24Z',
    barrel: 'm405 137 135 1-5 27-137-2Z',
    endCap: 'm524 119 19 1 6 16-7 50-18-1Z',
    cutaway:
      'M183 145h340M224 174h194l-25 31-15 82M288 190l45 17',
    movingBlock: 'm276 126 157 1 11 12-7 37-165-2-10-24Z',
    movingBlockInset: 'm297 137 116 1 10 9-5 17-121-1-8-14Z',
    movingTransforms: [
      'translate(0 0)',
      'translate(0 0)',
      'translate(0 0)',
      'translate(-12 0)',
      'translate(-38 0)',
      'translate(0 0)',
    ],
    energyPath: 'M247 179c31-22 55 18 83-2s52 16 83-4',
    inert: {
      height: 19,
      transform: 'translate(12 -20)',
      width: 38,
      x: 407,
      y: 179,
    },
    extraction: {
      height: 17,
      transform: 'translate(-35 -22)',
      width: 32,
      x: 405,
      y: 178,
    },
    linework: 'M201 130v43m24-43v43m206-42-5 43M319 218l54 2-12 60',
    brassLinework: 'M453 145h65M453 156h63',
  },
  'm1-garand': {
    geometry: 'long-handguard-lower-energy-relationship',
    shadow:
      'M58 236 104 189l119-43 73 6 44-15h116l34 15 157-1v32l-155 5-34 23-119 5-82 55H80l35-37Z',
    support:
      'm67 220 49-40 105-38 78 13-16 56-58 47H89l36-35Z',
    supportInset:
      'm103 213 35-23 83-29 50 11-13 31-45 35h-98l26-23Z',
    receiver: 'm274 145 185-2 42 23-37 50-177-2-29-31Z',
    barrel: 'm446 151 199-1v27l-201 5Z',
    endCap: 'm631 150 17 1v26l-17 1Z',
    cutaway:
      'M95 218 153 179l72-26 58 18h158l36 9 151-12M284 201h168l31-22',
    movingBlock: 'm324 155 92 2 26 18-19 36-96-2-19-25Z',
    movingBlockInset: 'm343 167 54 1 22 12-11 18-65-1-11-15Z',
    movingTransforms: [
      'translate(0 0)',
      'translate(0 0)',
      'translate(0 0)',
      'translate(-16 0)',
      'translate(-50 0)',
      'translate(0 0)',
    ],
    energyPath: 'M579 199c-44 31-89 7-123 30s-70-4-101 20',
    inert: {
      height: 22,
      transform: 'translate(18 -35)',
      width: 43,
      x: 438,
      y: 192,
    },
    extraction: {
      height: 18,
      transform: 'translate(-44 -19)',
      width: 36,
      x: 438,
      y: 191,
    },
    linework: 'M286 150v61m18-62v62m134-62 20 14-18 49M151 226h111',
    brassLinework: 'M499 159h119M499 171h119',
    secondaryPath: 'M348 224c72 4 142 6 222-17l40-17',
  },
  mp5: {
    geometry: 'compact-box-receiver-short-front-shoulder-support',
    shadow:
      'M72 133h132l30-23h230l38 28h112l12 20-14 43H491l-30 25h-67l-14 78h-84l18-81-53-20h-56l-32 26H72Z',
    support:
      'M82 143h111l35-25 61 2-15 72h-51l-39 27H82Z',
    supportInset: 'M101 155h84l28-20 45 1-8 41h-38l-32 24h-79Z',
    receiver: 'm260 117 201-1 43 29-29 78-203-2-32-31Z',
    barrel: 'm463 139 151 2-9 40-148-3Z',
    endCap: 'm596 140 25 1-8 41-24-1Z',
    cutaway:
      'M95 174h132l48-37h176l35 21 108 2M273 204h192l27-47',
    movingBlock: 'm315 132 103 1 28 21-18 48-113-2-20-34Z',
    movingBlockInset: 'm336 145 65 1 23 14-11 28-76-1-15-22Z',
    movingTransforms: [
      'translate(0 0)',
      'translate(0 0)',
      'translate(0 0)',
      'translate(-15 0)',
      'translate(-44 0)',
      'translate(0 0)',
    ],
    energyPath: 'M294 177c28-27 55 24 84-3s55 21 86-4',
    inert: {
      height: 20,
      transform: 'translate(15 -28)',
      width: 39,
      x: 451,
      y: 194,
    },
    extraction: {
      height: 17,
      transform: 'translate(-39 -19)',
      width: 33,
      x: 447,
      y: 193,
    },
    linework: 'M274 128v81m23-82v82m153-80 23 17-19 64M314 222l-14 68',
    brassLinework: 'M510 151h79M508 166h78',
  },
} as const satisfies Record<FirearmExhibitId, FirearmProfileGeometry>

interface FirearmSilhouetteProps {
  exhibitId: FirearmExhibitId
  guideStep: FirearmPhase
  phase: FirearmPhase
}

export function FirearmSilhouette({
  exhibitId,
  guideStep,
  phase,
}: FirearmSilhouetteProps) {
  const profile: FirearmProfileGeometry = firearmProfiles[exhibitId]
  const movingTransform = profile.movingTransforms[phase]

  return (
    <g
      className={`diagram__assembly diagram__assembly--firearm firearm-silhouette firearm-silhouette--${exhibitId}`}
      data-firearm-geometry={profile.geometry}
      data-firearm-profile={exhibitId}
      data-firearm-guide-step={guideStep}
    >
      <g className="diagram__firearm-field" aria-hidden="true">
        <path d="M70 302H650" />
        <path d="M94 70H626" />
      </g>
      <path
        className="diagram__shadow diagram__profile-shape"
        d={profile.shadow}
        data-guide-highlight={guideStep === 0 ? 'true' : undefined}
        data-guide-layer="profile"
      />
      <path
        className="diagram__teal diagram__firearm-support diagram__profile-shape"
        d={profile.support}
        data-guide-highlight={guideStep === 1 ? 'true' : undefined}
        data-guide-layer="support"
      />
      <path
        className="diagram__dark diagram__profile-shape"
        d={profile.supportInset}
      />
      <path
        className="diagram__teal diagram__firearm-receiver diagram__profile-shape"
        d={profile.receiver}
      />
      <path
        className="diagram__teal diagram__firearm-muzzle diagram__profile-shape"
        d={profile.barrel}
      />
      <path
        className="diagram__dark diagram__profile-shape"
        d={profile.endCap}
      />
      {profile.secondaryPath && (
        <path
          className="diagram__oxide diagram__oxide--soft diagram__profile-shape diagram__firearm-secondary"
          d={profile.secondaryPath}
        />
      )}
      <path className="diagram__cutaway" d={profile.cutaway} />
      <path
        className="diagram__brass diagram__moving-block"
        d={profile.movingBlock}
        data-cycle-highlight={phase === 3 ? 'true' : undefined}
        data-guide-highlight={guideStep === 2 ? 'true' : undefined}
        data-guide-layer="locking-interface"
        transform={movingTransform}
      />
      <path
        className="diagram__dark"
        d={profile.movingBlockInset}
        transform={movingTransform}
      />
      <path
        className="diagram__energy-path"
        d={profile.energyPath}
        data-cycle-highlight={phase === 1 ? 'true' : undefined}
        opacity={phase === 1 ? 1 : 0.18}
      />
      <rect
        className="diagram__inert-substitute"
        data-guide-highlight={guideStep === 3 ? 'true' : undefined}
        data-guide-layer="inert-event"
        height={profile.inert.height}
        opacity={phase === 2 ? 1 : 0}
        rx="6"
        transform={profile.inert.transform}
        width={profile.inert.width}
        x={profile.inert.x}
        y={profile.inert.y}
      />
      <rect
        className="diagram__extraction-substitute"
        data-guide-highlight={guideStep === 4 ? 'true' : undefined}
        data-guide-layer="return-path"
        height={profile.extraction.height}
        opacity={phase === 4 ? 1 : 0}
        rx="5"
        transform={profile.extraction.transform}
        width={profile.extraction.width}
        x={profile.extraction.x}
        y={profile.extraction.y}
      />
      <path className="diagram__linework" d={profile.linework} />
      <path
        className="diagram__brass diagram__linework"
        d={profile.brassLinework}
        data-guide-highlight={guideStep === 5 ? 'true' : undefined}
        data-guide-layer="review-linework"
      />
    </g>
  )
}

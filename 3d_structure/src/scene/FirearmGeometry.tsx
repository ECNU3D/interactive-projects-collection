import { Capsule, Line as FlowLine, RoundedBox } from '@react-three/drei'
import type { RefObject } from 'react'
import type {
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import type { FirearmConfig, FirearmProfile } from './firearmConfigs'

export const DISABLED_FIREARM_SUBSTITUTE_RAYCAST: Object3D['raycast'] = () =>
  undefined

export function disableFirearmSubstituteRaycast(mesh: Mesh | null) {
  if (mesh) mesh.raycast = DISABLED_FIREARM_SUBSTITUTE_RAYCAST
}

export function SupportShell({
  material,
  profile,
  supportLength,
}: {
  material: MeshStandardMaterial
  profile: FirearmProfile
  supportLength: number
}) {
  if (profile === 'pistol') {
    return (
      <>
        <RoundedBox args={[0.72, 1.35, 0.46]} radius={0.12} smoothness={3} material={material} castShadow />
        <RoundedBox args={[1.18, 0.24, 0.5]} position={[0.44, 0.67, 0]} radius={0.08} smoothness={2} material={material} />
      </>
    )
  }

  const length = 4.1 * supportLength
  return (
    <>
      <RoundedBox args={[length, 0.54, 0.48]} radius={0.17} smoothness={3} material={material} castShadow receiveShadow />
      <RoundedBox
        args={[profile === 'compact' ? 0.68 : 0.82, 0.92, 0.42]}
        position={[length * 0.18, -0.38, 0]}
        rotation={[0, 0, -0.18]}
        radius={0.12}
        smoothness={3}
        material={material}
      />
      {profile === 'rifle' && (
        <RoundedBox
          args={[length * 0.42, 0.24, 0.4]}
          position={[length * 0.38, 0.26, 0]}
          radius={0.08}
          smoothness={2}
          material={material}
        />
      )}
    </>
  )
}

export function ReceiverShell({
  material,
  bodyLength,
  profile,
}: {
  material: MeshStandardMaterial
  bodyLength: number
  profile: FirearmProfile
}) {
  const length = 2.45 * bodyLength
  const height = profile === 'compact' ? 0.72 : profile === 'pistol' ? 0.56 : 0.62

  return (
    <>
      <RoundedBox args={[length, height, 0.54]} radius={0.12} smoothness={3} material={material} castShadow />
      <RoundedBox args={[length * 0.86, 0.12, 0.6]} position={[0, height * 0.48, 0]} radius={0.04} smoothness={2} material={material} />
    </>
  )
}

export function BarrelAxis({
  material,
  barrelLength,
  motionRef,
}: {
  material: MeshStandardMaterial
  barrelLength: number
  motionRef: RefObject<Group | null>
}) {
  const length = 3.45 * barrelLength

  return (
    <group ref={motionRef} name="teaching-barrel-axis-motion">
      <mesh rotation={[0, 0, Math.PI / 2]} material={material} castShadow>
        <cylinderGeometry args={[0.16, 0.19, length, 20, 1, true]} />
      </mesh>
      <mesh position={[-length * 0.43, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={material}>
        <torusGeometry args={[0.23, 0.05, 8, 22]} />
      </mesh>
      <FlowLine points={[[-length / 2, 0, 0], [length / 2, 0, 0]]} color="#ead8ae" lineWidth={1} transparent opacity={0.3} />
    </group>
  )
}

export function BreechMember({
  material,
  bodyLength,
  motionRef,
}: {
  material: MeshStandardMaterial
  bodyLength: number
  motionRef: RefObject<Group | null>
}) {
  return (
    <group ref={motionRef} name="teaching-breech-member-motion">
      <RoundedBox args={[0.72 + bodyLength * 0.3, 0.34, 0.36]} radius={0.08} smoothness={3} material={material} castShadow />
      <mesh position={[0.35, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={material}>
        <torusGeometry args={[0.19, 0.055, 7, 18]} />
      </mesh>
    </group>
  )
}

export function LockDelayElement({
  material,
  cycleKind,
  motionRef,
}: {
  material: MeshStandardMaterial
  cycleKind: FirearmConfig['cycleKind']
  motionRef: RefObject<Group | null>
}) {
  return (
    <group ref={motionRef} name="abstract-lock-delay-motion">
      {cycleKind === 'roller-delay' ? (
        <>
          {[-0.19, 0.19].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={material} castShadow>
              <sphereGeometry args={[0.14, 14, 10]} />
            </mesh>
          ))}
          <RoundedBox args={[0.46, 0.18, 0.32]} radius={0.06} smoothness={2} material={material} />
        </>
      ) : cycleKind === 'short-recoil' ? (
        <RoundedBox args={[0.58, 0.2, 0.38]} rotation={[0, 0, -0.14]} radius={0.06} smoothness={2} material={material} />
      ) : (
        <>
          <mesh rotation={[0, Math.PI / 2, 0]} material={material}>
            <torusGeometry args={[0.25, 0.07, 8, 18]} />
          </mesh>
          {[-0.21, 0.21].map((y) => (
            <RoundedBox key={y} args={[0.28, 0.13, 0.35]} position={[0, y, 0]} radius={0.04} smoothness={2} material={material} />
          ))}
        </>
      )}
    </group>
  )
}

export function ReturnDrive({
  material,
  cycleKind,
  motionRef,
}: {
  material: MeshStandardMaterial
  cycleKind: FirearmConfig['cycleKind']
  motionRef: RefObject<Group | null>
}) {
  const length = cycleKind === 'gas-op-rod' ? 1.75 : 1.12

  return (
    <group ref={motionRef} name="abstract-return-drive-motion">
      <Capsule args={[0.075, length, 8, 14]} rotation={[0, 0, Math.PI / 2]} material={material} />
      {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
        <mesh key={x} position={[x * length, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={material}>
          <torusGeometry args={[0.12, 0.025, 6, 14]} />
        </mesh>
      ))}
      {cycleKind === 'gas-op-rod' && (
        <FlowLine points={[[-length / 2, 0.16, 0], [0.15, 0.16, 0], [length / 2, 0, 0]]} color={material.color} lineWidth={3} />
      )}
    </group>
  )
}

export function IsolatedInputModule({ material }: { material: MeshStandardMaterial }) {
  return (
    <>
      <RoundedBox args={[0.72, 0.48, 0.46]} radius={0.11} smoothness={3} material={material} />
      <mesh rotation={[0, Math.PI / 2, 0]} material={material}>
        <torusGeometry args={[0.14, 0.035, 7, 18]} />
      </mesh>
      <FlowLine points={[[0.38, 0.2, 0], [0.58, 0.36, 0]]} color="#e7c67b" lineWidth={2} transparent opacity={0.55} />
    </>
  )
}

export function FeedSilhouette({
  material,
  profile,
  motionRef,
}: {
  material: MeshStandardMaterial
  profile: FirearmProfile
  motionRef: RefObject<Group | null>
}) {
  const upright = profile !== 'rifle'
  return (
    <group ref={motionRef} name="abstract-feed-lift-motion">
      <RoundedBox
        args={upright ? [0.62, 1.15, 0.44] : [1.05, 0.52, 0.44]}
        rotation={[0, 0, profile === 'compact' ? 0.1 : 0]}
        radius={0.1}
        smoothness={3}
        material={material}
        castShadow
      />
      {[profile === 'rifle' ? -0.25 : -0.16, profile === 'rifle' ? 0.25 : 0.16].map((x) => (
        <mesh key={x} position={[x, upright ? 0.28 : 0.12, 0.24]} material={material}>
          <sphereGeometry args={[0.055, 9, 7]} />
        </mesh>
      ))}
    </group>
  )
}

export function ExtractionTrace({
  material,
  substituteRef,
  substituteMaterialRef,
}: {
  material: MeshStandardMaterial
  substituteRef: RefObject<Group | null>
  substituteMaterialRef: RefObject<MeshPhysicalMaterial | null>
}) {
  return (
    <>
      <FlowLine
        points={[[0.44, -0.35, 0], [0.08, -0.08, 0], [-0.42, 0.12, 0.03]]}
        color={material.color}
        lineWidth={2.5}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        transparent
        opacity={0.62}
      />
      <group ref={substituteRef} name="ivory-extraction-substitute" userData={{ classification: 'inert-position-substitute' }} visible={false}>
        <RoundedBox
          ref={disableFirearmSubstituteRaycast}
          args={[0.3, 0.16, 0.16]}
          radius={0.07}
          smoothness={3}
        >
          <meshPhysicalMaterial
            ref={substituteMaterialRef}
            color="#efe3c2"
            transparent
            opacity={0.62}
            roughness={0.28}
            transmission={0.18}
          />
        </RoundedBox>
      </group>
    </>
  )
}

export function InertRoundPath({
  projectileRef,
  projectileMaterialRef,
}: {
  projectileRef: RefObject<Group | null>
  projectileMaterialRef: RefObject<MeshPhysicalMaterial | null>
}) {
  return (
    <>
      <FlowLine
        points={[[-0.62, -0.58, 0], [-0.45, -0.16, 0], [-0.08, 0, 0], [0.72, 0, 0]]}
        color="#88ddd6"
        lineWidth={2.4}
        transparent
        opacity={0.5}
      />
      <group ref={projectileRef} name="cyan-inert-round-substitute" userData={{ classification: 'transparent-inert-substitute' }} visible={false}>
        <Capsule
          ref={disableFirearmSubstituteRaycast}
          args={[0.075, 0.25, 8, 14]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshPhysicalMaterial
            ref={projectileMaterialRef}
            color="#9ce8e1"
            transparent
            opacity={0.58}
            roughness={0.2}
            transmission={0.25}
          />
        </Capsule>
      </group>
    </>
  )
}

export function CycleIndicator({
  material,
  indicatorRef,
  energyRef,
}: {
  material: MeshStandardMaterial
  indicatorRef: RefObject<Group | null>
  energyRef: RefObject<Group | null>
}) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={material}>
        <torusGeometry args={[0.43, 0.035, 8, 32]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.43, Math.sin(angle) * 0.43, 0]} material={material}>
            <sphereGeometry args={[0.06, 9, 7]} />
          </mesh>
        )
      })}
      <group ref={indicatorRef} name="cycle-status-marker">
        <RoundedBox args={[0.38, 0.12, 0.12]} position={[0.2, 0, 0.08]} radius={0.05} smoothness={2} material={material} />
      </group>
      <group ref={energyRef} name="abstract-energy-emphasis" visible={false}>
        <FlowLine points={[[-0.3, 0, 0.12], [0.3, 0, 0.12]]} color="#f1c879" lineWidth={5} transparent opacity={0.76} />
      </group>
    </>
  )
}

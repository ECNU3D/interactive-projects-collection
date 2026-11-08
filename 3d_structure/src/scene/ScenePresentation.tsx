import {
  AccumulativeShadows,
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  RandomizedLight,
} from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  lazy,
  memo,
  Suspense,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { AdditiveBlending, BackSide, ShaderMaterial } from 'three'
import { loadOptionalSceneEffects } from './optionalSceneEffects'
import type { SceneQualityProfile } from './sceneQuality'
import {
  resolveAccumulativeShadowProps,
  type AccumulativeShadowProps,
} from './sceneShadows'
import { Selection } from './SceneSelection'

const MuseumEffects = lazy(loadOptionalSceneEffects)

export const ABSTRACT_WATER_EDUCATION_LABEL = '抽象水面、非海况模型'

export interface MuseumStageConfig {
  floorY: number
  radius: number
  label: string
  variant?: 'podium' | 'water'
}

export interface ScenePresentationProps {
  children: ReactNode
  quality: SceneQualityProfile
  reducedMotion: boolean
  shadowRevision: string
  shadowFrames?: number
  principleAnimationActive?: boolean
  stage: MuseumStageConfig
}

const DOME_VERTEX_SHADER = /* glsl */ `
  varying float vHeight;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vHeight = clamp((worldPosition.y + 8.0) / 20.0, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const DOME_FRAGMENT_SHADER = /* glsl */ `
  varying float vHeight;

  void main() {
    vec3 lower = vec3(0.015, 0.055, 0.052);
    vec3 middle = vec3(0.025, 0.105, 0.096);
    vec3 upper = vec3(0.035, 0.075, 0.083);
    vec3 color = mix(lower, middle, smoothstep(0.05, 0.55, vHeight));
    color = mix(color, upper, smoothstep(0.58, 1.0, vHeight));
    gl_FragColor = vec4(color, 1.0);
  }
`

const WATER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vWave;

  void main() {
    vec3 transformed = position;
    float waveA = sin(position.x * 1.35 + uTime * 0.48);
    float waveB = cos(position.y * 1.08 - uTime * 0.34);
    vWave = (waveA + waveB) * 0.5;
    transformed.z += vWave * 0.035;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const WATER_FRAGMENT_SHADER = /* glsl */ `
  varying float vWave;

  void main() {
    vec3 deep = vec3(0.018, 0.145, 0.14);
    vec3 glint = vec3(0.18, 0.52, 0.48);
    float highlight = smoothstep(0.28, 0.92, vWave) * 0.32;
    gl_FragColor = vec4(mix(deep, glint, highlight), 0.52);
  }
`

function MuseumLighting({ quality }: { quality: SceneQualityProfile }) {
  return (
    <>
      <ambientLight intensity={0.13} color="#d6d2bd" />
      <hemisphereLight
        intensity={0.2}
        color="#82bdb5"
        groundColor="#020b0a"
      />
      <directionalLight
        name="museum-warm-key-light"
        position={[5.5, 8.5, 6.5]}
        intensity={3.4}
        color="#f5dba2"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <spotLight
        name="museum-cool-rim-light"
        position={[-6.5, 4.2, -5.5]}
        intensity={28}
        distance={22}
        decay={2}
        angle={0.62}
        penumbra={0.86}
        color="#70c7ba"
      />
      <pointLight
        name="museum-low-fill-light"
        position={[0, -0.1, 4.8]}
        intensity={8}
        distance={13}
        decay={2}
        color="#c26d45"
      />
    </>
  )
}

function MuseumEnvironment({ quality }: { quality: SceneQualityProfile }) {
  return (
    <Environment
      frames={1}
      resolution={quality.environmentResolution}
      environmentIntensity={0.82}
    >
      <Lightformer
        name="warm-overhead-reflector"
        form="rect"
        color="#f5dba2"
        intensity={4}
        position={[0, 6, 4]}
        rotation={[-0.7, 0, 0]}
        scale={[7, 2.4, 1]}
      />
      <Lightformer
        name="cool-rim-reflector"
        form="rect"
        color="#70c7ba"
        intensity={2.3}
        position={[-5, 2, -4]}
        rotation={[0, -0.75, 0]}
        scale={[4, 5, 1]}
      />
      <Lightformer
        name="brass-floor-reflector"
        form="ring"
        color="#c98d50"
        intensity={1.2}
        position={[4, -2, 2]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={3}
      />
    </Environment>
  )
}

const DUST_POSITIONS = new Float32Array(
  Array.from({ length: 90 }, (_, index) => {
    const particle = Math.floor(index / 3)
    const axis = index % 3
    const angle = particle * 2.399963229728653
    const radius = 2.8 + ((particle * 37) % 29) * 0.22

    if (axis === 0) return Math.cos(angle) * radius
    if (axis === 1) return -0.2 + ((particle * 17) % 31) * 0.22
    return Math.sin(angle) * radius
  }),
)

function MuseumBackdrop() {
  return (
    <>
      <mesh
        name="museum-gradient-dome"
        position={[0, 1.5, 0]}
        scale={[1.35, 1, 1.35]}
      >
        <sphereGeometry args={[15, 32, 18]} />
        <shaderMaterial
          vertexShader={DOME_VERTEX_SHADER}
          fragmentShader={DOME_FRAGMENT_SHADER}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>
      <points
        name="museum-static-dust"
        frustumCulled={false}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[DUST_POSITIONS, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#f1dcae"
          size={0.025}
          transparent
          opacity={0.32}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </>
  )
}

function PodiumScaleTicks({ radius }: { radius: number }) {
  return (
    <group name="podium-scale-ticks">
      {Array.from({ length: 24 }, (_, index) => {
        const angle = (index / 24) * Math.PI * 2
        const major = index % 3 === 0

        return (
          <mesh
            key={index}
            position={[
              Math.sin(angle) * (radius - 0.09),
              0.139,
              Math.cos(angle) * (radius - 0.09),
            ]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry
              args={[major ? 0.035 : 0.018, 0.012, major ? 0.22 : 0.13]}
            />
            <meshStandardMaterial
              color="#d9ba72"
              metalness={0.82}
              roughness={0.28}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function MuseumPodium({ stage }: { stage: MuseumStageConfig }) {
  const nameplateAzimuth = 0.68
  const nameplateRadius = stage.radius - 1.05

  return (
    <group
      name="museum-circular-podium"
      position={[0, stage.floorY - 0.14, 0]}
      userData={{ exhibitLabel: stage.label }}
    >
      <mesh receiveShadow>
        <cylinderGeometry args={[stage.radius, stage.radius + 0.16, 0.28, 96]} />
        <meshStandardMaterial
          color="#071917"
          metalness={0.18}
          roughness={0.88}
        />
      </mesh>
      <mesh position={[0, 0.143, 0]} receiveShadow>
        <cylinderGeometry args={[stage.radius - 0.08, stage.radius - 0.08, 0.014, 96]} />
        <meshStandardMaterial
          color="#0d2824"
          metalness={0.12}
          roughness={0.95}
        />
      </mesh>
      <mesh
        name="podium-brass-scale-ring"
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0.154, 0]}
      >
        <torusGeometry args={[stage.radius - 0.11, 0.025, 8, 128]} />
        <meshStandardMaterial
          color="#d9ba72"
          emissive="#5a3814"
          emissiveIntensity={0.12}
          metalness={0.88}
          roughness={0.24}
        />
      </mesh>
      <PodiumScaleTicks radius={stage.radius} />
      <group
        name={`podium-nameplate-${stage.label}`}
        position={[
          Math.sin(nameplateAzimuth) * nameplateRadius,
          0.58,
          Math.cos(nameplateAzimuth) * nameplateRadius,
        ]}
        rotation={[-0.12, nameplateAzimuth, 0]}
        userData={{ label: stage.label }}
      >
        <mesh>
          <boxGeometry args={[1.9, 0.34, 0.055]} />
          <meshStandardMaterial
            color="#8f632e"
            metalness={0.86}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 0, 0.034]}>
          <planeGeometry args={[1.72, 0.19]} />
          <meshStandardMaterial
            color="#172a25"
            metalness={0.34}
            roughness={0.58}
          />
        </mesh>
        <Html
          position={[0, 0, 0.052]}
          center
          distanceFactor={11}
          pointerEvents="none"
          zIndexRange={[3, 3]}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              minWidth: '9.5rem',
              padding: '0.34rem 0.72rem 0.3rem',
              border: '1px solid rgba(217, 186, 114, 0.68)',
              borderRadius: '0.3rem',
              background:
                'linear-gradient(180deg, rgba(17, 43, 38, 0.96), rgba(5, 19, 17, 0.98))',
              boxShadow:
                '0 0.45rem 1.2rem rgba(0, 0, 0, 0.44), inset 0 1px rgba(255, 241, 203, 0.1)',
              color: '#f3dfae',
              fontFamily: 'var(--font-ui, sans-serif)',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              lineHeight: 1.25,
              textAlign: 'center',
              textShadow: '0 0 0.7rem rgba(217, 186, 114, 0.42)',
              whiteSpace: 'nowrap',
            }}
          >
            {stage.label}
          </span>
        </Html>
      </group>
    </group>
  )
}

function AbstractWaterSurface({
  active,
  floorY,
  radius,
}: {
  active: boolean
  floorY: number
  radius: number
}) {
  const materialRef = useRef<ShaderMaterial>(null)
  const invalidate = useThree((state) => state.invalidate)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  )

  useFrame((_, delta) => {
    if (!active || !materialRef.current) return

    materialRef.current.uniforms.uTime.value += Math.min(delta, 0.05)
    invalidate()
  })

  return (
    <mesh
      name={ABSTRACT_WATER_EDUCATION_LABEL}
      userData={{
        educationLabel: ABSTRACT_WATER_EDUCATION_LABEL,
        animated: active,
      }}
      position={[0, floorY + 0.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <circleGeometry args={[radius + 1.8, 96]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX_SHADER}
        fragmentShader={WATER_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

function MuseumShadows({
  quality,
  reducedMotion,
  revision,
  frames,
  continuousAnimation,
  stage,
}: {
  quality: SceneQualityProfile
  reducedMotion: boolean
  revision: string
  frames: number
  continuousAnimation: boolean
  stage: MuseumStageConfig
}) {
  const finiteFrames = reducedMotion
    ? 1
    : Math.max(1, Math.trunc(Number.isFinite(frames) ? frames : 1))

  if (quality.shadowMode === 'contact') {
    return (
      <ContactShadows
        key={revision}
        position={[0, stage.floorY + 0.012, 0]}
        opacity={0.34}
        scale={(stage.radius + 1) * 2}
        blur={2.6}
        far={8}
        resolution={quality.shadowResolution}
        color="#010806"
        frames={finiteFrames}
      />
    )
  }

  const accumulativeProps = resolveAccumulativeShadowProps({
    revision,
    requestedFrames: frames,
    reducedMotion,
    continuousAnimation,
    shadowResolution: quality.shadowResolution,
  })

  return (
    <MemoizedMuseumAccumulativeShadows
      {...accumulativeProps}
      floorY={stage.floorY}
      radius={stage.radius}
    />
  )
}

interface MuseumAccumulativeShadowsProps extends AccumulativeShadowProps {
  floorY: number
  radius: number
}

const MemoizedMuseumAccumulativeShadows = memo(
  function MuseumAccumulativeShadows({
    revision,
    frames,
    limit,
    resolution,
    randomizedLightMapSize,
    floorY,
    radius,
  }: MuseumAccumulativeShadowsProps) {
    return (
      <AccumulativeShadows
        name={`museum-accumulative-shadows-${revision}`}
        position={[0, floorY + 0.01, 0]}
        temporal
        frames={frames}
        blend={26}
        limit={limit}
        opacity={0.52}
        scale={(radius + 1) * 2}
        alphaTest={0.72}
        color="#020b09"
        colorBlend={1.4}
        resolution={resolution}
      >
        <RandomizedLight
          amount={6}
          radius={4.5}
          ambient={0.2}
          intensity={1.2}
          position={[5.5, 8.5, 6.5]}
          bias={-0.00015}
          mapSize={randomizedLightMapSize}
          size={6}
          near={0.5}
          far={30}
        />
      </AccumulativeShadows>
    )
  },
)

export function ScenePresentation({
  children,
  quality,
  reducedMotion,
  shadowRevision,
  shadowFrames = quality.shadowFrames,
  principleAnimationActive = false,
  stage,
}: ScenePresentationProps) {
  const waterActive = principleAnimationActive && !reducedMotion

  return (
    <Selection>
      <color attach="background" args={['#061917']} />
      <fog attach="fog" args={['#061917', 13, 29]} />
      <MuseumBackdrop />
      <MuseumEnvironment quality={quality} />
      <MuseumLighting quality={quality} />
      {children}
      <MuseumPodium stage={stage} />
      {stage.variant === 'water' ? (
        <AbstractWaterSurface
          active={waterActive}
          floorY={stage.floorY}
          radius={stage.radius}
        />
      ) : null}
      <MuseumShadows
        quality={quality}
        reducedMotion={reducedMotion}
        revision={shadowRevision}
        frames={shadowFrames}
        continuousAnimation={principleAnimationActive}
        stage={stage}
      />
      {quality.postprocessing ? (
        <Suspense fallback={null}>
          <MuseumEffects />
        </Suspense>
      ) : null}
    </Selection>
  )
}

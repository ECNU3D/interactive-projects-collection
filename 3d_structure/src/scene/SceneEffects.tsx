import {
  Bloom,
  EffectComposer,
  N8AO,
  Outline,
  SMAA,
  Vignette,
} from '@react-three/postprocessing'
import { useMuseumSelection } from './SceneSelection'

/** Desktop-only chain, lazy-loaded so constrained devices never fetch it. */
export default function MuseumEffects() {
  const selection = useMuseumSelection()

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={0.45}
        distanceFalloff={0.72}
        intensity={1.35}
        quality="medium"
        halfRes
        depthAwareUpsampling
      />
      <Bloom
        luminanceThreshold={1}
        luminanceSmoothing={0.12}
        intensity={0.52}
        mipmapBlur
      />
      <Outline
        selection={selection}
        pulseSpeed={0}
        edgeStrength={4.2}
        visibleEdgeColor={0xd9ba72}
        hiddenEdgeColor={0x4f9a8e}
        blur
        xRay
      />
      <SMAA />
      <Vignette eskil={false} offset={0.2} darkness={0.72} />
    </EffectComposer>
  )
}

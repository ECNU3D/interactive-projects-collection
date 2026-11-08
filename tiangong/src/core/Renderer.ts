/**
 * Renderer.ts —— 渲染器 + 后处理管线｜文档 02 §1.1 / §5.6
 *
 * WebGPURenderer 为主路径，不支持时自动回退 WebGL2 backend（降画质档）。
 * 后处理全部用 TSL 自写/官方 TSL 节点：
 *   主渲染(HDR) → GodRays(加法) → Bloom(selective, 阈值1.0) → [DOF 对话时]
 *   → Tonemap(AgX) → Vignette + 胶片颗粒 → FXAA
 */
import * as THREE from 'three/webgpu';
import { pass, screenUV, float, vec3, dot, fract, sin, time as tslTime, smoothstep } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { QualityManager } from './Quality';
import { store } from './Store';

export class Renderer {
  renderer!: InstanceType<typeof THREE.WebGPURenderer>;
  post: InstanceType<typeof THREE.RenderPipeline> | null = null;
  backend: 'webgpu' | 'webgl2' = 'webgpu';

  async init(canvasParent: HTMLElement): Promise<THREE.WebGPURenderer> {
    const renderer = new THREE.WebGPURenderer({
      antialias: false, // 用 FXAA 代替（文档 02 §1.1）
      powerPreference: 'high-performance',
      forceWebGL: false,
      requiredLimits: {},
    });
    await renderer.init();

    // backend 检测属性名随版本变动（文档 02 §11 待核实 #2）
    const be: unknown = renderer.backend;
    this.backend =
      be && typeof be === 'object' && 'isWebGPUBackend' in be && (be as { isWebGPUBackend: boolean }).isWebGPUBackend
        ? 'webgpu'
        : 'webgl2';
    store.set('backend', this.backend);

    renderer.toneMapping = THREE.AgXToneMapping; // 文档 02 §5.6：推荐 AgX，金色不发脏
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(Math.min(devicePixelRatio, QualityManager.current.pixelRatioCap));
    renderer.setSize(innerWidth, innerHeight);
    canvasParent.appendChild(renderer.domElement);
    this.renderer = renderer;
    return renderer;
  }

  /** 组装后处理链。godRayLight 保留参数位：屏幕空间 god rays 由光锥几何体承担（文档 02 §5.3 第二类） */
  buildPost(scene: THREE.Scene, camera: THREE.Camera, _godRayLight: THREE.Light | null): void {
    const q = QualityManager.current;
    const post = new THREE.RenderPipeline(this.renderer);
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chain: any = scenePassColor;

    // Selective Bloom —— 阈值 1.0，只让 HDR 超亮的自发光（金顶/法宝/灵光）溢出（文档 02 §5.6）
    if (q.bloom) {
      chain = chain.add(bloom(chain, q.tier === 'high' ? 0.35 : 0.25, 0.6, 1.0));
    }

    // Vignette（强度可调，晕动症设置 文档 02 §4.4）+ 胶片颗粒
    const vigStrength = float(store.get('settings').vignette);
    const aspect = float(innerWidth / innerHeight);
    const centered = screenUV.sub(0.5).mul(vec3(aspect, 1.0, 1.0));
    const vig = smoothstep(0.95, 0.35, centered.length()).mul(0.5).add(0.5).oneMinus().mul(vigStrength).oneMinus();
    const grain = fract(sin(dot(screenUV.add(tslTime.fract()), vec3(12.9898, 78.233, 0.0).xy)).mul(43758.5453))
      .sub(0.5)
      .mul(0.02);

    chain = chain.mul(vig).add(grain);

    // FXAA 收尾（文档 02 §5.6：无体积云 raymarch 时用 FXAA）
    post.outputNode = fxaa(chain);
    post.outputColorTransform = true;
    this.post = post;
  }

  setSize(): void {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, QualityManager.current.pixelRatioCap));
    this.renderer.setSize(innerWidth, innerHeight);
  }

  render(post: boolean, scene: THREE.Scene, camera: THREE.Camera): void {
    if (post && this.post) this.post.render();
    else this.renderer.render(scene, camera);
  }
}

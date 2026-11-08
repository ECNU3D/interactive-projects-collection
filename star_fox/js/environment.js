// environment.js — 行星地表环境（地面 / 建筑 / 构造物滚动）
import * as THREE from 'three';
import { makeGroundTexture, makeAtmoSkyTexture } from './textures.js?v=20260728';
import { buildBuilding, buildMesa, buildIceSpike, buildSearchlight } from './models.js?v=20260728';

const GROUND_Y = -26;

const ENV_CONF = {
  space:  { ground: false },
  city:   { ground: 'city',  sky: ['#2a6ac8', '#a8d4f0'], fog: [0xa8c8e8, 0.0011], structure: 'building', groundY: GROUND_Y },
  sea:    { ground: 'water', sky: ['#1a4a8a', '#87b8d8'], fog: [0x7aa8c8, 0.0013], structure: 'searchlight', groundY: GROUND_Y },
  desert: { ground: 'sand',  sky: ['#c8852a', '#f0d8a0'], fog: [0xe8c890, 0.0012], structure: 'mesa', mesaColor: '#8a5f3a', groundY: GROUND_Y },
  snow:   { ground: 'snow',  sky: ['#5a7a9a', '#d8e4f0'], fog: [0xc8d8e8, 0.0016], structure: 'ice', groundY: GROUND_Y },
  venom:  { ground: 'venom', sky: ['#2a0a08', '#8a2a10'], fog: [0x3a1208, 0.0015], structure: 'mesa', mesaColor: '#3a2018', groundY: GROUND_Y },
};

export class Environment {
  constructor(scene, kind) {
    this.scene = scene;
    this.kind = kind;
    this.conf = ENV_CONF[kind] || ENV_CONF.space;
    this.structures = [];
    this.ground = null;
    this.skyMesh = null;
    this.groundY = this.conf.groundY ?? GROUND_Y;
    if (this.conf.ground) this.buildGround();
    if (this.conf.sky) this.buildSky();
    if (this.conf.structure) this.buildStructures();
  }

  buildGround() {
    const tex = makeGroundTexture(this.conf.ground);
    const geo = new THREE.PlaneGeometry(700, 3200);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.05 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, this.groundY, -1200);
    this.scene.add(m);
    this.ground = m;
  }

  buildSky() {
    const [top, horizon] = this.conf.sky;
    const tex = makeAtmoSkyTexture(top, horizon, this.kind === 'venom' ? 12 : 40);
    this.skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    this.scene.add(this.skyMesh);
    this.scene.fog = new THREE.FogExp2(this.conf.fog[0], this.conf.fog[1]);
  }

  makeStructure() {
    const c = this.conf;
    let g;
    if (c.structure === 'building') {
      g = buildBuilding(8 + Math.random() * 10, 18 + Math.random() * 38, 8 + Math.random() * 10);
    } else if (c.structure === 'mesa') {
      g = buildMesa(c.mesaColor || '#8a5f3a', 15 + Math.random() * 30);
    } else if (c.structure === 'ice') {
      g = buildIceSpike(12 + Math.random() * 26);
    } else if (c.structure === 'searchlight') {
      g = buildSearchlight();
    }
    return g;
  }

  buildStructures() {
    // 预生成两侧构造物，滚动回收
    for (let i = 0; i < 40; i++) {
      const s = this.makeStructure();
      this.placeStructure(s, -i * 80 - 100);
      this.scene.add(s);
      this.structures.push(s);
    }
  }

  placeStructure(s, z) {
    // 两侧分布，避开中央飞行走廊
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (48 + Math.random() * 130);
    s.position.set(x, this.groundY, z - Math.random() * 40);
    s.rotation.y = Math.random() * Math.PI * 2;
  }

  update(dt, scrollSpeed, playerX) {
    // 地面纹理滚动
    if (this.ground) {
      this.ground.material.map.offset.y += scrollSpeed * dt / 110;
      // 地面跟随玩家横向微移，保持"在世界中飞行"的错觉
      this.ground.position.x = playerX * 0.85;
    }
    // 构造物滚动回收
    for (const s of this.structures) {
      s.position.z += scrollSpeed * dt;
      if (s.userData.cone) s.rotation.y += dt * 1.2; // 探照灯旋转
      if (s.position.z > 80) this.placeStructure(s, -1500 - Math.random() * 200);
    }
  }

  dispose() {
    if (this.ground) this.scene.remove(this.ground);
    if (this.skyMesh) this.scene.remove(this.skyMesh);
    for (const s of this.structures) this.scene.remove(s);
    this.structures = [];
  }
}

export { GROUND_Y };

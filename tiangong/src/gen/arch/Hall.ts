/**
 * Hall.ts —— 组装：由参数生成一整座殿｜文档 02 §3.1
 *
 * 一行代码生成一座殿：
 *   const hall = buildHall(LINGXIAO, { name: '灵霄宝殿' });
 * 输出：THREE.Group（已含全部 instancing）+ 简化碰撞体 + 门洞。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, tileColorOf, type HallSpec } from './params';
import { buildRoof, buildRidges, buildFinial, makeRoofHeightField, type RoofOptions } from './Roof';
import { buildDougong, dougongPlacements, DOUGONG_D, type DougongSteps } from './Dougong';
import { buildPodium } from './Podium';
import { balusterPostGeometry, balustradePanelGeometry, chishouGeometry, balustradePlacements } from './Balustrade';
import { columnGrid, buildColumnsAndBeams, buildWalls, doorNailGeometry, buildPlaque, type DoorHole } from './Column';
import { chiwenGeometry, ridgeBeastGeometry, immortalGeometry } from './Ridge';
import {
  glazedTileMaterial,
  giltBronzeMaterial,
  marbleMaterial,
  vermilionMaterial,
  plasterMaterial,
  interiorMaterial,
  dougongMaterial,
} from './materials';

export interface HallOptions {
  /** 匾额文字；空则不挂 */
  name?: string;
  /** 网格密度（LOD）：high=标准，low=宫殿海用 */
  detail?: 'high' | 'low';
  /** 鎏金铜殿身（灵霄宝殿照武当金殿） */
  gilt?: boolean;
}

export interface HallResult {
  group: THREE.Group;
  /** 简化碰撞体（局部 AABB） */
  colliders: THREE.Box3[];
  /** 门洞（局部坐标，碰撞时挖开） */
  doorHoles: DoorHole[];
  /** 总尺寸 */
  size: { width: number; depth: number; height: number };
  /** 台基顶面高度（玩家站立面） */
  floorY: number;
}

export function buildHall(spec: HallSpec, opts: HallOptions = {}): HallResult {
  const detail = opts.detail ?? 'high';
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];

  const grid = columnGrid(spec);
  const overhang = spec.columnHeight * 0.32;
  const roofW = grid.width + overhang * 2;
  const roofD = grid.depth + overhang * 2;

  // ── 台基 ──────────────────────────────────────────────
  const podiumW = grid.width + 6;
  const podiumD = grid.depth + 6;
  const podium = buildPodium(podiumW, podiumD, spec.podiumTiers, spec.podiumHeight);
  const podiumMesh = new THREE.Mesh(podium.geometry, marbleMaterial());
  podiumMesh.castShadow = podiumMesh.receiveShadow = true;
  group.add(podiumMesh);
  const floorY = podium.topY;

  colliders.push(
    new THREE.Box3(
      new THREE.Vector3(-podiumW / 2 - (spec.podiumTiers - 1) * 4, 0, -podiumD / 2 - (spec.podiumTiers - 1) * 4),
      new THREE.Vector3(podiumW / 2 + (spec.podiumTiers - 1) * 4, floorY, podiumD / 2 + (spec.podiumTiers - 1) * 4),
    ),
  );

  if (detail === 'high' && spec.podiumTiers > 0) {
    // 栏杆 + 螭首（顶层台基边缘）
    const topGrow = 0; // 顶层最窄
    const { posts, panels, dragons } = balustradePlacements(
      podiumW / 2 - 0.6 + topGrow,
      podiumD / 2 - 0.6 + topGrow,
      floorY,
    );
    const postMesh = new THREE.InstancedMesh(balusterPostGeometry(), marbleMaterial(), posts.length);
    posts.forEach((m, i) => postMesh.setMatrixAt(i, m));
    const panelMesh = new THREE.InstancedMesh(balustradePanelGeometry(), marbleMaterial(), panels.length);
    panels.forEach((m, i) => panelMesh.setMatrixAt(i, m));
    const dragonMesh = new THREE.InstancedMesh(chishouGeometry(), marbleMaterial(), dragons.length);
    dragons.forEach((m, i) => dragonMesh.setMatrixAt(i, m));
    group.add(postMesh, panelMesh, dragonMesh);
  }

  // ── 柱网 + 额枋 + 墙 + 门 ──────────────────────────────
  const columnR = Math.min(0.55, spec.bayWidth * 0.08);
  const { columns, beams, beamTopY } = buildColumnsAndBeams(grid, spec.columnHeight, columnR);
  const columnMat = opts.gilt ? giltBronzeMaterial() : vermilionMaterial();
  const colMesh = new THREE.Mesh(columns, columnMat);
  colMesh.position.y = floorY;
  const beamMesh = new THREE.Mesh(beams, opts.gilt ? giltBronzeMaterial() : dougongMaterial());
  beamMesh.position.y = floorY;
  group.add(colMesh, beamMesh);

  const { walls, doors, holes, nailMatrices } = buildWalls(grid, spec.columnHeight, spec);
  const wallMesh = new THREE.Mesh(walls, opts.gilt ? giltBronzeMaterial() : plasterMaterial());
  wallMesh.position.y = floorY;
  const doorMesh = new THREE.Mesh(doors, vermilionMaterial());
  doorMesh.position.y = floorY;
  group.add(wallMesh, doorMesh);
  if (nailMatrices.length) {
    const nailMesh = new THREE.InstancedMesh(doorNailGeometry(), giltBronzeMaterial(), nailMatrices.length);
    nailMatrices.forEach((m, i) => {
      const mm = m.clone();
      mm.elements[13] += floorY;
      nailMesh.setMatrixAt(i, mm);
    });
    group.add(nailMesh);
  }

  // 殿内深色内衬（开门可见的"深不见底"）
  const innerBox = new THREE.Mesh(
    new THREE.BoxGeometry(grid.width - 1, spec.columnHeight, grid.depth - 1),
    interiorMaterial(),
  );
  innerBox.position.y = floorY + spec.columnHeight / 2;
  group.add(innerBox);

  // 墙体碰撞（门洞挖开：用左右两段近似）
  for (const hole of holes) {
    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(-grid.width / 2, floorY, grid.depth / 2 - 0.6),
        new THREE.Vector3(hole.x - hole.width / 2, floorY + spec.columnHeight, grid.depth / 2 + 0.6),
      ),
      new THREE.Box3(
        new THREE.Vector3(hole.x + hole.width / 2, floorY, grid.depth / 2 - 0.6),
        new THREE.Vector3(grid.width / 2, floorY + spec.columnHeight, grid.depth / 2 + 0.6),
      ),
    );
  }
  colliders.push(
    new THREE.Box3(
      new THREE.Vector3(-grid.width / 2, floorY, -grid.depth / 2 - 0.6),
      new THREE.Vector3(grid.width / 2, floorY + spec.columnHeight, -grid.depth / 2 + 0.6),
    ),
    new THREE.Box3(
      new THREE.Vector3(-grid.width / 2 - 0.6, floorY, -grid.depth / 2),
      new THREE.Vector3(-grid.width / 2 + 0.6, floorY + spec.columnHeight, grid.depth / 2),
    ),
    new THREE.Box3(
      new THREE.Vector3(grid.width / 2 - 0.6, floorY, -grid.depth / 2),
      new THREE.Vector3(grid.width / 2 + 0.6, floorY + spec.columnHeight, grid.depth / 2),
    ),
  );

  // ── 斗拱 ──────────────────────────────────────────────
  const steps = Math.min(spec.dougongSteps, 9) as DougongSteps;
  const eaveY = floorY + beamTopY + ((steps + 1) / 2) * 3.2 * DOUGONG_D + 4 * DOUGONG_D;
  if (detail === 'high') {
    const placements = dougongPlacements(
      grid.width / 2,
      grid.depth / 2,
      eaveY,
      Math.round(6 + steps / 2), // 明代：密而小，每间 6–8 攒
      DOUGONG_D,
      steps,
    );
    const byType = new Map<string, THREE.Matrix4[]>();
    for (const p of placements) {
      const arr = byType.get(p.type) ?? [];
      arr.push(p.m);
      byType.set(p.type, arr);
    }
    for (const [type, mats] of byType) {
      const geo = buildDougong(steps, type as DougongSteps extends never ? never : 'pingshen' | 'zhutou' | 'jiao', DOUGONG_D);
      const im = new THREE.InstancedMesh(geo, dougongMaterial(), mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      group.add(im);
    }
  }

  // ── 屋顶（含重檐） ────────────────────────────────────
  const tileColor = tileColorOf(spec);
  const jianbian = spec.tileColor === 'huang-lv-jianbian';
  const seg = detail === 'high' ? { segX: 40, segZ: 24 } : { segX: 14, segZ: 8 };
  let curY = eaveY;
  let curW = roofW;
  let curD = roofD;
  const roofGeos: {
    geo: THREE.BufferGeometry;
    y: number;
    ridgeY: number;
    ridgeHeight: number;
    ridgeHalfLen: number;
    spanHalf: number;
    opts: RoofOptions;
  }[] = [];

  for (let e = 0; e < spec.eaves; e++) {
    const isTop = e === spec.eaves - 1;
    const roofOpts: RoofOptions = {
      width: curW,
      depth: curD,
      type: isTop ? spec.roof : 'wudian',
      purlins: spec.purlins ?? 9,
      jianbian,
      tileColor,
      ...seg,
      ...(isTop ? {} : { ringInner: { width: grid.width * 0.96, depth: grid.depth * 0.96 } }),
    };
    const roof = buildRoof(roofOpts);
    roofGeos.push({
      geo: roof.geometry,
      y: curY,
      ridgeY: curY + roof.ridgeHeight,
      ridgeHeight: roof.ridgeHeight,
      ridgeHalfLen: roof.ridgeHalfLen,
      spanHalf: roof.spanHalf,
      opts: roofOpts,
    });

    // 屋脊
    if (detail === 'high' || isTop) {
      const field = makeRoofHeightField(roofOpts);
      const ridgeGeos = buildRidges(roofOpts, field, detail === 'high' ? 0.32 : 0.5);
      for (const rg of ridgeGeos) {
        const rm = new THREE.Mesh(rg, glazedTileMaterial(jianbian ? PALETTE.liuliLv : tileColor, false));
        rm.position.y = curY;
        group.add(rm);
      }
    }

    // 下一层檐：墙体收进、标高抬升
    if (!isTop) {
      curY += roof.ridgeHeight * 0.72;
      curW = Math.max(curW - overhang * 0.9, grid.width * 1.02);
      curD = Math.max(curD - overhang * 0.9, grid.depth * 1.02);
      // 上层墙身收进
      const insetWall = new THREE.Mesh(
        new THREE.BoxGeometry(curW - overhang * 0.9, roof.ridgeHeight * 0.72, curD - overhang * 0.9),
        opts.gilt ? giltBronzeMaterial() : plasterMaterial(),
      );
      insetWall.position.y = eaveY + (roof.ridgeHeight * 0.72) / 2 - 0.2;
      group.add(insetWall);
    }
  }

  const topRoof = roofGeos[roofGeos.length - 1];
  const roofMesh = new THREE.Mesh(topRoof.geo, glazedTileMaterial(tileColor));
  roofMesh.position.y = topRoof.y;
  roofMesh.castShadow = true;
  group.add(roofMesh);
  for (let i = 0; i < roofGeos.length - 1; i++) {
    const r = roofGeos[i];
    const m = new THREE.Mesh(r.geo, glazedTileMaterial(tileColor));
    m.position.y = r.y;
    group.add(m);
  }

  // ── 正吻 + 脊兽 ───────────────────────────────────────
  if (detail === 'high') {
    const ridgeMat = glazedTileMaterial(jianbian ? PALETTE.liuliLv : tileColor, false);
    if (topRoof.ridgeHalfLen > 0.05) {
      const cw = chiwenGeometry(topRoof.ridgeHeight * 0.16 + 1.2);
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(cw, ridgeMat);
        m.position.set(s * topRoof.ridgeHalfLen, topRoof.ridgeY - 0.4, 0);
        m.rotation.y = s > 0 ? Math.PI : 0;
        group.add(m);
      }
    }
    // 脊兽：四条垂脊近檐角处一列
    const nBeasts = spec.ridgeBeasts;
    if (nBeasts > 0) {
      const field = makeRoofHeightField(topRoof.opts);
      const beastGeo = ridgeBeastGeometry(1);
      const total = nBeasts * 4 + 4;
      const im = new THREE.InstancedMesh(beastGeo, ridgeMat, total);
      const imm = immortalGeometry(1);
      const imXian = new THREE.InstancedMesh(imm, ridgeMat, 4);
      let idx = 0;
      let xIdx = 0;
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          q.setFromEuler(new THREE.Euler(0, Math.atan2(sx, sz), 0));
          for (let b = 0; b < nBeasts; b++) {
            const t = 0.82 + (b / Math.max(nBeasts - 1, 1)) * 0.1;
            const x = sx * topRoof.opts.width * 0.5 * t;
            const z = sz * topRoof.opts.depth * 0.5 * t;
            const y = topRoof.y + field.heightAt(x, z) + 0.3;
            m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
            im.setMatrixAt(idx++, m4);
          }
          // 骑凤仙人在最前（更靠檐角）
          const tx = sx * topRoof.opts.width * 0.5 * 0.95;
          const tz = sz * topRoof.opts.depth * 0.5 * 0.95;
          m4.compose(
            new THREE.Vector3(tx, topRoof.y + field.heightAt(tx, tz) + 0.3, tz),
            q,
            new THREE.Vector3(1, 1, 1),
          );
          imXian.setMatrixAt(xIdx++, m4);
        }
      }
      im.count = idx;
      group.add(im, imXian);
    }
  }

  // ── 宝顶（攒尖 / 灵霄金葫芦收头） ──────────────────────
  let topY = topRoof.ridgeY;
  if (spec.finial) {
    const scale = Math.max(1, topRoof.ridgeHeight * 0.14);
    const finial = new THREE.Mesh(buildFinial(spec.finial, scale), giltBronzeMaterial(1.2));
    finial.position.set(0, topRoof.ridgeY, 0);
    group.add(finial);
    topY += 4.6 * scale;
  }

  // ── 匾额 ──────────────────────────────────────────────
  if (opts.name && detail === 'high') {
    const plaque = buildPlaque(opts.name, Math.min(6, spec.bayWidth * 0.8));
    plaque.position.set(0, floorY + spec.columnHeight + 0.6, grid.depth / 2 + 0.9);
    group.add(plaque);
  }

  const height = topY;
  return {
    group,
    colliders,
    doorHoles: holes,
    size: { width: roofW, depth: roofD, height },
    floorY,
  };
}

/** 文档 02 §3.5：灵霄宝殿定式 */
export const LINGXIAO: HallSpec = {
  bays: 9,
  depths: 5,
  bayWidth: 8.0,
  columnHeight: 14,
  podiumTiers: 3,
  podiumHeight: 8.13, // 故宫三台实测
  roof: 'wudian',
  eaves: 3, // 原文"三檐四簇"
  finial: 'jinhulu', // 原文"大金葫芦顶"
  dougongSteps: 9,
  ridgeBeasts: 10, // 全场唯一 10 兽 + 骑凤仙人
  tileColor: 'huang',
  doorNails: [9, 9], // 原文"金钉攒玉户"
};

export { mergeGeometries };

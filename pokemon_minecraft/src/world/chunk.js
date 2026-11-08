// Chunk 网格生成（设计文档 §2）：16×16×48，只生成暴露面，合并 BufferGeometry
// 依赖全局 THREE；每 chunk 三个网格：不透明(Lambert 顶点色)/发光(Basic)/水面(半透明)
import { WORLD_SIZE, CHUNK, WATER_LEVEL, MAX_Y, idx, columnColors, hash2 } from './terrain.js';

const FACES = [
  { n: [ 1, 0, 0], v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
  { n: [-1, 0, 0], v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
  { n: [0,  1, 0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0, -1, 0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0,  1], v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { n: [0, 0, -1], v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
];

function key(x, y, z) { return x + '|' + y + '|' + z; }

// 颜色抖动（每列确定性微差，消除纯平感）
function jitter(hex, f, out) {
  const r = Math.min(255, ((hex >> 16) & 255) * f) / 255;
  const g = Math.min(255, ((hex >> 8) & 255) * f) / 255;
  const b = Math.min(255, (hex & 255) * f) / 255;
  out[0] = r; out[1] = g; out[2] = b;
}

export class ChunkMesher {
  constructor(world) { this.world = world; }

  // 占用查询：地形或 overlay 方块
  occ(x, y, z) {
    const w = this.world;
    if (y < 0) return true;
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return false;
    if (y <= w.effH(x, z)) return true;
    return w.overlay.has(key(x, y, z));
  }

  build(cx, cz) {
    const w = this.world;
    const pos = [], nor = [], col = [], ids = [];
    const gPos = [], gNor = [], gCol = [], gIds = [];
    const wPos = [], wNor = [], wIds = [];
    const rgb = [0, 0, 0];

    const emitFace = (arr, x, y, z, f, colorArr) => {
      const base = arr.p.length / 3;
      for (const cv of f.v) {
        arr.p.push(x + cv[0], y + cv[1], z + cv[2]);
        arr.n.push(f.n[0], f.n[1], f.n[2]);
        if (colorArr) arr.c.push(colorArr[0], colorArr[1], colorArr[2]);
      }
      arr.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const A = { p: pos, n: nor, c: col, i: ids };
    const G = { p: gPos, n: gNor, c: gCol, i: gIds };
    const W = { p: wPos, n: wNor, c: null, i: wIds };

    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) continue;
        const i = idx(x, z);
        const h = w.effH(x, z);
        const colors = columnColors(w.terrain, x, z);
        const topOv = w.topOverride.get(i);
        const jf = 0.92 + hash2(x, z, 3) * 0.16;

        // 侧面只从最低邻列开始生成
        let minN = h;
        if (x > 0) minN = Math.min(minN, w.effH(x - 1, z));
        if (x < WORLD_SIZE - 1) minN = Math.min(minN, w.effH(x + 1, z));
        if (z > 0) minN = Math.min(minN, w.effH(x, z - 1));
        if (z < WORLD_SIZE - 1) minN = Math.min(minN, w.effH(x, z + 1));
        const yStart = Math.max(0, minN - 1);

        for (let y = yStart; y <= h; y++) {
          for (const f of FACES) {
            if (this.occ(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
            const isTop = f.n[1] === 1;
            let hex = isTop ? colors.top : colors.side;
            if (isTop && y !== h) hex = colors.side;       // 被更高列挡住的不是顶面
            if (isTop && y === h && topOv !== undefined) hex = topOv;
            jitter(hex, jf * (isTop ? 1 : 0.88), rgb);
            emitFace(colors.glow ? G : A, x, y, z, f, rgb);
          }
        }

        // 水面（顶面+底面，水下仰视也可见）
        const th = w.terrain.groundH[i];
        if (th < WATER_LEVEL && w.terrain.biome[i] !== 4) {   // 雪山为冰面，不渲染水面
          for (const f of [FACES[2], FACES[3]]) {
            const base = wPos.length / 3;
            for (const cv of f.v) {
              wPos.push(x + cv[0], WATER_LEVEL + cv[1], z + cv[2]);
              wNor.push(f.n[0], f.n[1], f.n[2]);
            }
            wIds.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    // overlay 方块（树/建筑/装饰）
    const blocks = w.chunkBlocks.get(cx + ',' + cz);
    if (blocks) {
      for (const b of blocks) {
        for (const f of FACES) {
          if (this.occ(b.x + f.n[0], b.y + f.n[1], b.z + f.n[2])) continue;
          jitter(b.c, 0.94 + hash2(b.x, b.z, b.y) * 0.12, rgb);
          emitFace(b.glow ? G : A, b.x, b.y, b.z, f, rgb);
        }
      }
    }

    const group = new THREE.Group();
    if (ids.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(ids);
      const m = new THREE.Mesh(g, ChunkMesher.opaqueMat);
      m.receiveShadow = true;
      group.add(m);
    }
    if (gIds.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(gNor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(gCol, 3));
      g.setIndex(gIds);
      group.add(new THREE.Mesh(g, ChunkMesher.glowMat));
    }
    if (wIds.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(wNor, 3));
      g.setIndex(wIds);
      group.add(new THREE.Mesh(g, ChunkMesher.waterMat));
    }
    group.userData.chunk = [cx, cz];
    return group;
  }
}

ChunkMesher.opaqueMat = new THREE.MeshLambertMaterial({ vertexColors: true });
ChunkMesher.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
ChunkMesher.waterMat = new THREE.MeshLambertMaterial({
  color: 0x3A76C9, transparent: true, opacity: 0.65,
});

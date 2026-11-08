// 行走栅格：NPC 用它判断脚下能不能走。
// 原先 NPC 只判了「是不是水」，没判碰撞盒，于是丫鬟婆子会直接穿墙、穿台基、穿进屋里。
// 碰撞盒按 NPC 半径膨胀后栅格化一次，之后每帧只是一次数组查表。
import { colliders, platforms, walkHeight, groundHeight } from './layout.js';

const CELL = 1.5;
const NPC_R = 0.55;
const X0 = -210, X1 = 210, Z0 = -880, Z1 = 50;
const NX = Math.ceil((X1 - X0) / CELL);
const NZ = Math.ceil((Z1 - Z0) / CELL);

let OK = null;          // Uint8Array：1 = 可走
let H = null;           // Float32Array：地面高程（不可走处为 NaN）

// 碰撞盒的分桶索引：栅格只有 1.5m，挡不住亚格精度的贴墙；
// 走完一步再按玩家那样精确推出去，才不会半个身子插进墙里。
const BK = 14;
let BUCKETS = null, PBUCKETS = null, BX0 = 0, BZ0 = 0, BNX = 0, BNZ = 0;

function bucketize(list, pad) {
  const out = Array.from({ length: BNX * BNZ }, () => []);
  for (let k = 0; k < list.length; k++) {
    const b = list[k];
    const i0 = Math.max(0, Math.floor((b.x0 - pad - BX0) / BK));
    const i1 = Math.min(BNX - 1, Math.floor((b.x1 + pad - BX0) / BK));
    const j0 = Math.max(0, Math.floor((b.z0 - pad - BZ0) / BK));
    const j1 = Math.min(BNZ - 1, Math.floor((b.z1 + pad - BZ0) / BK));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out[j * BNX + i].push(b);
  }
  return out;
}

function buildBuckets() {
  BX0 = X0; BZ0 = Z0;
  BNX = Math.ceil((X1 - X0) / BK); BNZ = Math.ceil((Z1 - Z0) / BK);
  BUCKETS = bucketize(colliders, 0.8);
  // 台基只登记为「可行走高度」，不是碰撞盒；站在台明脚下的人会被那道 0.85m 的
  // 石壁穿身而过。故另建一份台基索引，按立面把人推开（斜坡踏跺没有立面，跳过）。
  PBUCKETS = bucketize(platforms.filter((p) => !p.ramp), 0.8);
}

function pushOut(list, x, z, r) {
  for (let k = 0; k < list.length; k++) {
    const b = list[k];
    if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
      const dxl = x - (b.x0 - r), dxr = (b.x1 + r) - x;
      const dzl = z - (b.z0 - r), dzr = (b.z1 + r) - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = b.x0 - r;
      else if (m === dxr) x = b.x1 + r;
      else if (m === dzl) z = b.z0 - r;
      else z = b.z1 + r;
    }
  }
  return [x, z];
}

/** 把点推出碰撞盒与高出自己的台基立面（与玩家的处理一致，只是先按分桶缩小候选） */
export function navResolve(x, z, r = 0.5) {
  if (!BUCKETS) return [x, z];
  const i = Math.floor((x - BX0) / BK), j = Math.floor((z - BZ0) / BK);
  if (i < 0 || j < 0 || i >= BNX || j >= BNZ) return [x, z];
  [x, z] = pushOut(BUCKETS[j * BNX + i], x, z, r);
  // 只推「比自己高出一截」的台基；站在台基上的人不受影响
  const my = navH(x, z);
  const raised = PBUCKETS[j * BNX + i].filter((p) => p.h > my + 0.3);
  if (raised.length) [x, z] = pushOut(raised, x, z, r);
  return [x, z];
}

const ix = (x) => Math.floor((x - X0) / CELL);
const iz = (z) => Math.floor((z - Z0) / CELL);
const cx = (i) => X0 + (i + 0.5) * CELL;
const cz = (j) => Z0 + (j + 0.5) * CELL;

export function buildNav() {
  if (OK) return;
  buildBuckets();
  OK = new Uint8Array(NX * NZ);
  H = new Float32Array(NX * NZ).fill(NaN);
  for (let j = 0; j < NZ; j++) {
    const z = cz(j);
    for (let i = 0; i < NX; i++) {
      const h = walkHeight(cx(i), z);
      if (h !== null) { OK[j * NX + i] = 1; H[j * NX + i] = h; }
    }
  }
  // 碰撞盒（按 NPC 半径膨胀）挖掉
  for (let k = 0; k < colliders.length; k++) {
    const b = colliders[k];
    const i0 = Math.max(0, ix(b.x0 - NPC_R)), i1 = Math.min(NX - 1, ix(b.x1 + NPC_R));
    const j0 = Math.max(0, iz(b.z0 - NPC_R)), j1 = Math.min(NZ - 1, iz(b.z1 + NPC_R));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const px = cx(i), pz = cz(j);
        if (px > b.x0 - NPC_R && px < b.x1 + NPC_R && pz > b.z0 - NPC_R && pz < b.z1 + NPC_R) {
          OK[j * NX + i] = 0;
        }
      }
    }
  }
}

/** 该点能不能站人 */
export function navOk(x, z) {
  if (!OK) return walkHeight(x, z) !== null;
  const i = ix(x), j = iz(z);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return false;
  return OK[j * NX + i] === 1;
}

/** 该点地面高程；不可走处回落到地形高度 */
export function navH(x, z) {
  if (!OK) return walkHeight(x, z) ?? groundHeight(x, z);
  const i = ix(x), j = iz(z);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return groundHeight(x, z);
  const h = H[j * NX + i];
  return Number.isNaN(h) ? groundHeight(x, z) : h;
}

/** 由 a 走到 b 是否合法：目标可走，且高差在一步之内 */
export function navStep(ax, az, bx, bz, maxRise = 0.6) {
  if (!navOk(bx, bz)) return false;
  return Math.abs(navH(bx, bz) - navH(ax, az)) <= maxRise;
}

/** 就近找一个能站人的点；找不到返回 null */
export function navSnap(x, z, maxR = 9) {
  if (navOk(x, z)) return [x, z];
  for (let r = CELL; r <= maxR; r += CELL) {
    for (let a = 0; a < 12; a++) {
      const t = a * Math.PI / 6;
      const px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r;
      if (navOk(px, pz)) return [px, pz];
    }
  }
  return null;
}

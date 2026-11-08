// 自写 AABB 体素碰撞 + 重力（设计文档 §2）
// 实体: { pos: THREE.Vector3(脚底中心), vel, half(半宽), height, onGround }
const EPS = 0.001;

export function aabbCollides(world, px, py, pz, half, height) {
  const x1 = Math.floor(px - half), x2 = Math.floor(px + half - EPS);
  const y1 = Math.floor(py), y2 = Math.floor(py + height - EPS);
  const z1 = Math.floor(pz - half), z2 = Math.floor(pz + half - EPS);
  for (let x = x1; x <= x2; x++)
    for (let y = y1; y <= y2; y++)
      for (let z = z1; z <= z2; z++)
        if (world.solidAt(x, y, z)) return true;
  return false;
}

// 单轴移动 + 碰撞截断；返回是否撞上
function moveAxis(world, e, axis, delta) {
  if (delta === 0) return false;
  const p = e.pos;
  const nx = p.x + (axis === 'x' ? delta : 0);
  const ny = p.y + (axis === 'y' ? delta : 0);
  const nz = p.z + (axis === 'z' ? delta : 0);
  if (!aabbCollides(world, nx, ny, nz, e.half, e.height)) {
    p.x = nx; p.y = ny; p.z = nz;
    return false;
  }
  // 二分逼近碰撞点
  let lo = 0, hi = delta;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const tx = p.x + (axis === 'x' ? mid : 0);
    const ty = p.y + (axis === 'y' ? mid : 0);
    const tz = p.z + (axis === 'z' ? mid : 0);
    if (!aabbCollides(world, tx, ty, tz, e.half, e.height)) lo = mid; else hi = mid;
  }
  p.x += (axis === 'x' ? lo : 0);
  p.y += (axis === 'y' ? lo : 0);
  p.z += (axis === 'z' ? lo : 0);
  return true;
}

const GRAVITY = 24;

export function moveEntity(world, e, dt, { stepUp = true } = {}) {
  // 水平
  const hitX = moveAxis(world, e, 'x', e.vel.x * dt);
  const hitZ = moveAxis(world, e, 'z', e.vel.z * dt);
  // 自动上台阶（地形高度差 1 格）
  if ((hitX || hitZ) && stepUp && e.onGround) {
    const p = e.pos;
    const oy = p.y;
    if (!aabbCollides(world, p.x, oy + 1.02, p.z, e.half, e.height)) {
      p.y = oy + 1.02;
      // 落回地面
      moveAxis(world, e, 'y', -1.05);
    }
  }
  // 垂直
  e.vel.y -= GRAVITY * dt;
  if (e.vel.y < -30) e.vel.y = -30;
  const hitY = moveAxis(world, e, 'y', e.vel.y * dt);
  if (hitY) {
    if (e.vel.y < 0) e.onGround = true;
    e.vel.y = 0;
  } else {
    e.onGround = false;
  }
  return { hitX, hitZ, hitY };
}

// 直接落地吸附（出生/传送后）
export function snapToGround(world, e, maxDrop = 20) {
  for (let i = 0; i < maxDrop * 2; i++) {
    if (aabbCollides(world, e.pos.x, e.pos.y - 0.5, e.pos.z, e.half, e.height)) {
      e.pos.y = Math.floor(e.pos.y - 0.5) + 1;
      e.onGround = true;
      return;
    }
    e.pos.y -= 0.5;
  }
}

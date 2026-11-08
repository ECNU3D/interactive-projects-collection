// 体素 → 只生成暴露面的合并网格（Minecraft 地形同款做法，表面无缝，每只模型 1 次 draw call）
// 依赖全局 THREE（r128, assets/lib/three.min.js）
const FACES = [
  {n:[ 1,0,0], v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]]},
  {n:[-1,0,0], v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]},
  {n:[0, 1,0], v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
  {n:[0,-1,0], v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
  {n:[0,0, 1], v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]},
  {n:[0,0,-1], v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]},
];

export function buildVoxelMesh(vox) {
  const list = vox.list();
  const has = (x,y,z) => vox.has(x,y,z);
  const pos=[], nor=[], col=[], idx=[];
  const c = new THREE.Color();
  for (const vx of list) {
    c.setHex(vx.c);
    for (const f of FACES) {
      if (has(vx.x+f.n[0], vx.y+f.n[1], vx.z+f.n[2])) continue;
      const base = pos.length/3;
      for (const cv of f.v) {
        pos.push(vx.x-0.5+cv[0], vx.y+cv[1], vx.z-0.5+cv[2]);
        nor.push(f.n[0], f.n[1], f.n[2]);
        col.push(c.r, c.g, c.b);
      }
      idx.push(base, base+1, base+2, base, base+2, base+3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors:true }));
  mesh.castShadow = true;
  return mesh;
}

// 网格缓存：同种模型只构建一次，clone 复用（geometry 共享，material 独立以便受击闪白）
const cache = new Map();
export function meshFromVox(key, vox, scale = 1/8) {
  if (!cache.has(key)) cache.set(key, buildVoxelMesh(vox));
  const src = cache.get(key);
  const mesh = new THREE.Mesh(src.geometry, src.material.clone());
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(scale);
  return group;
}

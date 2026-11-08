// ============================================================
// 水泊梁山 · 世界构建
// 地形 = 解析高度场（与行走碰撞共用同一函数）
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePlaqueTexture, makeFlagTexture } from './portrait.js';

export const COLORS = {
  wood:0x6e4a2f, woodDark:0x4a3018, stone:0x8a8578, stoneDark:0x5f5a4e,
  roof:0x39434c, roofRed:0x6e2f26, plaster:0xd8cfb8, gold:0xc9a03a,
  earth:0x9c7c4e
};

// ---------------- 确定性随机 ----------------
function rng(seed){let a=seed;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R = rng(20260816);

function smoothstep(a,b,x){ x=Math.min(1,Math.max(0,(x-a)/(b-a))); return x*x*(3-2*x); }
function gauss(x, s){ return Math.exp(-(x*x)/(2*s*s)); }

// ---------------- 地形参数 ----------------
const PLATEAU_H = 40, PLATEAU_R = 85;
export const WATER_Y = 0.35;   // 水面高度（湖床下沉后，泊内为真水体）
// 南路山道折线（山脚→宛子城）
const ROAD = [ [0,258],[34,206],[-30,150],[16,104],[0,82],[0,58] ];
let roadCum=[0]; for(let i=1;i<ROAD.length;i++){const dx=ROAD[i][0]-ROAD[i-1][0],dz=ROAD[i][1]-ROAD[i-1][1];roadCum.push(roadCum[i-1]+Math.hypot(dx,dz));}
const ROAD_LEN = roadCum[roadCum.length-1];

// 李家道口小岛
const ISLET = { x:-60, z:472, r:48 };

function islandField(x,z){
  // 各向异性海岸线：南阔（山下官道客店）、北窄（金沙滩紧邻断崖水泊）
  const d = Math.hypot(x, z-30);
  const th = Math.atan2(z-30, x);
  const coast = 205 + 72*Math.sin(th) + 16*Math.sin(th*3+2.1) + 8*Math.sin(th*7);
  return 1 - smoothstep(coast-42, coast+58, d);
}

// 建筑台地：先于其上立屋，把地基所在处地形抹平（高度取台地中心原始基高）
const PADS = [
  {x:52,z:-62,r:10},    // 断金亭（原在平顶山肩，半悬于坡）
  {x:120,z:205,r:16}, {x:175,z:95,r:15}, {x:-175,z:95,r:15}, {x:-46,z:-36,r:15}, // 四旱寨
  {x:66,z:258,r:15},    // 山下客店
  {x:96,z:282,r:11},    // 铁匠铺
  {x:55,z:-84,r:12},    // 船坞
  {x:-8,z:-96,r:13}, {x:158,z:-45,r:13}, {x:-200,z:138,r:13}, // 三处水寨寨区
  {x:-60,z:472,r:20},   // 李家道口酒店
];
function getHeightBase(x,z){
  // 周边远丘
  let h = 0;
  const isl = islandField(x,z);
  h += 14 * isl;
  h += 9 * gauss(Math.hypot(x-120,z-160),95);
  h += 11 * gauss(Math.hypot(x+140,z+40),110);
  h += 7 * gauss(Math.hypot(x-60,z-180),85);
  // 蓼儿洼浅滩
  const marsh = 1.6 * gauss(Math.hypot(x-240,z-(-200)),130) + 1.2*gauss(Math.hypot(x-300,z+60),90);
  h += marsh;
  // 李家道口岛
  h += 12 * gauss(Math.hypot(x-ISLET.x, z-ISLET.z), ISLET.r*.55);
  // 主山
  const d0 = Math.hypot(x,z);
  h = Math.max(h, PLATEAU_H * smoothstep(PLATEAU_R+26, PLATEAU_R-14, d0));
  // 南路山道
  const rd = roadInfo(x,z);
  if(rd && rd.t!==null){
    const rh = PLATEAU_H * rd.t;
    const w = 1 - smoothstep(7, 26, rd.dist);
    h = h*(1-w) + Math.max(h, rh)*w;
  }
  // 湖床下沉：离岛岸线愈远水愈深（蓼儿洼保留浅滩泽地）
  h -= 5.2 * smoothstep(.12, .8, 1-isl) * (1 - Math.min(1, marsh/1.2)*.8);
  return h;
}
// 台地目标高度 = 中心点基高（初始化时算一次，避免递推）
for(const p of PADS) p.h = getHeightBase(p.x, p.z);
export function getHeight(x,z){
  let h = getHeightBase(x,z);
  for(const p of PADS){
    const d = Math.hypot(x-p.x, z-p.z);
    if(d < p.r){ const w = 1 - smoothstep(p.r*.55, p.r, d); h = h*(1-w) + p.h*w; }
  }
  return h;
}
export function roadInfo(x,z){
  let best=null;
  for(let i=1;i<ROAD.length;i++){
    const [ax,az]=ROAD[i-1], [bx,bz]=ROAD[i];
    const abx=bx-ax, abz=bz-az, len2=abx*abx+abz*abz;
    let t=((x-ax)*abx+(z-az)*abz)/len2; t=Math.max(0,Math.min(1,t));
    const px=ax+abx*t, pz=az+abz*t, d=Math.hypot(x-px,z-pz);
    if(!best||d<best.dist) best={dist:d, t:(roadCum[i-1]+t*(roadCum[i]-roadCum[i-1]))/ROAD_LEN};
  }
  return best;
}

// ---------------- 材质 ----------------
const M = {};
function initMaterials(){
  M.wood = new THREE.MeshStandardMaterial({color:COLORS.wood, roughness:.85});
  M.woodDark = new THREE.MeshStandardMaterial({color:COLORS.woodDark, roughness:.9});
  M.stone = new THREE.MeshStandardMaterial({color:COLORS.stone, roughness:.95});
  M.stoneDark = new THREE.MeshStandardMaterial({color:COLORS.stoneDark, roughness:.95});
  M.roof = new THREE.MeshStandardMaterial({color:COLORS.roof, roughness:.8, map:tileTex()});
  M.roofRed = new THREE.MeshStandardMaterial({color:COLORS.roofRed, roughness:.75, map:tileTex()});
  M.plaster = new THREE.MeshStandardMaterial({color:COLORS.plaster, roughness:.9});
  M.gold = new THREE.MeshStandardMaterial({color:COLORS.gold, roughness:.4, metalness:.6});
  M.thatch = new THREE.MeshStandardMaterial({color:0x8f7a3a, roughness:1});
  M.earth = new THREE.MeshStandardMaterial({color:COLORS.earth, roughness:1});
  M.lacquer = new THREE.MeshStandardMaterial({color:0x8a3226, roughness:.6}); // 朱漆柱
  M.trim = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.82}); // 合并构件（斗拱/脊/柱础）
}
const _roofMats={};
function roofMat(color){ // 带瓦垄纹理的屋顶材质（按颜色缓存）
  if(!_roofMats[color]) _roofMats[color]=new THREE.MeshStandardMaterial({color, roughness:.8, map:tileTex()});
  return _roofMats[color];
}
let _tileTex=null;
function tileTex(){ // 瓦垄纹理（灰阶，与材质色相乘）：叠瓦扇面+瓦垄线
  if(_tileTex) return _tileTex;
  const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const c=cv.getContext('2d');
  c.fillStyle='#b4b4b4'; c.fillRect(0,0,256,256);
  const R=16; // 扇面半径
  for(let j=0;j*R*.9<256+R;j++){
    const y=j*R*.9, off=(j%2)*R;
    for(let i=-1;i*2*R<256+2*R;i++){
      const x=i*2*R+off;
      c.strokeStyle='rgba(40,40,40,.5)'; c.lineWidth=3.5;
      c.beginPath(); c.arc(x,y,R,Math.PI*1.08,Math.PI*1.92); c.stroke(); // ∩ 叠瓦
      c.strokeStyle='rgba(255,255,255,.35)'; c.lineWidth=2;
      c.beginPath(); c.arc(x,y+3,R*.82,Math.PI*1.15,Math.PI*1.85); c.stroke(); // 受光边
    }
  }
  for(let i=0;i<8;i++){ // 纵向瓦垄高光
    c.strokeStyle='rgba(255,255,255,.12)'; c.lineWidth=5;
    c.beginPath(); c.moveTo(i*32+16,0); c.lineTo(i*32+16,256); c.stroke();
  }
  _tileTex=new THREE.CanvasTexture(cv);
  _tileTex.wrapS=_tileTex.wrapT=THREE.RepeatWrapping;
  _tileTex.anisotropy=4;
  return _tileTex;
}

// ---------------- 工具 ----------------
const colliders = [];
export function addCollider(x,z,r){ colliders.push({x,z,r}); }
// 可走板面（栈道/平台）：adaptToTerrain 落定后写入世界坐标 AABB，game.js floorAt 合并查询
export const DECK_FLOORS=[];
// 局部碰撞收集（place() 时变换为世界坐标）
function col(g,x,z,r){ (g.userData.cols=g.userData.cols||[]).push([x,z,r]); }
function attach(g,sub){ g.add(sub); if(sub.userData.cols) for(const [lx,lz,r] of sub.userData.cols) (g.userData.cols=g.userData.cols||[]).push([lx+sub.position.x, lz+sub.position.z, r]); }
function box(w,h,d,mat){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.castShadow=true; m.receiveShadow=true; return m; }
function cyl(rt,rb,h,mat,seg=10){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.castShadow=true; m.receiveShadow=true; return m; }

// 曲面歇山顶：正脊分段、举折凹面、翼角起翘（仿《营造法式》屋面曲线）
function curvedRoof(w,d,h,lift,mat){
  const N=22, pos=[], idx=[], uv=[];
  const rx=Math.max(0,(w-d)/2), rz=Math.max(0,(d-w)/2); // 正脊半长（沿较长轴）
  const xR=Math.max(w/2-rx,.001), zR=Math.max(d/2-rz,.001);
  const yAt=(x,z)=>{ // 屋面高度场（局部坐标）
    const du=Math.min(1,Math.max(0,Math.abs(x)-rx)/xR);
    const dv=Math.min(1,Math.max(0,Math.abs(z)-rz)/zR);
    const m=Math.max(du,dv);
    let y=h*Math.pow(1-m,1.5);                 // 举折：近脊陡、近檐缓
    y+=lift*1.2*Math.pow(du*dv,2)*Math.pow(m,2.2); // 翼角起翘（仅四角）
    y-=Math.pow(m,6)*h*.18;                    // 檐口微沉
    return y;
  };
  for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){
    const u=i/N*2-1, v=j/N*2-1, x=u*w/2, z=v*d/2;
    pos.push(x, yAt(x,z), z);
    uv.push(x/1.15, z/1.15);                    // 瓦垄纹理按米重复
  }
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const a=i*(N+1)+j, b=a+N+1;
    idx.push(a,b,a+1, b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mat); mesh.castShadow=true; mesh.receiveShadow=true;
  mesh.userData.roof={w,d,h,lift,rx,rz,yAt};
  return mesh;
}
// 合并构件构建器：所有装饰件上顶点色，合成 1 个 mesh（1 次 draw call）
function paintGeo(geo,color){
  const n=geo.attributes.position.count, c=new THREE.Color(color), arr=new Float32Array(n*3);
  for(let i=0;i<n;i++){ arr[i*3]=c.r; arr[i*3+1]=c.g; arr[i*3+2]=c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr,3));
  return geo;
}
function trimBuilder(){
  const geos=[];
  return {
    box(w,h,d,x,y,z,color,ry=0){
      const g=new THREE.BoxGeometry(w,h,d);
      if(ry) g.rotateY(ry);
      g.translate(x,y,z); geos.push(paintGeo(g,color));
    },
    geo(g,color){ geos.push(paintGeo(g,color)); },
    build(){
      if(!geos.length) return null;
      const m=new THREE.Mesh(mergeGeometries(geos),M.trim);
      m.castShadow=m.receiveShadow=true; return m;
    }
  };
}
// 斗拱环：沿檐下四周布置一斗三升（合并）
function dougongRing(w,d,y,color=COLORS.woodDark,step=2.6){
  const t=trimBuilder();
  const xs=[], zs=[];
  for(let x=-w/2+1;x<=w/2-1+.01;x+=step) xs.push(x);
  if(xs.length&&(w/2-1)-xs[xs.length-1]>.8) xs.push(w/2-1);
  for(let z=-d/2+1;z<=d/2-1+.01;z+=step) zs.push(z);
  if(zs.length&&(d/2-1)-zs[zs.length-1]>.8) zs.push(d/2-1);
  // 一组斗拱：坐斗+横拱+两升（横拱沿所在边方向）
  const putEdge=(x,z,alongX)=>{
    t.box(.3,.2,.3, x,y+.1,z, color);
    if(alongX){
      t.box(.86,.16,.26, x,y+.26,z, color);
      t.box(.13,.13,.13, x-.3,y+.4,z, color); t.box(.13,.13,.13, x+.3,y+.4,z, color);
    }else{
      t.box(.26,.16,.86, x,y+.26,z, color);
      t.box(.13,.13,.13, x,y+.4,z-.3, color); t.box(.13,.13,.13, x,y+.4,z+.3, color);
    }
  };
  xs.forEach(x=>{ putEdge(x, d/2-.25, true); putEdge(x, -(d/2-.25), true); });
  zs.forEach(z=>{ putEdge(w/2-.25, z, false); putEdge(-(w/2-.25), z, false); });
  return t.build();
}
// 垂脊：自正脊两端沿屋面戗脊线至翼角的四道脊（含角尖上翘），合并为 1 mesh
function hipRidges(roofMesh,color=COLORS.woodDark){
  const {w,d,h,rx,rz,yAt}=roofMesh.userData.roof;
  const t=trimBuilder();
  const ends=rx>0?[[rx,0],[-rx,0]]:(rz>0?[[0,rz],[0,-rz]]:[[0,0]]);
  const r=Math.max(.1,Math.min(w,d)*.016);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{
    ends.forEach(([ex,ez])=>{
      const pts=[];
      for(let k=0;k<=10;k++){
        const tt=k/10;
        const x=sx*(ex+tt*(w/2-Math.abs(ex))), z=sz*(ez+tt*(d/2-Math.abs(ez)));
        pts.push(new THREE.Vector3(x, yAt(x,z)+r*.7, z));
      }
      const curve=new THREE.CatmullRomCurve3(pts);
      t.geo(new THREE.TubeGeometry(curve,12,r,5), color);
    });
    // 角尖套兽（上翘小锥）
    const cx=sx*w/2, cz=sz*d/2, cy=yAt(cx,cz);
    const tip=new THREE.ConeGeometry(r*1.6,r*5,5);
    tip.rotateX(sz*.9); tip.rotateZ(-sx*.9);
    tip.translate(cx+sx*r*.8, cy+r*1.8, cz+sz*r*.8);
    t.geo(tip, color);
  });
  return t.build();
}
function ridgeDeco(len,mat){ // 正脊+鸱吻（吻兽外张）
  const g=new THREE.Group();
  const r=box(len, .6, .75, mat); r.position.y=.25; g.add(r);
  [-1,1].forEach(sx=>{
    const e=box(.8,1.5,.8,mat); e.position.set(sx*len/2,.85,0); g.add(e);
    const horn=box(.34,.9,.34,mat); horn.position.set(sx*(len/2+.18),1.6,0); horn.rotation.z=-sx*.55; g.add(horn);
  });
  return g;
}
// 柱础（鼓形石础）+朱漆廊柱
function porchColumn(x,z,h,t){
  t.box(.62,.3,.62, x,.15,z, COLORS.stone);          // 覆盆柱础
  t.geo(new THREE.CylinderGeometry(.26,.3,h,10).translate(x,.3+h/2,z), 0x8a3226); // 朱漆柱
}
function column(x,z,h,r=.28){
  const c=cyl(r,r*1.12,h,M.woodDark); c.position.set(x,h/2,z); return c;
}
function plaque(text,w=6,h=1.5){
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:makePlaqueTexture(text)}));
  return p;
}
function bannerPole(text,bg,fg,h=7){
  const g=new THREE.Group();
  const pole=cyl(.09,.11,h,M.woodDark); pole.position.y=h/2; g.add(pole);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(2.6,3.4,1,6),
    new THREE.MeshStandardMaterial({map:makeFlagTexture(text,bg,fg),side:THREE.DoubleSide,roughness:.9}));
  flag.position.set(1.35,h-2.1,0); g.add(flag);
  g.userData.flag=flag;
  return g;
}
function lantern(x,y,z,scale=1){
  const l=new THREE.Mesh(new THREE.SphereGeometry(.32*scale,8,8),
    new THREE.MeshStandardMaterial({color:0xff9a3c, emissive:0xff8a28, emissiveIntensity:3.2}));
  l.position.set(x,y,z);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(), color:0xffa040, transparent:true, opacity:.55, depthWrite:false}));
  glow.scale.setScalar(2.6*scale); glow.position.copy(l.position);
  const g=new THREE.Group(); g.add(l,glow); return g;
}
let _glowTex=null;
function glowTex(){
  if(_glowTex) return _glowTex;
  const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const c=cv.getContext('2d');
  const g=c.createRadialGradient(32,32,2,32,32,30);
  g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(.4,'rgba(255,220,150,.35)'); g.addColorStop(1,'rgba(255,200,120,0)');
  c.fillStyle=g; c.fillRect(0,0,64,64);
  _glowTex=new THREE.CanvasTexture(cv); return _glowTex;
}

// ---------------- 建筑 ----------------
function makeHall(){ // 忠义堂
  const g=new THREE.Group();
  // 台基
  const base=box(46,2.4,30,M.stone); base.position.y=1.2; g.add(base);
  const steps=box(14,1.2,4,M.stone); steps.position.set(0,.6,17); g.add(steps);
  // 廊柱
  for(let i=-4;i<=4;i++){
    g.add(Object.assign(column(i*5,12.5,7.4),{}));
  }
  [-18.5,18.5].forEach(x=>{ [-6,0,6].forEach(z=>{ const c=column(x,z,7.4); g.add(c); }); });
  // 墙体（后墙+侧墙，前敞）
  const back=box(44,7,1,M.plaster); back.position.set(0,3.5+2.4,-12); g.add(back);
  const wl=box(1,7,24,M.plaster); wl.position.set(-20,5.9,0); g.add(wl);
  const wr=wl.clone(); wr.position.x=20; g.add(wr);
  // 门楣+匾额
  const lint=box(42,.8,1.4,M.wood); lint.position.set(0,8.6,12.2); g.add(lint);
  const pq=plaque('忠义堂',9,2.2); pq.position.set(0,9.6,13.05); g.add(pq);
  // 柱础 + 檐下斗拱环
  const ht=trimBuilder();
  for(let i=-4;i<=4;i++) ht.box(.7,.35,.7, i*5, 2.57, 12.5, COLORS.stone);
  [-18.5,18.5].forEach(x=>{ [-6,0,6].forEach(z=>{ ht.box(.7,.35,.7, x, 2.57, z, COLORS.stone); }); });
  const htm=ht.build(); if(htm) g.add(htm);
  const dg1=dougongRing(43,28,8.72); if(dg1) g.add(dg1);
  // 双层屋顶
  const r1=curvedRoof(52,34,4.6,2.6,M.roofRed); r1.position.y=9.4; g.add(r1);
  const hr1=hipRidges(r1); if(hr1){ hr1.position.y=9.4; g.add(hr1); }
  const rd1=ridgeDeco(52-34+2.6,M.woodDark); rd1.position.y=14; g.add(rd1);
  const dg2=dougongRing(30,20,11.98); if(dg2) g.add(dg2);
  const r2=curvedRoof(30,20,3.6,2,M.roofRed); r2.position.y=12.6; g.add(r2);
  const hr2=hipRidges(r2); if(hr2){ hr2.position.y=12.6; g.add(hr2); }
  const rd2=ridgeDeco(30-20+2.2,M.woodDark); rd2.position.y=16.2; g.add(rd2);
  // 内部：主位两把交椅 + 两列座位 + 香案
  const throneL=chair(1.4); throneL.position.set(-3,2.4,-9); throneL.rotation.y=Math.PI; g.add(throneL);
  const throneR=chair(1.4); throneR.position.set(3,2.4,-9); throneR.rotation.y=Math.PI; g.add(throneR);
  const incense=cyl(.9,1.1,1.4,M.gold); incense.position.set(0,3.1,-7); g.add(incense);
  for(let rIdx=0;rIdx<2;rIdx++) for(let sIdx=-4;sIdx<=4;sIdx++){
    if(Math.abs(sIdx)<1) continue;
    const ch=chair(.9); ch.position.set(sIdx*4.4, 2.4, rIdx? -1.5:-5.2);
    ch.rotation.y=Math.PI; g.add(ch);
  }
  // 灯笼
  [[-19,9,12],[19,9,12]].forEach(p=>{ const l=lantern(...p,1.2); g.add(l); });
  col(g,-21,0,3.2); col(g,21,0,3.2);
  return g;
}
function chair(s=1){
  const g=new THREE.Group();
  const seat=box(1.5*s,.25,1.4*s,M.woodDark); seat.position.y=.9*s; g.add(seat);
  const back=box(1.5*s,1.6*s,.2,M.woodDark); back.position.set(0,1.7*s,-.6*s); g.add(back);
  [[-.6,-.55],[.6,-.55],[-.6,.55],[.6,.55]].forEach(([x,z])=>{
    const leg=box(.16*s,.9*s,.16*s,M.woodDark); leg.position.set(x,.45*s,z); g.add(leg);
  });
  return g;
}
function makePavilion(label){ // 断金亭（八角亭）
  const g=new THREE.Group();
  const base=cyl(5.6,6,.8,M.stone,8); base.position.y=.4; g.add(base);
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    g.add(column(Math.cos(a)*4.6, Math.sin(a)*4.6, 4.6,.22));
  }
  const roof=curvedRoof(12.5,12.5,3,2.2,M.roof); roof.position.y=4.8; g.add(roof);
  const hp=hipRidges(roof); if(hp){ hp.position.y=4.8; g.add(hp); }
  const dg=dougongRing(9.4,9.4,4.55); if(dg) g.add(dg);
  const finial=cyl(.25,.4,1.4,M.gold); finial.position.y=8.2; g.add(finial);
  const pq=plaque(label,4,1.1); pq.position.set(0,3.9,5.15); g.add(pq);
  // 石栏
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    const rail=box(.22,.7,.22,M.stone); rail.position.set(Math.cos(a)*5.5,.35+ .8,Math.sin(a)*5.5); g.add(rail);
  }
  const l=lantern(0,3.4,0,1); g.add(l);
  col(g,0,0,4.2);
  return g;
}
function makeGate(label, opts={}){ // 关隘（横跨山道）
  const g=new THREE.Group();
  const w=opts.w||22, tower=opts.tower!==false;
  // 两侧石壁
  const gt=trimBuilder();
  [-1,1].forEach(s=>{
    const wallB=box(7,13.5,7,M.stoneDark); wallB.position.set(s*(w/2+3.5),2.25,0); g.add(wallB); // 墙基下沉，适应坡地
    col(g,s*(w/2+3.5),0,5.6);
    for(let k=-1;k<=1;k++) gt.box(.95,.85,.95, s*(w/2+3.5)+k*2.3, 9.42, 0, COLORS.stone); // 垛口
    gt.box(7.6,.5,7.6, s*(w/2+3.5), 9.05, 0, COLORS.stoneDark); // 墙顶压檐
  });
  const gtm=gt.build(); if(gtm) g.add(gtm);
  const lintel=box(w+4,2.2,3,M.stoneDark); lintel.position.set(0,9.2,0); g.add(lintel);
  // 门扉
  [-1,1].forEach(s=>{
    const door=box(w/4-0.2,7.4,.5,M.woodDark); door.position.set(s*w/4,3.7,.4); g.add(door);
    door.userData.open=true; door.rotation.y=s*.5; door.position.x+= s*1.2; door.position.z+=1.2; // 半开
  });
  const pq=plaque(label,5,1.3); pq.position.set(0,9.2,1.7); g.add(pq);
  if(tower){
    const tw=makeHouse({w:8,d:6,roof:COLORS.roof,label:null});
    tw.position.set(0,10.2,0); g.add(tw);
    const b1=bannerPole('梁','#3a4d63','#e8d9ae',9); b1.position.set(-w/2-3,9,2); g.add(b1);
    const b2=bannerPole('宋','#3a4d63','#e8d9ae',9); b2.position.set(w/2+3,9,2); g.add(b2);
  }
  g.add(lantern(-w/2,6,2.2,.9)); g.add(lantern(w/2,6,2.2,.9));
  return g;
}
function makeHouse({w=10,d=8,h=3.4,roof=COLORS.roof,label=null,plaster=true,twoTier=false}){
  const g=new THREE.Group();
  const bodyW=w, bodyD=d;
  const wallMat=plaster?M.plaster:M.wood;
  const body=box(bodyW,h,bodyD,wallMat); body.position.y=h/2; g.add(body);
  const t=trimBuilder();
  t.box(bodyW+.3,.5,bodyD+.3, 0,h-.25,0, COLORS.woodDark);   // 檐枋木框
  t.box(bodyW+.9,.56,bodyD+.9, 0,.28,0, COLORS.stoneDark);   // 台基
  t.box(bodyW*.5,.24,1.2, 0,.12,bodyD/2+.9, COLORS.stoneDark); // 门前踏跺
  // 前后檐廊柱（朱漆+鼓形柱础）
  const nx=Math.max(2,Math.round(bodyW/3));
  for(let i=0;i<nx;i++){
    const x=nx===1?0:-bodyW/2+.5+i*(bodyW-1)/(nx-1);
    porchColumn(x, bodyD/2+.16, h-.92, t);
    porchColumn(x, -(bodyD/2+.16), h-.92, t);
  }
  const trim=t.build(); if(trim) g.add(trim);
  // 檐下斗拱环
  const dg=dougongRing(bodyW+1.2, bodyD+1.2, h-.62); if(dg) g.add(dg);
  // 格扇门 + 槛窗（合并为 1 mesh）
  const lat=[];
  lat.push(new THREE.PlaneGeometry(1.7,2.3).translate(0,1.45,bodyD/2+.07));
  lat.push(new THREE.PlaneGeometry(1.5,1.15).translate(-bodyW/4,1.8,bodyD/2+.07));
  lat.push(new THREE.PlaneGeometry(1.5,1.15).translate(bodyW/4,1.8,bodyD/2+.07));
  lat.push(new THREE.PlaneGeometry(1.5,1.15).rotateY(Math.PI/2).translate(bodyW/2+.07,1.8,0));
  lat.push(new THREE.PlaneGeometry(1.5,1.15).rotateY(-Math.PI/2).translate(-bodyW/2-.07,1.8,0));
  const latMesh=new THREE.Mesh(mergeGeometries(lat), latticeMat()); g.add(latMesh);
  // 歇山顶 + 垂脊 + 正脊鸱吻
  const roofMesh=curvedRoof(bodyW+3.6,bodyD+3.6,2.4,1.4,roofMat(roof));
  roofMesh.position.y=h; g.add(roofMesh);
  const hr=hipRidges(roofMesh); if(hr){ hr.position.y=h; g.add(hr); }
  const rd=ridgeDeco(Math.abs(bodyW-bodyD)+2.2, M.woodDark);
  if(bodyW<bodyD) rd.rotation.y=Math.PI/2;
  rd.position.y=h+2.35; g.add(rd);
  if(twoTier){
    const uW=bodyW*.66, uD=bodyD*.66;
    const upper=box(uW,2.6,uD,wallMat); upper.position.y=h+1.3; g.add(upper);
    const dg2=dougongRing(uW+1, uD+1, h+2.02); if(dg2) g.add(dg2);
    const roof2=curvedRoof(uW+3,uD+3,2,1.2,roofMat(roof));
    roof2.position.y=h+2.6; g.add(roof2);
    const hr2=hipRidges(roof2); if(hr2){ hr2.position.y=h+2.6; g.add(hr2); }
    const rd2=ridgeDeco(Math.abs(uW-uD)+2, M.woodDark);
    if(uW<uD) rd2.rotation.y=Math.PI/2;
    rd2.position.y=h+4.55; g.add(rd2);
  }
  if(label){ const pq=plaque(label,Math.min(bodyW*.8,7),1.4); pq.position.set(0,h*.72,bodyD/2+.2); g.add(pq); }
  col(g,0,0,Math.max(bodyW,bodyD)*.55);
  return g;
}
function makeWallRing(radius, height, gaps){ // 宛子城城墙
  const g=new THREE.Group();
  const N=28;
  for(let i=0;i<N;i++){
    const a0=i/N*Math.PI*2, a1=(i+1)/N*Math.PI*2;
    const mid=(a0+a1)/2;
    // 城门豁口
    if(gaps.some(([gx,gz,gr])=>{const wx=Math.cos(mid)*radius, wz=Math.sin(mid)*radius; return Math.hypot(wx-gx,wz-gz)<gr;})) continue;
    const len=radius*(a1-a0);
    const seg=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,6,1,true,a0+.008,a1-a0-.016),M.stone);
    seg.material=M.stone; seg.material.side=THREE.DoubleSide;
    seg.position.y=height/2; seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
    // 垛口
    const merlon=box(1.2,.9,1.2,M.stone); merlon.position.set(Math.cos(mid)*radius,height+.45,Math.sin(mid)*radius); g.add(merlon);
    const wx=Math.cos(mid)*radius, wz=Math.sin(mid)*radius;
    addCollider(wx,wz,(a1-a0)*radius*.55);
    void len;
  }
  return g;
}
function makeDock(label, boats=3){ // 水寨码头
  const g=new THREE.Group();
  // 栈桥板：先按原状排布，place() 后由 adaptToTerrain 顺岸坡降至水面、打桩、入水即收
  for(let i=0;i*3.4<78;i++){
    const plank=box(5,.35,3,M.wood); plank.position.set(0,.9,-i*3.4); g.add(plank);
    plank.userData.adapt='deck'; plank.userData.i=i;
    plank.userData.rise=.75; plank.userData.overWater=.95; plank.userData.postX=2;
    plank.userData.hw=2.5; plank.userData.hd=1.5;
  }
  // 栈道不设碰撞：板面已写入 DECK_FLOORS，可一路走到水边
  // 水亭（朱贵式）
  const pav=makePavilion('望湖亭'); pav.scale.setScalar(.62); pav.position.set(-7,0,4);
  pav.userData.adapt='seat'; pav.userData.skirtR=4.2; attach(g,pav);
  // 寨旗
  const bp=bannerPole('水军','#274a52','#e8d9ae',11); bp.position.set(6,0,-2); g.add(bp);
  // 营棚
  const hut=makeHouse({w:9,d:7,roof:COLORS.roof,label:null}); hut.position.set(9,0,6); hut.rotation.y=-.5;
  hut.userData.adapt='seat'; hut.userData.sink=-.3; hut.userData.skirt=[10,8]; attach(g,hut);
  g.add(lantern(-2.4,2.4,-1,.8));
  if(label){ const st=stoneSign(label); st.position.set(7,0,10); st.userData.adapt='seat'; st.userData.sink=-.4; g.add(st); }
  void boats;
  return g;
}
// 独立泊船（贴水面，挂世界坐标）
function scatterBoats(sceneRef, animated, x,z,rotY,count){
  const fx=-Math.sin(rotY), fz=-Math.cos(rotY); // 前向
  const rx=Math.cos(rotY), rz=-Math.sin(rotY);  // 侧向
  for(let i=0;i<count;i++){
    const b=makeBoat();
    let along=42+R()*22+i*11, side=(R()-.5)*26;
    // 泊船须泊于水中：太浅则继续向外推
    for(let k=0;k<8 && getHeight(x+fx*along+rx*side, z+fz*along+rz*side)>WATER_Y-.5;k++) along+=14;
    if(getHeight(x+fx*along+rx*side, z+fz*along+rz*side)>WATER_Y-.4) continue;
    b.position.set(x+fx*along+rx*side, WATER_Y, z+fz*along+rz*side);
    b.rotation.y=rotY+Math.PI+(R()-.5)*.8;
    sceneRef.add(b);
    animated.push({obj:b, fn:(t)=>{ b.position.y=WATER_Y+Math.sin(t*.8+b.userData.bobOff)*.16; }});
  }
}
export function makeBoat(){
  const g=new THREE.Group();
  const hull=box(2.2,.9,7.2,M.woodDark); hull.position.y=.45; g.add(hull);
  const prow=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.4,4),M.woodDark);
  prow.rotation.x=Math.PI/2; prow.rotation.z=Math.PI/4; prow.scale.set(1,1,.45); prow.position.set(0,.5,4.4); g.add(prow);
  const stern=prow.clone(); stern.rotation.x=-Math.PI/2; stern.position.z=-4.4; g.add(stern);
  const canopy=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,3.2,10,1,false,0,Math.PI),M.thatch);
  canopy.rotation.z=Math.PI/2; canopy.rotation.y=Math.PI/2; canopy.position.y=1.35; g.add(canopy);
  const mast=cyl(.07,.09,4.6,M.woodDark); mast.position.set(0,2.8,-1.6); g.add(mast);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(.8,.7), new THREE.MeshStandardMaterial({color:0xc9a23a,side:THREE.DoubleSide}));
  fl.position.set(.42,4.4,-1.6); g.add(fl);
  g.userData.bobOff=R()*6;
  return g;
}
function stoneSign(text){
  const g=new THREE.Group();
  const st=box(2.6,2.2,.5,M.stoneDark); st.position.y=1.1; g.add(st);
  const pq=plaque(text,2.3,.9); pq.position.set(0,1.25,.28); g.add(pq);
  return g;
}
function makeFlagStand(){ // 替天行道旗台
  const g=new THREE.Group();
  const base=cyl(3.4,4,1,M.stone,8); base.position.y=.5; g.add(base);
  const pole=cyl(.28,.36,20,M.woodDark); pole.position.y=10; g.add(pole);
  const flagTex=makeFlagTexture('替天行道','#c9a23a','#8a1f14');
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(8,10,12,12),
    new THREE.MeshStandardMaterial({map:flagTex,side:THREE.DoubleSide,roughness:.9}));
  flag.position.set(4.2,14,0); g.add(flag);
  g.userData.waveFlag=flag;
  // 石碣
  const tablet=box(2.2,3.4,.8,M.stoneDark); tablet.position.set(-8,1.7,-2); tablet.rotation.y=.4; g.add(tablet);
  const glyphCv=document.createElement('canvas'); glyphCv.width=glyphCv.height=128;
  const gc=glyphCv.getContext('2d'); gc.fillStyle='rgba(200,190,160,.8)'; gc.font='12px serif';
  for(let i=0;i<10;i++)for(let j=0;j<6;j++){ gc.fillText(['ᛝ','宀','彳','灬','乚','卩','弓','忄'][i+j&7], 8+j*20, 14+i*12); }
  const gt=new THREE.CanvasTexture(glyphCv);
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.8), new THREE.MeshBasicMaterial({map:gt,transparent:true}));
  gl.position.set(-8,1.7,-1.55); gl.rotation.y=.4; g.add(gl);
  col(g,-8,-2,1.8);
  return g;
}
function makeTraining(){
  const g=new THREE.Group();
  const ground=cyl(16,16,.4,M.earth,24); ground.position.y=.2; g.add(ground);
  // 兵器架
  [[-8,0],[8,0]].forEach(([x],i)=>{
    const rack=new THREE.Group();
    const post1=box(.3,3,.3,M.wood); post1.position.set(-2.2,1.5,0); rack.add(post1);
    const post2=box(.3,3,.3,M.wood); post2.position.set(2.2,1.5,0); rack.add(post2);
    const bar=box(4.8,.25,.25,M.woodDark); bar.position.y=2.4; rack.add(bar);
    for(let k=-2;k<=2;k++){
      const spear=cyl(.06,.06,4.4,M.woodDark); spear.position.set(k*1.05,3.6,0); spear.rotation.z=(R()-.5)*.16; rack.add(spear);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.12,.5,4),M.stone); tip.position.set(k*1.05-(R()-.5), 6, 0); rack.add(tip);
    }
    rack.position.set(x,0,i?8:-8); rack.rotation.y=i?Math.PI:0; g.add(rack);
    col(g,x,i?8:-8,2.6);
  });
  // 箭靶
  [[0,-12],[5,-13]].forEach(([x,z])=>{
    const t=cyl(.9,.9,.3,new THREE.MeshStandardMaterial({color:0xa08a5a}),12);
    t.rotation.x=Math.PI/2; t.position.set(x,1.6,z); g.add(t);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.4,.08,6,16),new THREE.MeshStandardMaterial({color:0x8a2f22}));
    ring.position.set(x,1.6,z+.2); g.add(ring);
  });
  return g;
}
function makeStable(){
  const g=new THREE.Group();
  const shed=makeHouse({w:12,d:8,roof:0x6e5a30,label:null,plaster:false}); shed.position.set(-4,0,0); g.add(shed);
  for(let i=0;i<7;i++){ // 围栏
    const f=box(.25,1.2,.25,M.wood); f.position.set(-12+i*2.6,.6,7); g.add(f);
  }
  const rail=box(16,.2,.2,M.wood); rail.position.set(-4,1.1,7); g.add(rail);
  const trough=box(4,.6,1,M.woodDark); trough.position.set(2,.3,5); g.add(trough);
  for(let i=0;i<3;i++){ const hay=cyl(1,1.2,1.6,M.thatch,7); hay.position.set(6+i*2,.8,2+i); g.add(hay); }
  return g;
}
function makeGranary(){
  const g=new THREE.Group();
  [[-5,0],[5,0]].forEach(([x,z])=>{
    const body=cyl(3.6,3.6,4,M.wood,10); body.position.set(x,2,z); g.add(body);
    const roofM=new THREE.Mesh(new THREE.ConeGeometry(4.6,2.6,10),M.thatch); roofM.position.set(x,5.2,z); g.add(roofM);
    col(g,x,z,4.2);
  });
  for(let i=0;i<8;i++){ const f=box(.25,1.2,.25,M.wood); f.position.set(-10+i*2.9,.6,6); g.add(f); }
  const rail=box(23,.2,.2,M.wood); rail.position.set(0,1.1,6); g.add(rail);
  return g;
}
function makeClinic(){
  const g=makeHouse({w:11,d:9,h:3.8,roof:COLORS.roof,label:'医馆'});
  const bp=bannerPole('药','#2f5d3f','#e8d9ae',7); bp.position.set(6.5,0,3); g.add(bp);
  return g;
}
function makeForge(){
  const g=new THREE.Group();
  const shed=makeHouse({w:10,d:8,roof:0x4a3a2a,label:null,plaster:false}); g.add(shed);
  const anvil=box(1.2,.8,.6,M.stoneDark); anvil.position.set(3,.4,5); g.add(anvil);
  const forge=box(2,1.4,2,M.stoneDark); forge.position.set(-3.5,.7,5); g.add(forge);
  const fire=new THREE.Mesh(new THREE.SphereGeometry(.5,8,8), new THREE.MeshStandardMaterial({color:0xff6a20,emissive:0xff4400,emissiveIntensity:5}));
  fire.position.set(-3.5,1.7,5); g.add(fire);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xff8830,transparent:true,opacity:.7,depthWrite:false}));
  glow.scale.setScalar(6); glow.position.set(-3.5,2,5); g.add(glow);
  g.userData.fire=fire; g.userData.glow=glow;
  return g;
}
function makeShipyard(){
  const g=new THREE.Group();
  // 龙骨
  const keel=box(1,1,16,M.woodDark); keel.position.set(0,.5,0); keel.rotation.z=.06; g.add(keel);
  for(let i=-2;i<=2;i++){ const rib=cyl(.16,.16,3.4,M.wood); rib.rotation.z=Math.PI/2; rib.position.set(0,1.7,i*3.2); g.add(rib); }
  // 木料
  for(let i=0;i<4;i++){ const log=cyl(.4,.4,8,M.wood); log.rotation.z=Math.PI/2; log.position.set(8,0.4+i*.7,4+R()*3); g.add(log); }
  const shed=makeHouse({w:8,d:6,roof:0x5a4a30,label:null}); shed.position.set(-8,0,-6); g.add(shed);
  return g;
}
function makeTavern(label){ // 酒店（李家道口）
  const g=new THREE.Group();
  const house=makeHouse({w:12,d:10,h:4,twoTier:true,roof:0x5a3a2a,label}); attach(g,house);
  const bp=bannerPole('酒','#8a2f22','#e8d9ae',8); bp.position.set(7,0,5); g.add(bp);
  // 水亭码头（延伸至岛缘水面；place() 后由 adaptToTerrain 顺坡降阶、打桩、亭落石矶）
  for(let i=0;i<11;i++){
    const plank=box(3,.3,2.4,M.wood); plank.position.set(-9,.8,-4-i*2.6); g.add(plank);
    plank.userData.adapt='deck'; plank.userData.i=i;
    plank.userData.rise=.35; plank.userData.overWater=.8; plank.userData.postX=1.1;
    plank.userData.hw=1.5; plank.userData.hd=1.2;
  }
  const pav=makePavilion('水浒亭'); pav.scale.setScalar(.5); pav.position.set(-9,0,-33.5);
  pav.userData.adapt='pavilion'; attach(g,pav);
  g.add(lantern(-5,2.6,5.4,.9));
  return g;
}
function makeInn(label){ // 山下客店
  const g=new THREE.Group();
  const house=makeHouse({w:16,d:12,h:4.4,twoTier:true,roof:0x6e3a26,label}); attach(g,house);
  const bp=bannerPole('客','#6e5a2e','#1c1a14',8); bp.position.set(9,0,7); g.add(bp);
  const bp2=bannerPole('酒','#8a2f22','#e8d9ae',7); bp2.position.set(-9,0,7); g.add(bp2);
  for(let i=0;i<10;i++){ const f=box(.25,1.3,.25,M.wood); f.position.set(-11+i*2.5,.65,12); g.add(f); }
  const rail=box(24,.2,.2,M.wood); rail.position.set(0,1.2,12); g.add(rail);
  g.add(lantern(0,3.2,6.6,1.1));
  return g;
}
function makeFishingHut(){ // 蓼儿洼渔棚
  const g=new THREE.Group();
  [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]].forEach(([x,z])=>{
    const p=cyl(.18,.2,4.4,M.woodDark); p.position.set(x,1.2,z); g.add(p);
  });
  const hut=makeHouse({w:4.5,d:4.5,h:2.8,roof:0x7a6a3a,label:null}); hut.position.y=3.2; g.add(hut);
  const raft=box(3,.35,2.4,M.woodDark); raft.position.set(4,.4,3); g.add(raft);
  g.userData.raftY=.4;
  return g;
}
// ---------------- 临水建筑自适应 ----------------
// place() 之后调用：把带 userData.adapt 标记的子件落到真实地形/水面
//  seat     坐于所在点地面（可配 skirtR/skirt[w,d] 石基裙，坡地不露底）
//  deck     栈道板：顺岸坡逐级下降，入水后找平，板下打桩至湖床，入深水即截断余板
//  pavilion 水亭：台面与栈道末块平齐，下起石矶平台
function adaptToTerrain(g){
  const kids=g.children.filter(o=>o.userData.adapt);
  if(!kids.length) return;
  const rot=g.rotation.y, s=Math.sin(rot), c=Math.cos(rot), gy=g.position.y;
  const wxOf=o=>g.position.x + o.position.x*c + o.position.z*s;
  const wzOf=o=>g.position.z - o.position.x*s + o.position.z*c;
  function skirtUnder(o, seatY, wx, wz){ // 石基裙：自坐面下插到地面/湖床以下
    let r, boxSZ=null;
    if(o.userData.skirt){ boxSZ=o.userData.skirt; r=Math.max(boxSZ[0],boxSZ[1])/2; }
    else if(o.userData.skirtR) r=o.userData.skirtR;
    else return;
    let mn=getHeight(wx,wz);
    for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])
      mn=Math.min(mn, getHeight(wx+dx*c+dz*s, wz-dx*s+dz*c));
    const top=seatY+.05, bot=mn-.7;
    if(top-bot<.2) return;
    const geo=boxSZ? new THREE.BoxGeometry(boxSZ[0],top-bot,boxSZ[1])
                   : new THREE.CylinderGeometry(r,r+.5,top-bot,8);
    const m=new THREE.Mesh(geo,M.stone);
    m.position.y=(top+bot)/2-seatY; // 挂在子件本地，随其旋转
    m.castShadow=m.receiveShadow=true; o.add(m);
  }
  for(const o of kids){
    if(o.userData.adapt!=='seat') continue;
    const wx=wxOf(o), wz=wzOf(o);
    const seatY=getHeight(wx,wz)+(o.userData.sink??-.15);
    o.position.y=seatY-gy;
    skirtUnder(o,seatY,wx,wz);
  }
  const decks=kids.filter(o=>o.userData.adapt==='deck').sort((a,b)=>a.userData.i-b.userData.i);
  const pav=kids.find(o=>o.userData.adapt==='pavilion');
  if(decks.length){
    const postGeos=[], remove=[];
    let level=Infinity, lastDeck=0, deep=false;
    for(const o of decks){
      const wx=wxOf(o), wz=wzOf(o), h=getHeight(wx,wz);
      if(deep){ remove.push(o); continue; }           // 已入深水，余板截断
      const y=Math.min(level, Math.max(h+o.userData.rise, WATER_Y+o.userData.overWater));
      level=y; lastDeck=y;
      o.position.y=y-gy;
      const hw=o.userData.hw||2.5, hd=o.userData.hd||1.5;
      const ex=hw*Math.abs(c)+hd*Math.abs(s), ez=hw*Math.abs(s)+hd*Math.abs(c);
      DECK_FLOORS.push({x0:wx-ex,x1:wx+ex,z0:wz-ez,z1:wz+ez,y:y+.18}); // 板面可行走
      if(h<WATER_Y-.6) deep=true;                     // 本块已在深水，再留一块即收
      const top=y-.12, bot=h-.7;                      // 桩：板底打到地面/湖床以下
      if(top-bot>.3){
        for(const px of [-o.userData.postX, o.userData.postX])
          postGeos.push(new THREE.CylinderGeometry(.15,.2,top-bot,6)
            .translate(o.position.x+px, (top+bot)/2-gy, o.position.z));
      }
    }
    for(const o of remove) g.remove(o);
    if(postGeos.length){
      const pm=new THREE.Mesh(mergeGeometries(postGeos),M.woodDark);
      pm.castShadow=pm.receiveShadow=true; g.add(pm);
    }
    if(pav){
      const wx=wxOf(pav), wz=wzOf(pav);
      const py=lastDeck-.8*pav.scale.y;               // 亭台面与末块栈道板平齐
      pav.position.y=py-gy;
      if(!pav.userData.skirtR) pav.userData.skirtR=6.2*pav.scale.y+.5;
      skirtUnder(pav,py,wx,wz);
    }
  }
}

function makeCamp(label,n=4){ // 旱寨营帐
  const g=new THREE.Group();
  for(let i=0;i<n;i++){
    const tent=new THREE.Mesh(new THREE.ConeGeometry(3.2,3.4,7),new THREE.MeshStandardMaterial({color:0x71624a,roughness:1}));
    tent.position.set((i%2?1:-1)*(6+R()*3), 1.7, (i<2?1:-1)*(4+R()*3)); tent.castShadow=true; g.add(tent);
    col(g,tent.position.x,tent.position.z,3.4);
  }
  const bp=bannerPole('寨','#3a4d63','#e8d9ae',9); g.add(bp);
  const st=stoneSign(label); st.position.set(8,0,0); g.add(st);
  return g;
}

// ---------------- 植被 ----------------
let _latticeMat=null;
function latticeMat(){ if(!_latticeMat) _latticeMat=makeLatticeMat(); return _latticeMat; }
function makeLatticeMat(){ // 格窗贴图
  const cv=document.createElement('canvas'); cv.width=cv.height=128;
  const c=cv.getContext('2d');
  c.fillStyle='#cfc2a2'; c.fillRect(0,0,128,128);
  c.strokeStyle='#5a3a20'; c.lineWidth=7;
  for(let i=0;i<=4;i++){ c.beginPath(); c.moveTo(i*32,0); c.lineTo(i*32,128); c.stroke(); c.beginPath(); c.moveTo(0,i*32); c.lineTo(128,i*32); c.stroke(); }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map:t,roughness:.9});
}
function reedTexture(){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=256;
  const c=cv.getContext('2d'); c.clearRect(0,0,128,256);
  for(let i=0;i<26;i++){
    const x=8+R()*112, lean=(R()-.5)*26;
    c.strokeStyle=`rgba(${100+R()*50|0},${110+R()*50|0},${60+R()*40|0},${.7+R()*.3})`;
    c.lineWidth=2+R()*3;
    c.beginPath(); c.moveTo(x,256); c.quadraticCurveTo(x+lean*.4,150,x+lean,20+R()*60); c.stroke();
    // 芦花
    c.strokeStyle='rgba(190,170,120,.8)'; c.lineWidth=3;
    c.beginPath(); c.moveTo(x+lean,30+R()*50); c.lineTo(x+lean+(R()-.5)*10,6+R()*20); c.stroke();
  }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// ---------------- 主构建 ----------------
export function buildWorld(scene){
  initMaterials();
  const world=new THREE.Group(); scene.add(world);
  const animated=[]; // {obj, fn(t,dt)}

  // ----- 天空 -----
  const skyGeo=new THREE.SphereGeometry(1600,32,20);
  const sunDirV=new THREE.Vector3(180,260,-160).normalize(); // 与平行光同向
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false,
    uniforms:{ top:{value:new THREE.Color(0x6f9ec8)}, mid:{value:new THREE.Color(0xdfe2d2)},
      bot:{value:new THREE.Color(0xd9b98a)}, warm:{value:new THREE.Color(0xf0b878)},
      sunDir:{value:sunDirV},
      fogColor:{value:new THREE.Color(0xd8c49c)} },
    vertexShader:`varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`varying vec3 vDir; uniform vec3 top,mid,bot,warm,sunDir,fogColor;
      void main(){
        float h=clamp(vDir.y,-1.,1.);
        vec3 col = h>0. ? mix(mid,top,pow(h,.62)) : mix(mid,bot,pow(-h,.6));
        float sd=max(dot(vDir,sunDir),0.);
        col += vec3(1.,.87,.62)*pow(sd,900.)*3.2;   // 日轮（HDR，供 bloom）
        col += vec3(1.,.82,.5)*pow(sd,10.)*.30;     // 晕
        col = mix(col, warm, pow(sd,3.)*pow(1.-abs(h),2.)*.5); // 地平线向阳暖调
        col = mix(col, fogColor, smoothstep(.16,-.02,h)*.85);  // 与雾色衔接
        gl_FragColor=vec4(col,1.);
      }`
  });
  world.add(new THREE.Mesh(skyGeo,skyMat));

  // ----- 远山（三重黛色山脊剪影，愈远愈淡） -----
  function ridgeRing(radius,hBase,hVar,seed,color){
    const SEG=160, pos=[], idx=[];
    const r2=rng(seed);
    // 多倍频起伏的山脊线
    const harmon=[]; for(let k=0;k<5;k++) harmon.push({f:2+k*2+(seed%3), p:r2()*6.28, a:hVar/(1+k*.9)});
    for(let i=0;i<=SEG;i++){
      const a=i/SEG*Math.PI*2;
      let y=hBase;
      for(const H of harmon) y+=Math.sin(a*H.f+H.p)*H.a;
      y=Math.max(y,hBase*.3);
      pos.push(Math.cos(a)*radius, -30, Math.sin(a)*radius);
      pos.push(Math.cos(a)*radius, y, Math.sin(a)*radius);
    }
    for(let i=0;i<SEG;i++){ const a=i*2; idx.push(a,a+2,a+1, a+1,a+2,a+3); }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    g.setIndex(idx); g.computeVertexNormals();
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
    m.position.z=30; return m;
  }
  world.add(ridgeRing(1250,190,120,11,0x93a9bc));
  world.add(ridgeRing(980,130,80,22,0x7e97ac));
  world.add(ridgeRing(780,85,55,33,0x6d8799));

  // ----- 地形 -----
  const SIZE=1500, SEG=240;
  const geo=new THREE.PlaneGeometry(SIZE,SIZE,SEG,SEG);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;
  const colors=new Float32Array(pos.count*3);
  const cGrass=new THREE.Color(0x66793c), cGrass2=new THREE.Color(0x8a8a4e),
        cMeadow=new THREE.Color(0x7d8a45),
        cRock=new THREE.Color(0x7d7768), cSand=new THREE.Color(0xb8a377),
        cRoad=new THREE.Color(0xa08a62), cEarth=new THREE.Color(0x97835a),
        cWet=new THREE.Color(0x8d7a58);
  const tmp=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    const h=getHeight(x,z);
    pos.setY(i,h);
    const hx=(getHeight(x+2,z)-getHeight(x-2,z))/4, hz=(getHeight(x,z+2)-getHeight(x,z-2))/4;
    const slope=Math.hypot(hx,hz);
    // 低频斑驳（草场深浅变化）
    const n=Math.sin(x*.021+3.7)*Math.sin(z*.017+1.3)+Math.sin(x*.043+z*.031)*.5;
    tmp.copy(cGrass).lerp(cGrass2, .5+.5*Math.sin(n*2.1));
    tmp.lerp(cMeadow, Math.max(0,Math.sin(x*.013-z*.019+2.))*.4);
    tmp.lerp(cRock, smoothstep(.55,.95,slope));
    if(h<2.2) tmp.lerp(cSand, smoothstep(2.2,.7,h));
    if(h<.9) tmp.lerp(cWet, smoothstep(.9,.15,h));   // 水线湿沙
    if(h<WATER_Y) tmp.lerp(new THREE.Color(0x5e6a4a), smoothstep(WATER_Y,WATER_Y-2.6,h)*.7); // 水下湖床
    const rd=roadInfo(x,z);
    if(rd) tmp.lerp(cRoad, (1-smoothstep(4.5,16,rd.dist))*.75);
    if(h>PLATEAU_H-1.5 && Math.hypot(x,z)<PLATEAU_R+6) tmp.lerp(cEarth,.55);
    colors[i*3]=tmp.r; colors[i*3+1]=tmp.g; colors[i*3+2]=tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
  geo.computeVertexNormals();
  // 高频细节贴图（近看颗粒感）
  const detCv=document.createElement('canvas'); detCv.width=detCv.height=256;
  const dctx=detCv.getContext('2d'); const dimg=dctx.createImageData(256,256);
  for(let i=0;i<256*256;i++){
    const v=216+((R()*40)|0), warm=R()*14|0;
    dimg.data[i*4]=v; dimg.data[i*4+1]=v-warm*.4; dimg.data[i*4+2]=v-warm; dimg.data[i*4+3]=255;
  }
  dctx.putImageData(dimg,0,0);
  const detTex=new THREE.CanvasTexture(detCv);
  detTex.wrapS=detTex.wrapT=THREE.RepeatWrapping; detTex.repeat.set(190,190);
  detTex.colorSpace=THREE.SRGBColorSpace; detTex.anisotropy=4;
  const terrain=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, map:detTex, roughness:1}));
  terrain.receiveShadow=true; world.add(terrain);

  // ----- 水面 -----
  // 湖床高度烘进纹理：水岸泡沫 / 深度着色 / 浅水减波共用
  const HB=256, HR=1300;
  const hCv=document.createElement('canvas'); hCv.width=hCv.height=HB;
  const hCtx=hCv.getContext('2d'); const hImg=hCtx.createImageData(HB,HB);
  for(let j=0;j<HB;j++)for(let i=0;i<HB;i++){
    const wx=-HR+i/(HB-1)*HR*2, wz=-HR+j/(HB-1)*HR*2;
    const h=Math.max(-6,Math.min(20,getHeight(wx,wz)));
    const v=(h+6)/26*255;
    const o=(j*HB+i)*4; hImg.data[o]=v; hImg.data[o+1]=v; hImg.data[o+2]=v; hImg.data[o+3]=255;
  }
  hCtx.putImageData(hImg,0,0);
  const heightTex=new THREE.CanvasTexture(hCv);
  heightTex.flipY=false;   // 与 (p+1300)/2600 的 uv 约定一致
  heightTex.minFilter=heightTex.magFilter=THREE.LinearFilter;

  const waterUni={ uTime:{value:0}, uWaterY:{value:WATER_Y},
    heightTex:{value:heightTex},
    deep:{value:new THREE.Color(0x122e36)}, shallow:{value:new THREE.Color(0x2f5a50)},
    sky:{value:new THREE.Color(0xa8b09a)}, sunDir:{value:sunDirV},
    foamColor:{value:new THREE.Color(0xe8e4d2)},
    fogColor:{value:new THREE.Color(0xd8c49c)}, fogNear:{value:220}, fogFar:{value:1100} };
  const waterMat=new THREE.ShaderMaterial({
    uniforms:waterUni, transparent:true,
    vertexShader:`uniform float uTime,uWaterY; uniform sampler2D heightTex;
      varying vec3 vPos; varying float vFog; varying float vDepth;
      float terrainH(vec2 p){ return texture2D(heightTex,(p+1300.)/2600.).r*26.-6.; }
      void main(){
        vec3 p=position;
        vec4 wp=modelMatrix*vec4(p,1.);
        float depth=uWaterY-terrainH(wp.xz);
        float damp=smoothstep(0.,1.4,depth);           // 浅滩减波
        float w1=sin(p.x*.055+uTime*.9)+sin(p.z*.075+uTime*.7);
        float w2=sin((p.x+p.z)*.028+uTime*.5)*1.4;
        p.y += (w1+w2)*.18*damp;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vPos=(modelMatrix*vec4(p,1.)).xyz;
        vFog=-mv.z; vDepth=depth;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`varying vec3 vPos; varying float vFog; varying float vDepth;
      uniform vec3 deep,shallow,sky,sunDir,foamColor,fogColor; uniform float uTime;
      uniform float fogNear,fogFar;
      void main(){
        if(vDepth<-.25) discard;                        // 岸上不画水
        vec3 viewDir=normalize(cameraPosition-vPos);
        // 程序波纹法线（两层频率）
        float n1=sin(vPos.x*.35+uTime*1.4)*sin(vPos.z*.3+uTime*1.1);
        float n2=sin((vPos.x+vPos.z)*.13+uTime*.8);
        float n3=sin(vPos.x*.9-uTime*1.9)*sin(vPos.z*.8+uTime*1.6);
        vec3 N=normalize(vec3(n1*.14+n2*.1+n3*.05,1.,n2*.12-n1*.09+n3*.04));
        float fres=pow(1.-max(dot(viewDir,N),0.),2.2);
        // 深度水色：清浅见底 → 深碧
        float dK=smoothstep(0.,2.3,vDepth);
        vec3 col=mix(shallow,deep,dK);
        col=mix(col,sky,fres*.45);
        vec3 H=normalize(viewDir+sunDir);
        float spec=pow(max(dot(N,H),0.),140.);
        col+=vec3(1.,.9,.7)*spec*1.1;                 // 粼粼波光
        // 水岸泡沫：沿水线两层推进的碎沫
        float foamBand=smoothstep(.34,.05,vDepth);
        float fAnim=.5+.5*sin(uTime*1.5+vPos.x*1.2+vPos.z*.9);
        float fAnim2=.5+.5*sin(uTime*1.1-vPos.x*.7+vPos.z*1.4+2.);
        float foam=foamBand*(fAnim*.45+fAnim2*.3);
        foam+=smoothstep(.07,.005,vDepth)*.45;         // 贴岸一线白
        col=mix(col,foamColor,clamp(foam,0.,1.)*.7);
        float alpha=mix(.5,.96,dK);
        alpha*=smoothstep(-.1,.12,vDepth);
        alpha=max(alpha,clamp(foam,0.,1.)*.8);
        float fog=smoothstep(fogNear,fogFar,vFog);
        col=mix(col,fogColor,fog);
        gl_FragColor=vec4(col,alpha);
      }`
  });
  const water=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600,120,120).rotateX(-Math.PI/2), waterMat);
  water.position.y=WATER_Y; world.add(water);
  animated.push({obj:waterMat, fn:(t)=>{ waterUni.uTime.value=t; }});

  // ----- 城墙 -----
  const walls=makeWallRing(PLATEAU_R-4, 6, [[0,PLATEAU_R,14],[PLATEAU_R,0,12],[-PLATEAU_R+6,0,12],[0,-PLATEAU_R+6,14]]);
  world.add(walls);

  // ----- 建筑布局 -----
  function place(obj,x,z,rotY=0){
    obj.position.set(x, getHeight(x,z)-.3, z);
    obj.rotation.y=rotY;
    const cs=obj.userData.cols;
    if(cs){ const s=Math.sin(rotY), c=Math.cos(rotY);
      for(const [lx,lz,r] of cs) colliders.push({x:x+lx*c+lz*s, z:z-lx*s+lz*c, r});
    }
    world.add(obj); adaptToTerrain(obj); return obj;
  }
  const hall=place(makeHall(), 0, -2, 0);
  place(makeFlagStand(), 0, 40, 0);
  const leftWing=place(makeHouse({w:20,d:8,h:3.6,label:'文卷房'}), -42, 14, Math.PI);
  const rightWing=place(makeHouse({w:20,d:8,h:3.6,label:'机要房'}), 42, 14, Math.PI);
  const rearWing=place(makeHouse({w:16,d:7,h:3.4,label:'作坊'}), 0, -50, 0);
  place(makePavilion('断金亭'), 52, -62, -2.4);
  place(makeTraining(), -50, -22, 0);
  place(makeStable(), 56, 42, -.4);
  place(makeGranary(), 48, -44, .2);
  place(makeClinic(), 60, 8, Math.PI+.3);
  place(makeGate('宛子城南门',{w:12,tower:true}), 0, PLATEAU_R-3, 0);
  // 南路三关
  place(makeGate('第三关',{w:16}), ROAD[3][0]+2, ROAD[3][1]+3, Math.atan2(ROAD[3][0]-ROAD[2][0], ROAD[3][1]-ROAD[2][1]));
  place(makeGate('第二关',{w:16}), ROAD[2][0], ROAD[2][1], Math.atan2(ROAD[2][0]-ROAD[1][0], ROAD[2][1]-ROAD[1][1]));
  place(makeGate('第一关',{w:18}), ROAD[1][0]+2, ROAD[1][1], Math.atan2(ROAD[1][0]-ROAD[0][0], ROAD[1][1]-ROAD[0][1]));
  // 东西北关
  place(makeGate('东山关',{w:14}), 76, 6, Math.PI/2);
  place(makeGate('西山关',{w:14}), -76, 6, Math.PI/2);
  place(makeGate('黑风口',{w:14}), -4, -76, 0);
  // 旱寨
  place(makeCamp('正南旱寨',5), 120, 205, 0);
  place(makeCamp('正东旱寨',4), 175, 95, -1.2);
  place(makeCamp('正西旱寨',4), -175, 95, 1.2);
  place(makeCamp('正北旱寨',4), -46, -36, 0);
  // 水寨与码头（北岸断崖下金沙滩、东岸鸭嘴滩、西南南湾）
  place(makeDock('金沙滩水寨',0), -8, -96, .1);
  scatterBoats(world, animated, -8, -96, .1, 4);
  place(makeShipyard(), 55, -84, .4);
  place(makeDock('鸭嘴滩水寨',0), 158, -45, -Math.PI/2+.1);
  scatterBoats(world, animated, 158, -45, -Math.PI/2+.1, 3);
  place(makeDock('南湾水寨',0), -200, 138, Math.PI/2);
  scatterBoats(world, animated, -200, 138, Math.PI/2, 3);
  // 山下
  place(makeInn('山下客店'), 66, 258, -.4);
  place(makeForge(), 96, 282, -1.1);
  // 李家道口
  place(makeTavern('李家道口酒店'), ISLET.x, ISLET.z, Math.PI);
  // 蓼儿洼
  place(makeFishingHut(), 235, -205, 1.2);

  // ----- 植被：松树（三层塔形） -----
  const pineTrunkGeo=new THREE.CylinderGeometry(.18,.34,3.4,6);
  function coneAt(r,h,y){ const g=new THREE.ConeGeometry(r,h,7); g.translate(0,y,0); return g; }
  const pineLeafGeo=mergeGeometries([
    coneAt(2.3,2.6,3.0), coneAt(1.75,2.3,4.6), coneAt(1.15,2.0,6.0)
  ]);
  const mapleLeafGeo=mergeGeometries([      // 阔叶团（霜叶）
    new THREE.IcosahedronGeometry(2.0,1).translate(0,4.2,0),
    new THREE.IcosahedronGeometry(1.4,1).translate(1.1,3.4,.5),
    new THREE.IcosahedronGeometry(1.2,1).translate(-1,3.6,-.4)
  ]);
  const trunkMat=new THREE.MeshStandardMaterial({color:0x4e3620,roughness:1});
  const pineMat=new THREE.MeshStandardMaterial({color:0x39513a,roughness:1});
  const mapleMat=new THREE.MeshStandardMaterial({color:0xa06828,roughness:1});
  const spots=[];
  const zoneClear=[ [0,0,PLATEAU_R+8],[0,40,30],[52,-62,18],[0,258,40],[66,258,26],[120,205,26],[175,95,24],[-175,95,24],[-46,-36,22],[-8,-96,30],[55,-84,20],[158,-45,28],[-200,138,28],[ISLET.x,ISLET.z,70],[235,-205,26],[96,282,18],[0,-100,26],[76,6,16],[-76,6,16],[-4,-76,16] ];
  function clear(x,z){ return zoneClear.some(([cx,cz,r])=>Math.hypot(x-cx,z-cz)<r); }
  let tries=0;
  while(spots.length<520 && tries<6000){
    tries++;
    const a=R()*Math.PI*2, d=Math.sqrt(R())*330;
    const x=Math.cos(a)*d, z=Math.sin(a)*d+30;
    const h=getHeight(x,z);
    if(h<3||h>PLATEAU_H+14) continue;
    const rd=roadInfo(x,z); if(rd && rd.dist<12) continue;
    if(clear(x,z)) continue;
    if(R()<.35 && h>18) continue; // 高处少树
    spots.push([x,z,h,R()]);
  }
  const trunkInst=new THREE.InstancedMesh(pineTrunkGeo,trunkMat,spots.length);
  const leafInst=new THREE.InstancedMesh(pineLeafGeo,pineMat,spots.length);
  const maples=new THREE.InstancedMesh(mapleLeafGeo,mapleMat,spots.length);
  const dum=new THREE.Object3D(); let mapleCount=0;
  let leafCount=0;
  spots.forEach(([x,z,h,r],i)=>{
    const isMaple = r>.72;
    const s=.7+r*1.1;
    dum.position.set(x,h-.4,z); dum.scale.setScalar(s); dum.rotation.y=r*6; dum.updateMatrix();
    trunkInst.setMatrixAt(i,dum.matrix);
    if(isMaple){ dum.scale.set(s*(.9+r*.4),s*(.75+r*.3),s*(.9+r*.4)); dum.updateMatrix(); maples.setMatrixAt(mapleCount++,dum.matrix); }
    else leafInst.setMatrixAt(leafCount++,dum.matrix);
  });
  leafInst.count=leafCount; maples.count=mapleCount;
  leafInst.castShadow=maples.castShadow=trunkInst.castShadow=true;
  world.add(trunkInst, leafInst, maples);

  // ----- 芦苇（双片交叉更蓬松） -----
  const reedPlane=new THREE.PlaneGeometry(2.4,3.4); reedPlane.translate(0,1.7,0);
  const reedPlane2=reedPlane.clone(); reedPlane2.rotateY(Math.PI/2);
  const reedGeo=mergeGeometries([reedPlane,reedPlane2]);
  const reedMat=new THREE.MeshLambertMaterial({map:reedTexture(), transparent:true, alphaTest:.3, side:THREE.DoubleSide});
  reedMat.onBeforeCompile=(sh)=>{
    sh.uniforms.uTime={value:0};
    sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float swA = uTime*1.2 + float(gl_InstanceID)*1.7;
       transformed.x += sin(swA)*0.35*max(position.y,0.);
       transformed.z += cos(swA*0.8)*0.25*max(position.y,0.);`);
    reedMat.userData.shader=sh;
  };
  const reedSpots=[];
  tries=0;
  while(reedSpots.length<2600 && tries<14000){
    tries++;
    const a=R()*Math.PI*2, d=200+R()*220;
    const x=Math.cos(a)*d, z=Math.sin(a)*d+30;
    const h=getHeight(x,z);
    if(h<WATER_Y-1.1||h>1.6) continue;    // 水深不过腰处生根
    reedSpots.push([x,z,h]);
  }
  // 蓼儿洼密植
  for(let i=0;i<900;i++){
    const x=235+(R()-.5)*220, z=-205+(R()-.5)*200;
    const h=getHeight(x,z);
    if(h>2.2||h<WATER_Y-1.2) continue;
    reedSpots.push([x,z,h]);
  }
  const reedInst=new THREE.InstancedMesh(reedGeo,reedMat,reedSpots.length);
  reedSpots.forEach(([x,z,h],i)=>{
    dum.position.set(x,Math.max(h-.15,WATER_Y-1.2),z); dum.rotation.y=R()*Math.PI; dum.scale.setScalar(.8+R()*.9);
    dum.updateMatrix(); reedInst.setMatrixAt(i,dum.matrix);
  });
  world.add(reedInst);
  animated.push({obj:reedMat, fn:(t)=>{ const sh=reedMat.userData.shader; if(sh) sh.uniforms.uTime.value=t; }});

  // ----- 荷叶 -----
  const lotusGeo=new THREE.CircleGeometry(.7,7); lotusGeo.rotateX(-Math.PI/2);
  const lotusMat=new THREE.MeshLambertMaterial({color:0x5d7d4a,side:THREE.DoubleSide});
  const lotusSpots=[];
  for(let i=0;i<900;i++){
    const a=R()*Math.PI*2, d=210+R()*180;
    const x=Math.cos(a)*d, z=Math.sin(a)*d+30;
    const h=getHeight(x,z);
    if(h>WATER_Y-.9 && h<WATER_Y-.06) lotusSpots.push([x,z]);
  }
  const lotusInst=new THREE.InstancedMesh(lotusGeo,lotusMat,lotusSpots.length);
  lotusSpots.forEach(([x,z],i)=>{ dum.position.set(x,WATER_Y+.03,z); dum.scale.setScalar(.6+R()*.8); dum.rotation.y=R()*6; dum.updateMatrix(); lotusInst.setMatrixAt(i,dum.matrix); });
  world.add(lotusInst);

  // ----- 岩石 -----
  const rockGeo=new THREE.DodecahedronGeometry(1.4,0);
  const rockMat2=new THREE.MeshStandardMaterial({color:0x847e6e,roughness:1});
  const rockInst=new THREE.InstancedMesh(rockGeo,rockMat2,180);
  let ri=0;
  for(let i=0;i<800&&ri<180;i++){
    const a=R()*Math.PI*2, d=R()*330;
    const x=Math.cos(a)*d, z=Math.sin(a)*d+30;
    const h=getHeight(x,z);
    if(h<1.5) continue;
    dum.position.set(x,h+.2,z); dum.rotation.set(R()*3,R()*3,R()*3);
    const s=.5+R()*2.2; dum.scale.set(s,s*(.6+R()*.6),s); dum.updateMatrix();
    rockInst.setMatrixAt(ri++,dum.matrix);
  }
  rockInst.count=ri; world.add(rockInst);

  // ----- 湖上渔船与雁群 -----
  for(let i=0;i<6;i++){
    const b=makeBoat();
    const a=R()*Math.PI*2, d=260+R()*160;
    const x=Math.cos(a)*d, z=Math.sin(a)*d+30;
    if(getHeight(x,z)>WATER_Y-.6) continue;   // 不搁浅
    b.position.set(x,WATER_Y,z);
    b.rotation.y=R()*6; world.add(b);
    animated.push({obj:b, fn:(t)=>{ b.position.y=WATER_Y+Math.sin(t*.7+b.userData.bobOff)*.18; b.rotation.z=Math.sin(t*.5+b.userData.bobOff)*.04; }});
  }
  (hall.parent===world?hall:hall).traverse(()=>{});
  // 收集所有旗与船做动画
  world.traverse(o=>{
    if(o.userData.flag){
      const fl=o.userData.flag;
      const flBase=fl.geometry.attributes.position.array.slice();
      animated.push({obj:o, fn:(t)=>{
        fl.rotation.y=Math.sin(t*1.4+o.position.x)*0.2;
        const p=fl.geometry.attributes.position;
        for(let i=0;i<p.count;i++){
          const x=flBase[i*3], y=flBase[i*3+1];
          p.setZ(i, Math.sin(t*2.6+y*1.4+x)*.12*((y+1.7)/3.4));
        }
        p.needsUpdate=true;
      }});
    }
    if(o.userData.boats) o.userData.boats.forEach(b=>animated.push({obj:b, fn:(t)=>{ b.position.y=Math.sin(t*.8+b.userData.bobOff)*.16; }}));
  });
  const flagStand=world.children.find(c=>c.userData&&c.userData.waveFlag);
  if(flagStand){
    const fl=flagStand.userData.waveFlag, base=fl.geometry.attributes.position.array.slice();
    animated.push({obj:fl, fn:(t)=>{
      const p=fl.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=base[i*3], y=base[i*3+1];
        p.setZ(i, Math.sin(t*2.2+x*.9+y*.4)*.55*( (x+4)/8 ));
      }
      p.needsUpdate=true; fl.geometry.computeVertexNormals();
    }});
  }

  // ----- 雁群（扇翅） -----
  const geese=new THREE.Group();
  const gMat=new THREE.MeshBasicMaterial({color:0x2f2a22,side:THREE.DoubleSide});
  const gWings=[];
  for(let i=0;i<7;i++){
    const goose=new THREE.Group();
    const body=new THREE.Mesh(new THREE.ConeGeometry(.24,1.4,5),gMat);
    body.rotation.x=Math.PI/2; goose.add(body);
    for(const s of [-1,1]){
      const wg=new THREE.PlaneGeometry(1.1,.4); wg.translate(s*.55,0,0);
      const wing=new THREE.Mesh(wg,gMat); goose.add(wing); gWings.push({wing,s,ph:i*.8});
    }
    goose.position.set(i*3.2-(i%2)*1.6, R()*1.5, -i*2.2);
    geese.add(goose);
  }
  world.add(geese);
  animated.push({obj:geese, fn:(t)=>{
    const a=t*.05;
    geese.position.set(Math.cos(a)*420, 130+Math.sin(t*.3)*12, Math.sin(a)*420+30);
    geese.rotation.y=-a+Math.PI/2;
    for(const w of gWings) w.wing.rotation.z=-w.s*Math.sin(t*9+w.ph)*.65;
  }});

  // ----- 云 -----
  const cloudTexCv=document.createElement('canvas'); cloudTexCv.width=256; cloudTexCv.height=128;
  const cc=cloudTexCv.getContext('2d');
  for(let i=0;i<26;i++){
    const g=cc.createRadialGradient(30+R()*196,40+R()*48,4, 30+R()*196,40+R()*48,20+R()*26);
    g.addColorStop(0,'rgba(255,250,240,.75)'); g.addColorStop(1,'rgba(255,250,240,0)');
    cc.fillStyle=g; cc.fillRect(0,0,256,128);
  }
  const cloudTex=new THREE.CanvasTexture(cloudTexCv);
  for(let i=0;i<14;i++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:.5,depthWrite:false}));
    sp.scale.set(180+R()*160, 60+R()*40, 1);
    sp.position.set((R()-.5)*1400, 220+R()*120, (R()-.5)*1400);
    world.add(sp);
    animated.push({obj:sp, fn:(t,dt)=>{ sp.position.x+=dt*1.6; if(sp.position.x>760) sp.position.x=-760; }});
  }

  // ----- 氛围系统：水雾 / 落叶 / 蝴蝶 / 鱼跃涟漪 / 巡船 -----
  // 水雾（大柔片慢漂，贴水轻笼）
  for(let i=0;i<8;i++){
    const a=R()*Math.PI*2, d=260+R()*240;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,
      opacity:.045+R()*.05,depthWrite:false,color:0xe8e0cc}));
    sp.scale.set(150+R()*130, 22+R()*22, 1);
    sp.position.set(Math.cos(a)*d, 1.0+R()*1.8, Math.sin(a)*d+30);
    world.add(sp);
    const vx=.8+R()*1.2;
    animated.push({obj:sp, fn:(t,dt)=>{ sp.position.x+=dt*vx; if(sp.position.x>700) sp.position.x=-700; }});
  }

  // 霜叶飘落（Points，树周循环）
  const LEAVES=260;
  const leafGeoB=new THREE.BufferGeometry();
  const lPos=new Float32Array(LEAVES*3), lCol=new Float32Array(LEAVES*3), lSeed=new Float32Array(LEAVES);
  const leafCv=document.createElement('canvas'); leafCv.width=leafCv.height=32;
  const lc=leafCv.getContext('2d');
  const lg=lc.createRadialGradient(16,16,2,16,16,15);
  lg.addColorStop(0,'rgba(255,255,255,1)'); lg.addColorStop(.6,'rgba(255,255,255,.75)'); lg.addColorStop(1,'rgba(255,255,255,0)');
  lc.fillStyle=lg; lc.beginPath(); lc.ellipse(16,16,12,7,.6,0,7); lc.fill();
  const leafTex=new THREE.CanvasTexture(leafCv);
  function respawnLeaf(i){
    const sp=spots[(R()*spots.length)|0];      // 树的位置
    const a=R()*6.28, rr=R()*5;
    lPos[i*3]=sp[0]+Math.cos(a)*rr;
    lPos[i*3+1]=sp[2]+3+R()*6;
    lPos[i*3+2]=sp[1]+Math.sin(a)*rr;
    lSeed[i]=R()*10;
    const warm=.55+R()*.45;
    lCol[i*3]=.62*warm+.25; lCol[i*3+1]=.42*warm+.12; lCol[i*3+2]=.16*warm+.06;
  }
  for(let i=0;i<LEAVES;i++){ respawnLeaf(i); lPos[i*3+1]-=R()*8; }
  leafGeoB.setAttribute('position',new THREE.BufferAttribute(lPos,3));
  leafGeoB.setAttribute('color',new THREE.BufferAttribute(lCol,3));
  const leafMat=new THREE.PointsMaterial({size:.34,map:leafTex,transparent:true,depthWrite:false,
    vertexColors:true,sizeAttenuation:true,opacity:.9});
  const leaves=new THREE.Points(leafGeoB,leafMat);
  leaves.frustumCulled=false; world.add(leaves);
  animated.push({obj:leaves, fn:(t,dt)=>{
    const p=leafGeoB.attributes.position.array;
    for(let i=0;i<LEAVES;i++){
      p[i*3+1]-=dt*(.5+ (lSeed[i]%1)*.7);
      p[i*3]+=Math.sin(t*1.7+lSeed[i]*6)*dt*.9;
      p[i*3+2]+=Math.cos(t*1.3+lSeed[i]*5)*dt*.6;
      if(p[i*3+1]<getHeight(p[i*3],p[i*3+2])+.2){ respawnLeaf(i); }
    }
    leafGeoB.attributes.position.needsUpdate=true;
    leafGeoB.attributes.color.needsUpdate=true;
  }});

  // 蝴蝶（草坡花间）
  const bWingL=new THREE.PlaneGeometry(.34,.26); bWingL.translate(-.17,0,0);
  const bWingR=new THREE.PlaneGeometry(.34,.26); bWingR.translate(.17,0,0);
  const bColors=[0xd8a848,0xc96a8a,0x8aa8d8,0xd8d0c0];
  for(let i=0;i<12;i++){
    const g2=new THREE.Group();
    const bm=new THREE.MeshBasicMaterial({color:bColors[i%4],side:THREE.DoubleSide});
    const wl=new THREE.Mesh(bWingL,bm), wr=new THREE.Mesh(bWingR,bm);
    g2.add(wl,wr); world.add(g2);
    // 找一处草坡做活动中心
    let cx=0,cz=0,ok=0;
    for(let k=0;k<40&&!ok;k++){ const a=R()*6.28,d=60+R()*240,tx=Math.cos(a)*d,tz=Math.sin(a)*d+30;
      const h=getHeight(tx,tz); if(h>2&&h<16){ cx=tx; cz=tz; ok=1; } }
    if(!ok){ g2.visible=false; continue; }
    const ph=R()*10, rr=2+R()*4, sp=.25+R()*.3;
    animated.push({obj:g2, fn:(t)=>{
      const a=t*sp+ph;
      const x=cx+Math.cos(a)*rr, z=cz+Math.sin(a*1.3)*rr;
      const h=getHeight(x,z);
      g2.position.set(x, h+1.1+Math.sin(t*2.1+ph)*.5, z);
      g2.rotation.y=Math.atan2(-Math.sin(a)*sp, Math.cos(a*1.3)*1.3*sp);
      const fl=Math.sin(t*17+ph)*1.05;
      wl.rotation.y= fl; wr.rotation.y=-fl;
    }});
  }

  // 涟漪池（鱼跃 / 巡船共用）
  const rippleGeo=new THREE.RingGeometry(.82,1,26); rippleGeo.rotateX(-Math.PI/2);
  const ripples=[];
  for(let i=0;i<14;i++){
    const rm=new THREE.Mesh(rippleGeo,new THREE.MeshBasicMaterial({color:0xdfe8dc,transparent:true,opacity:0,depthWrite:false}));
    rm.position.y=WATER_Y+.05; rm.visible=false; world.add(rm);
    ripples.push({m:rm,s:0,on:false});
  }
  function spawnRipple(x,z,big=1){
    const r=ripples.find(r=>!r.on); if(!r) return;
    r.on=true; r.s=.3*big; r.m.visible=true; r.m.position.set(x,WATER_Y+.05,z); r.m.scale.setScalar(r.s);
  }
  world.spawnRipple=spawnRipple;
  animated.push({obj:null, fn:(t,dt)=>{
    for(const r of ripples){ if(!r.on) continue;
      r.s+=dt*2.4; r.m.scale.setScalar(r.s);
      r.m.material.opacity=.42*Math.max(0,1-r.s/4.2);
      if(r.s>4.2){ r.on=false; r.m.visible=false; }
    }
  }});

  // 鱼跃（近岸浅滩随机跃出）
  const fishMat=new THREE.MeshStandardMaterial({color:0x9ab2ac,roughness:.4,metalness:.5});
  for(let i=0;i<5;i++){
    const fish=new THREE.Mesh(new THREE.ConeGeometry(.11,.6,6),fishMat);
    fish.visible=false; world.add(fish);
    const st={t:-1,wait:2+R()*8,x0:0,z0:0,x1:0,z1:0};
    animated.push({obj:fish, fn:(t,dt)=>{
      if(st.t<0){ st.wait-=dt;
        if(st.wait<0){ // 起跳：找一处浅滩
          const a=R()*6.28, d=230+R()*180;
          const x=Math.cos(a)*d, z=Math.sin(a)*d+30;
          if(getHeight(x,z)>WATER_Y-2.4 && getHeight(x,z)<WATER_Y-.6){
            st.x0=x; st.z0=z; st.x1=x+(R()-.5)*3; st.z1=z+(R()-.5)*3; st.t=0; fish.visible=true;
          } else st.wait=1+R()*2;
        }
        return;
      }
      st.t+=dt/.9;
      if(st.t>=1){ fish.visible=false; st.t=-1; st.wait=3+R()*9; spawnRipple(st.x1,st.z1,1.1); return; }
      const k=st.t, x=st.x0+(st.x1-st.x0)*k, z=st.z0+(st.z1-st.z0)*k;
      const y=WATER_Y+Math.sin(k*Math.PI)*1.1;
      fish.position.set(x,y,z);
      fish.rotation.x=(k-.5)*2.4; fish.rotation.y=Math.atan2(st.x1-st.x0,st.z1-st.z0);
    }});
  }

  // 巡船（东西深水区绕泊巡航）
  const patrols=[{cx:350,cz:-90,r:120,sp:.028,ph:0},{cx:-380,cz:150,r:90,sp:-.024,ph:2.5}];
  patrols.forEach(P=>{
    const b=makeBoat(); world.add(b);
    let wakeT=0, lx=0, lz=0;
    animated.push({obj:b, fn:(t,dt)=>{
      const a=t*P.sp+P.ph;
      const x=P.cx+Math.cos(a)*P.r, z=P.cz+Math.sin(a)*P.r;
      b.position.set(x, WATER_Y+Math.sin(t*.8+P.ph)*.14, z);
      b.rotation.y=Math.atan2(x-lx,z-lz); lx=x; lz=z;
      wakeT-=dt; if(wakeT<0){ wakeT=1.1; spawnRipple(x,z,1.4); }
    }});
  });

  // ----- 氛围灯 -----
  const warmA=new THREE.PointLight(0xffa050,24,60,1.8); warmA.position.set(0,getHeight(0,-2)+8,8); world.add(warmA);
  const warmHall=new THREE.PointLight(0xffb060,40,55,1.6); warmHall.position.set(0,48,-2); world.add(warmHall);
  const warmForge=new THREE.PointLight(0xff7030,20,40,1.8); warmForge.position.set(92,getHeight(92,282)+3,276); world.add(warmForge);

  return {
    group:world, animated, colliders,
    waterUniforms:waterUni,
    hall,
    spawnRipple,
    spawn:{ x:ISLET.x-2, z:ISLET.z+26 },
  };
}

// ---------------- 区域（NPC 锚点 / 地名） ----------------
export const ZONES = {
  hall:      { x:0,   z:6,   face:0, floorY:42.35, label:'忠义堂', sub:'一百单八将聚义之所', r:34 },
  leftwing:  { x:-42, z:23,  face:Math.PI,      label:'文卷房',   sub:'萧让 · 裴宣 · 金大坚 · 蒋敬', r:14 },
  rightwing: { x:42,  z:23,  face:Math.PI,      label:'机要房',   sub:'凌振 · 侯健 · 陶宗旺', r:14 },
  rearwing:  { x:0,   z:-58, face:0,            label:'后厢作坊', sub:'李云 · 汤隆 · 朱富 · 蔡福 · 蔡庆', r:13 },
  duanjing:  { x:52,  z:-62, face:-2.4,         label:'断金亭',   sub:'林教头火并王伦处 · 湖光尽收眼底', r:14 },
  training:  { x:-50, z:-22, face:0,            label:'演武场',   sub:'枪棒切磋 · 相扑较艺', r:20 },
  stable:    { x:54,  z:55,  face:-.4,            label:'马厩',     sub:'紫髯伯相马处', r:14 },
  granary:   { x:44,  z:-40, face:.2,           label:'粮仓',     sub:'宋清排设筵宴', r:14 },
  clinic:    { x:63,  z:17,  face:Math.PI+.3,   label:'医馆',     sub:'安神医悬壶之所', r:12 },
  flag:      { x:0,   z:34,  face:0,            label:'旗台',     sub:'「替天行道」杏黄旗', r:12 },
  guan1:     { x:20,  z:212, face:2.5, roofSpot:[36,206,15.3], label:'第一关', sub:'解珍 · 解宝 把守', r:16 },
  guan2:     { x:-16, z:146, face:-2.2,         label:'第二关',   sub:'鲁智深 · 武松 把守', r:16 },
  guan3:     { x:14,  z:98,  face:2.9,          label:'第三关',   sub:'朱仝 · 雷横 · 戴宗 · 黄信', r:16 },
  eastgate:  { x:72,  z:8,   face:Math.PI/2,    label:'东山关',   sub:'史进 · 刘唐 把守', r:14 },
  westgate:  { x:-72, z:8,   face:-Math.PI/2,   label:'西山关',   sub:'杨雄 · 石秀 把守', r:14 },
  northgate: { x:-4,  z:-72, face:0,            label:'黑风口',   sub:'北山关 · 李逵 把守', r:16 },
  southcamp: { x:120, z:218, face:0,            label:'正南旱寨', sub:'霹雳火秦明坐镇', r:22 },
  eastcamp:  { x:191, z:105, face:-1.2,         label:'正东旱寨', sub:'大刀关胜坐镇', r:22 },
  westcamp:  { x:-186,z:90,  face:1.2,          label:'正西旱寨', sub:'豹子头林冲坐镇', r:22 },
  northcamp: { x:-46, z:-49, face:0,            label:'正北旱寨', sub:'双鞭呼延灼坐镇', r:20 },
  jinshatan: { x:-8,  z:-88, face:Math.PI,      label:'金沙滩水寨', sub:'阮氏三雄操练水军处', r:26 },
  yazuitan:  { x:150, z:-40, face:-Math.PI/2,   label:'鸭嘴滩水寨', sub:'混江龙李俊水军大寨', r:24 },
  nanwan:    { x:-192,z:132, face:Math.PI/2,    label:'南湾水寨',  sub:'张横 · 张顺巡泊处', r:22 },
  shipyard:  { x:55,  z:-84, face:.4,           label:'船坞',     sub:'玉幡竿孟康监造战船', r:16 },
  liaoerwa:  { x:232, z:-198,face:1.2,          label:'蓼儿洼',   sub:'芦花似雪 · 雁阵惊寒', r:30 },
  inn:       { x:62,  z:245, face:-.4,          label:'山下客店', sub:'孙新 · 顾大嫂 · 张青 · 孙二娘', r:24 },
  jiudian:   { x:ISLET.x, z:ISLET.z+10, face:Math.PI, label:'李家道口', sub:'旱地忽律朱贵酒店', r:26 },
  forge:     { x:83,  z:289, face:-1.1,           label:'铁匠铺',   sub:'金钱豹子汤隆掌炉', r:14 },
  path:      { x:16,  z:180, face:0,            label:'盘山道',   sub:'三关天险 · 一线通山寨', r:18 },
};

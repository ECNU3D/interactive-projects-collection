// ============================================================
// 水泊梁山 · 人物骨骼化建模
// 由 look 描述生成有关节的人物：头（可转）、双臂（可摆/拱手）、
// 双腿（行走时摆动）。兵器按原位拄地/佩身，并入躯干网格。
// ============================================================
import * as THREE from 'three';

// ---------------- 几何合并 ----------------
const _q=new THREE.Quaternion(), _e=new THREE.Euler();
function T(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
  _q.setFromEuler(_e.set(rx,ry,rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),_q,new THREE.Vector3(sx,sy,sz));
}
export function mergeParts(parts){
  const geos=parts.map(p=>{
    const g=p.geo.toNonIndexed();
    g.applyMatrix4(p.m);
    const cnt=g.attributes.position.count;
    const col=new Float32Array(cnt*3);
    const c=new THREE.Color(p.color);
    for(let i=0;i<cnt;i++){ col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col,3));
    return g;
  });
  let total=0; geos.forEach(g=>total+=g.attributes.position.count);
  const pos=new Float32Array(total*3), nor=new Float32Array(total*3), col=new Float32Array(total*3);
  let off=0;
  geos.forEach(g=>{
    pos.set(g.attributes.position.array, off*3);
    nor.set(g.attributes.normal.array, off*3);
    col.set(g.attributes.color.array, off*3);
    off+=g.attributes.position.count;
  });
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.BufferAttribute(pos,3));
  out.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  out.setAttribute('color',new THREE.BufferAttribute(col,3));
  return out;
}
export const charMat=new THREE.MeshStandardMaterial({vertexColors:true, roughness:.82});

const SKIN={black:0x7a6a58,red:0xb07a5a,fair:0xe8cfae,tan:0xc9a071,dark:0x5f5245,pale:0xd8c8a4,white:0xefe4d2};
const HAIR=0x26221c;
const STEEL=0x9aa0a6, STEEL_D=0x565b60, WOOD=0x4a3018, GOLD=0xc9a03a, RED=0x8a2f22;

// ---------------- 头部（含面容 / 冠巾 / 须发） ----------------
// 头枢轴在颈部 y=0（世界 y≈1.50），头心 +.14
function headParts(h){
  const P=[];
  const skin=SKIN[h.look.face]||SKIN.tan;
  const female=!!h.look.female;
  P.push({geo:new THREE.SphereGeometry(.24,12,10), m:T(0,.14,0), color:skin});       // 头
  // 眉眼（近看有神情）
  P.push({geo:new THREE.BoxGeometry(.085,.022,.02), m:T(-.082,.225,.215,0,0,.18), color:0x1c1814});
  P.push({geo:new THREE.BoxGeometry(.085,.022,.02), m:T(.082,.225,.215,0,0,-.18), color:0x1c1814});
  P.push({geo:new THREE.SphereGeometry(.021,5,5), m:T(-.08,.16,.225), color:0x1a1512});
  P.push({geo:new THREE.SphereGeometry(.021,5,5), m:T(.08,.16,.225), color:0x1a1512});
  // 冠巾发型
  switch(h.look.head){
    case 'wrap': P.push({geo:new THREE.CylinderGeometry(.25,.26,.15,10), m:T(0,.30,0), color:0x3a342c});
      P.push({geo:new THREE.SphereGeometry(.245,10,8,0,6.28,0,1.35), m:T(0,.17,0), color:0x3a342c}); break;
    case 'hat': P.push({geo:new THREE.ConeGeometry(.40,.20,12), m:T(0,.36,0), color:0x5e503c});
      P.push({geo:new THREE.SphereGeometry(.05,6,6), m:T(0,.42,0), color:0x2e2a24}); break;
    case 'dao': P.push({geo:new THREE.SphereGeometry(.12,8,8), m:T(0,.42,0), color:0x2c2c38});
      P.push({geo:new THREE.CylinderGeometry(.27,.27,.05,10), m:T(0,.27,0), color:0x2c2c38});
      P.push({geo:new THREE.SphereGeometry(.235,10,8,0,6.28,0,1.3), m:T(0,.16,0), color:0x2c2c38}); break;
    case 'monk': for(let i=0;i<6;i++){ const a=i/6*6.28;
        P.push({geo:new THREE.SphereGeometry(.026,4,4), m:T(Math.cos(a)*.12,.30,Math.sin(a)*.12), color:0x8a6a4a}); } break;
    case 'pilgrim': P.push({geo:new THREE.TorusGeometry(.245,.028,6,14), m:T(0,.24,0,Math.PI/2), color:GOLD});
      P.push({geo:new THREE.SphereGeometry(.245,10,8,0,6.28,0,1.2), m:T(0,.17,0), color:HAIR}); break;
    case 'helmet': P.push({geo:new THREE.SphereGeometry(.27,12,8,0,6.28,0,1.25), m:T(0,.20,0), color:0x7a766a});
      P.push({geo:new THREE.ConeGeometry(.065,.28,6), m:T(0,.50,0), color:RED});
      P.push({geo:new THREE.SphereGeometry(.06,6,6), m:T(0,.36,0), color:GOLD}); break;
    case 'savage': for(let i=0;i<6;i++){ const a=i/6*6.28;   // 怒发冲冠
        P.push({geo:new THREE.ConeGeometry(.055,.24,5), m:T(Math.cos(a)*.14,.36,Math.sin(a)*.14,0,0,Math.cos(a)*.3), color:HAIR}); }
      P.push({geo:new THREE.SphereGeometry(.24,10,8,0,6.28,0,1.2), m:T(0,.17,0), color:HAIR}); break;
    default: P.push({geo:new THREE.SphereGeometry(.13,8,8), m:T(0,.36,0), color:HAIR});
      P.push({geo:new THREE.SphereGeometry(.235,10,8,0,6.28,0,1.25), m:T(0,.16,0), color:HAIR});
  }
  if(h.look.head==='mark') P.push({geo:new THREE.SphereGeometry(.06,6,6), m:T(.20,.12,.12), color:0xa03828}); // 朱砂记
  if(female){ P.push({geo:new THREE.SphereGeometry(.09,6,6), m:T(-.27,-.06,.05), color:HAIR});
              P.push({geo:new THREE.SphereGeometry(.09,6,6), m:T(.27,-.06,.05), color:HAIR}); }
  // 须
  if(h.look.beard==='long') P.push({geo:new THREE.ConeGeometry(.13,.48,6), m:T(0,-.16,.14,Math.PI), color:HAIR});
  else if(h.look.beard==='full') P.push({geo:new THREE.SphereGeometry(.16,6,6), m:T(0,-.04,.11), color:HAIR});
  else if(h.look.beard==='short') P.push({geo:new THREE.SphereGeometry(.11,6,6), m:T(0,-.01,.11), color:HAIR});
  else if(h.look.beard==='mustache') P.push({geo:new THREE.BoxGeometry(.15,.028,.045), m:T(0,.04,.21), color:HAIR});
  else if(h.look.beard==='bush'){ // 虬髯满颊
    P.push({geo:new THREE.SphereGeometry(.20,7,7), m:T(0,-.10,.13), color:HAIR});
    P.push({geo:new THREE.SphereGeometry(.085,5,5), m:T(-.17,.02,.13), color:HAIR});
    P.push({geo:new THREE.SphereGeometry(.085,5,5), m:T(.17,.02,.13), color:HAIR});
  }
  return P;
}

// ---------------- 兵器 / 道具（拄地或佩身，并入躯干） ----------------
function weaponParts(h){
  const P=[];
  const pole=(len,x,y,z,rz)=>{ P.push({geo:new THREE.CylinderGeometry(.03,.03,len,5), m:T(x,y,z,0,0,rz), color:WOOD}); };
  switch(h.look.weapon){
    case 'podao': pole(2.3,-.42,1.15,-.16,.5);
      P.push({geo:new THREE.BoxGeometry(.55,.28,.03), m:T(-1.0,2.05,-.34,0,0,.5), color:STEEL});
      P.push({geo:new THREE.SphereGeometry(.05,5,5), m:T(-.72,1.78,-.28), color:RED}); break;
    case 'spear': pole(2.5,-.42,1.15,-.16,.55);
      P.push({geo:new THREE.ConeGeometry(.05,.42,5), m:T(-1.08,2.12,-.34,0,0,.55-Math.PI/2), color:STEEL});
      P.push({geo:new THREE.SphereGeometry(.06,5,5), m:T(-.95,1.98,-.31), color:RED}); break;
    case 'twinSpears': pole(1.7,-.3,1.15,-.2,.62); pole(1.7,.24,1.15,-.24,-.62);
      P.push({geo:new THREE.ConeGeometry(.04,.3,5), m:T(-.83,1.9,-.32,0,0,.62-Math.PI/2), color:STEEL});
      P.push({geo:new THREE.ConeGeometry(.04,.3,5), m:T(.77,1.9,-.36,0,0,-.62+Math.PI/2), color:STEEL}); break;
    case 'trident': pole(2.4,-.42,1.15,-.16,.52);
      P.push({geo:new THREE.BoxGeometry(.5,.07,.05), m:T(-1.02,2.06,-.33,0,0,.52), color:STEEL});
      for(let i=-1;i<=1;i++) P.push({geo:new THREE.ConeGeometry(.04,.26,4), m:T(-1.02+i*.22,2.2,-.33,0,0,0), color:STEEL}); break;
    case 'blade': P.push({geo:new THREE.BoxGeometry(.07,.62,.11), m:T(.44,.95,.2,0,0,.22), color:0x3a2c1c});
      P.push({geo:new THREE.CylinderGeometry(.03,.03,.16,5), m:T(.51,1.26,.23,0,0,.22), color:GOLD}); break;
    case 'axe': for(const s of [-1,1]){
      P.push({geo:new THREE.CylinderGeometry(.026,.026,.6,5), m:T(s*.43,1.0,.22), color:WOOD});
      P.push({geo:new THREE.BoxGeometry(.24,.18,.04), m:T(s*.43,1.26,.23), color:STEEL}); } break;
    case 'mace': pole(1.7,-.42,1.15,-.16,.55);
      P.push({geo:new THREE.SphereGeometry(.15,7,7), m:T(-1.1,1.98,-.3), color:STEEL_D});
      for(let i=0;i<5;i++){ const a=i/5*6.28;
        P.push({geo:new THREE.ConeGeometry(.035,.14,4), m:T(-1.1+Math.cos(a)*.15,1.98+Math.sin(a)*.15,-.3,0,0,-a), color:STEEL_D}); } break;
    case 'whips': for(const s of [-1,1]){
      P.push({geo:new THREE.BoxGeometry(.06,.95,.06), m:T(s*.2,1.15,-.3,0,0,s*.06), color:STEEL_D});
      P.push({geo:new THREE.CylinderGeometry(.032,.032,.18,5), m:T(s*.2,.68,-.29), color:WOOD}); } break;
    case 'staff': pole(2.3,-.42,1.15,-.16,.5);
      P.push({geo:new THREE.BoxGeometry(.34,.06,.06), m:T(-.98,2.16,-.33,0,0,.5), color:GOLD});
      P.push({geo:new THREE.SphereGeometry(.05,5,5), m:T(-.98,2.16,-.33), color:RED}); break;
    case 'bow': P.push({geo:new THREE.TorusGeometry(.52,.025,5,14,Math.PI), m:T(-.05,1.32,-.32,0,0,0), color:WOOD});
      P.push({geo:new THREE.CylinderGeometry(.085,.085,.55,6), m:T(.42,1.05,-.2,0,0,.15), color:0x6e4a2f});
      for(let i=0;i<3;i++) P.push({geo:new THREE.CylinderGeometry(.012,.012,.6,4), m:T(.4+i*.03,1.38,-.2), color:0xd8cba8}); break;
    case 'sword': P.push({geo:new THREE.BoxGeometry(.06,.8,.13), m:T(-.42,1.25,-.22,0,0,.6), color:0x6a5220});
      P.push({geo:new THREE.BoxGeometry(.16,.05,.16), m:T(-.66,1.66,-.35,0,0,.6), color:GOLD});
      P.push({geo:new THREE.SphereGeometry(.035,5,5), m:T(-.2,.86,-.13), color:RED}); break;
    case 'fan': P.push({geo:new THREE.CylinderGeometry(.018,.018,.5,5), m:T(.5,1.02,.26,0,0,.5), color:WOOD});
      P.push({geo:new THREE.BoxGeometry(.3,.34,.025), m:T(.58,1.32,.31,0,0,.5), color:0xe8e0cc}); break;
    case 'pouch': P.push({geo:new THREE.SphereGeometry(.12,6,6), m:T(-.46,.82,.2), color:0x7a5a34}); break;
    case 'oar': pole(2.0,-.42,1.1,-.16,.5);
      P.push({geo:new THREE.BoxGeometry(.13,.4,.03), m:T(-.9,1.95,-.32,0,0,.5), color:WOOD}); break;
    case 'flute': P.push({geo:new THREE.CylinderGeometry(.022,.022,.62,6), m:T(0,1.5,.29,0,0,Math.PI/2), color:STEEL_D}); break;
    case 'brush': P.push({geo:new THREE.CylinderGeometry(.016,.016,.42,5), m:T(.46,1.0,.22), color:0x8a6a3a});
      P.push({geo:new THREE.ConeGeometry(.028,.1,5), m:T(.46,.78,.22,Math.PI), color:0x1c1814});
      P.push({geo:new THREE.CylinderGeometry(.05,.05,.6,6), m:T(-.3,1.52,-.3,0,0,Math.PI/2), color:0xe0d6bc}); break;
    case 'abacus': P.push({geo:new THREE.BoxGeometry(.42,.3,.05), m:T(.52,1.02,.3,0,.35,0), color:WOOD});
      for(let r=0;r<3;r++) for(let c=0;c<4;c++)
        P.push({geo:new THREE.SphereGeometry(.028,4,4), m:T(.38+c*.09,1.15-r*.09,.32,0,.35,0), color:0x8a5a2e}); break;
    case 'medbox': P.push({geo:new THREE.BoxGeometry(.52,.4,.22), m:T(0,1.28,-.32), color:0xd8d0c0});
      P.push({geo:new THREE.BoxGeometry(.3,.07,.02), m:T(0,1.28,-.42), color:RED});
      P.push({geo:new THREE.BoxGeometry(.07,.3,.02), m:T(0,1.28,-.42), color:RED}); break;
    case 'jar': P.push({geo:new THREE.SphereGeometry(.17,8,8), m:T(.42,.17,.3), color:0x5a4028});
      P.push({geo:new THREE.CylinderGeometry(.07,.09,.14,7), m:T(.42,.34,.3), color:0x5a4028});
      P.push({geo:new THREE.ConeGeometry(.08,.07,7), m:T(.42,.43,.3), color:RED}); break;
    case 'dagger': P.push({geo:new THREE.BoxGeometry(.05,.36,.09), m:T(.34,.92,-.22,0,0,.15), color:0x2a241c});
      P.push({geo:new THREE.ConeGeometry(.03,.22,4), m:T(.36,.73,-.2,Math.PI), color:STEEL}); break;
    case 'banner': P.push({geo:new THREE.CylinderGeometry(.03,.03,3.4,5), m:T(.52,1.7,-.12), color:WOOD});
      P.push({geo:new THREE.BoxGeometry(.85,.5,.02), m:T(.94,2.9,-.12), color:RED});
      P.push({geo:new THREE.BoxGeometry(.3,.3,.021), m:T(.94,2.9,-.115), color:GOLD}); break;
    case 'cannon': P.push({geo:new THREE.CylinderGeometry(.075,.09,.72,8), m:T(-.42,1.32,-.24,0,0,.6), color:STEEL_D});
      P.push({geo:new THREE.SphereGeometry(.1,6,6), m:T(-.62,1.7,-.35), color:STEEL_D}); break;
    case 'hammer': P.push({geo:new THREE.CylinderGeometry(.026,.026,.72,5), m:T(.45,.98,.22), color:WOOD});
      P.push({geo:new THREE.BoxGeometry(.2,.17,.17), m:T(.45,1.34,.22), color:STEEL_D}); break;
  }
  return P;
}

// ---------------- 躯干（袍服 / 腰带 / 领衽 / 兵器） ----------------
function bodyParts(h, withLegs){
  const acc=h.look.accent||0x556655;
  const accD=new THREE.Color(acc).multiplyScalar(.62).getHex();
  const female=!!h.look.female;
  const P=[];
  if(withLegs){ // 行走角色：双腿独立（不占躯干）
  }else{
    P.push({geo:new THREE.CylinderGeometry(.11,.12,.8,7), m:T(-.14,.4,0), color:0x2e2a24});
    P.push({geo:new THREE.CylinderGeometry(.11,.12,.8,7), m:T(.14,.4,0), color:0x2e2a24});
  }
  if(female){
    P.push({geo:new THREE.CylinderGeometry(.30,.50,1.05,10), m:T(0,.92,0), color:acc});       // 裙裳
    P.push({geo:new THREE.ConeGeometry(.55,.75,10), m:T(0,.44,0), color:accD});
  }else{
    P.push({geo:new THREE.CylinderGeometry(.33,.47,1.15,10), m:T(0,.92,0), color:acc});       // 袍身
    P.push({geo:new THREE.CylinderGeometry(.40,.42,.17,10), m:T(0,1.38,0), color:accD});      // 肩背
  }
  P.push({geo:new THREE.CylinderGeometry(.44,.46,.13,10), m:T(0,.74,0), color:0x1f1b16});     // 腰带
  P.push({geo:new THREE.BoxGeometry(.1,.3,.06), m:T(.2,.72,.40), color:GOLD});                // 腰牌
  // 交领右衽
  P.push({geo:new THREE.BoxGeometry(.30,.12,.025), m:T(-.08,1.24,.315,0,0,.5), color:accD});
  P.push({geo:new THREE.BoxGeometry(.30,.12,.025), m:T(.08,1.24,.315,0,0,-.5), color:accD});
  P.push(...weaponParts(h));
  return P;
}

// ---------------- 手臂（肩部枢轴，袖+手） ----------------
function armMesh(acc, side){
  const accD=new THREE.Color(acc).multiplyScalar(.8).getHex();
  const skin=0xc9a071;
  const P=[
    {geo:new THREE.CylinderGeometry(.085,.13,.68,7), m:T(0,-.34,0), color:accD},   // 广袖
    {geo:new THREE.SphereGeometry(.075,6,6), m:T(0,-.72,0), color:skin},           // 手
  ];
  const m=new THREE.Mesh(mergeParts(P), charMat);
  m.castShadow=true;
  const pivot=new THREE.Group();
  pivot.position.set(side*.42, 1.42, 0);
  m.position.set(0,0,0);
  pivot.add(m);
  return pivot;
}

// ---------------- 腿（行走摆动） ----------------
function legMesh(side){
  const P=[
    {geo:new THREE.CylinderGeometry(.11,.12,.82,7), m:T(0,-.41,0), color:0x2e2a24},
    {geo:new THREE.BoxGeometry(.16,.09,.26), m:T(0,-.84,.04), color:0x1c1814},     // 履
  ];
  const m=new THREE.Mesh(mergeParts(P), charMat);
  m.castShadow=true;
  const pivot=new THREE.Group();
  pivot.position.set(side*.14,.82,0);
  pivot.add(m);
  return pivot;
}

// ---------------- 组装 ----------------
// walking=true 时双腿独立可摆（玩家）；否则并入躯干（站桩 NPC）
export function buildCharacter(look, opts={}){
  const H={look};                 // headParts/bodyParts 等以英雄结构取值
  const group=new THREE.Group();
  const acc=look.accent||0x556655;

  const body=new THREE.Mesh(mergeParts(bodyParts(H, opts.walking)), charMat);
  body.castShadow=true; group.add(body);

  const headPivot=new THREE.Group(); headPivot.position.set(0,1.50,0);
  const head=new THREE.Mesh(mergeParts(headParts(H)), charMat);
  head.castShadow=true; headPivot.add(head); group.add(headPivot);

  const armL=armMesh(acc,-1), armR=armMesh(acc,1);
  group.add(armL,armR);

  let legL=null, legR=null;
  if(opts.walking){
    legL=legMesh(-1); legR=legMesh(1);
    group.add(legL,legR);
  }

  const b=look.build;
  if(b) group.scale.set(b.w||1, b.h||1, b.w||1);

  return {group, body, head:headPivot, armL, armR, legL, legR};
}

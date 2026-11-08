// ============================================================
// 水泊梁山 · 主游戏逻辑
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HEROES } from './data/heroes.js';
import { buildWorld, ZONES, getHeight, addCollider, WATER_Y, DECK_FLOORS } from './world.js';
import { drawHeroPortrait, makeLabelTexture } from './portrait.js';
import { buildCharacter } from './rig.js';

// ---------------- 基础 ----------------
const renderer=new THREE.WebGLRenderer({antialias:false, powerPreference:'high-performance'});
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;   // 由 OutputPass 应用
renderer.toneMappingExposure=1.06;
document.getElementById('app').appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xd8c49c, 220, 1100);
const camera=new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 3200);

// 像素预算 + 自适应分辨率（借鉴 moon-rover：总像素封顶 + 帧时 EMA 动态缩放）
const PIXEL_BUDGET=2.6e6;
let renderScale=1, frameEMA=16, governorT=0;
function fitSize(){
  let px=Math.min(devicePixelRatio||1,2);
  const need=innerWidth*innerHeight*px*px;
  if(need>PIXEL_BUDGET) px*=Math.sqrt(PIXEL_BUDGET/need);
  px*=renderScale;
  renderer.setPixelRatio(px);
  renderer.setSize(innerWidth,innerHeight);
  composer.setPixelRatio(px);
  composer.setSize(innerWidth,innerHeight);
}

// HDR 合成管线：线性 HalfFloat 渲染 → bloom 拾取发光体 → ACES + sRGB 输出
const composer=new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth,innerHeight,{
  type:THREE.HalfFloatType, samples:4,
  minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter }));
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), .38, .5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemi=new THREE.HemisphereLight(0xbfd0e4, 0x7a6f4e, 1.0); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe0b0, 2.7);
sun.position.set(180,260,-160);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-90; sun.shadow.camera.right=90;
sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90;
sun.shadow.camera.far=800; sun.shadow.bias=-0.0006; sun.shadow.normalBias=.05;
scene.add(sun, sun.target);

const world=buildWorld(scene);
const colliders=world.colliders;

// ---------------- NPC（骨骼化人物） ----------------
const npcs=[];
function makeNPC(hero){
  const rig=buildCharacter(hero.look);
  const g=rig.group;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:makeLabelTexture(hero.name,hero.nick,'第'+hero.r+'位'), transparent:true, depthWrite:false}));
  label.scale.set(3.4,1.28,1); label.position.y=2.6;
  g.add(label);
  g.userData={hero, label, rig, baseY:0, phase:hero.r*1.7,
    homeYaw:0, yaw:0, headYaw:0,          // 朝向状态
    greetT:-10, drill:hero.zone==='training', forge:hero.zone==='forge'};
  return g;
}
// 防卡墙：把 NPC 推出所有建筑碰撞体（含门墙、亭柱、屋舍）
function resolveStuck(x,z){
  const ox=x, oz=z;
  for(let pass=0;pass<3;pass++){
    let moved=false;
    for(const c of colliders){
      const dx=x-c.x, dz=z-c.z, rr=c.r+1.05; // 身体余量
      const d2=dx*dx+dz*dz;
      if(d2<rr*rr){
        const d=Math.sqrt(d2)||.001;
        x=c.x+dx/d*rr; z=c.z+dz/d*rr; moved=true;
      }
    }
    if(!moved) break;
  }
  // 若被推进水里则保持原位（宁可靠墙站，不下水）
  if(getHeight(x,z)<WATER_Y+.1) return [ox,oz];
  return [x,z];
}
function layoutZone(key, list){
  const Z=ZONES[key];
  const face=Z.face;
  const dir=new THREE.Vector3(Math.sin(face),0,Math.cos(face));
  const right=new THREE.Vector3(dir.z,0,-dir.x);
  list.forEach((h,i)=>{
    const g=makeNPC(h);
    let x,z,ry=face;
    if(h.spot==='roof'){
      const rp=Z.roofSpot||[Z.x,Z.z,13.6];
      x=rp[0]; z=rp[1];
      g.position.set(x, getHeight(x,z)+rp[2], z);
    }else if(Array.isArray(h.spot)){
      x=Z.x+h.spot[0]; z=Z.z+h.spot[1];
    }else{
      const perRow=6, row=Math.floor(i/perRow), col=i%perRow-(Math.min(perRow,list.length)-1)/2;
      const spread=2.6;
      x=Z.x+right.x*col*spread+dir.x*(-row*2.6);
      z=Z.z+right.z*col*spread+dir.z*(-row*2.6);
      const jr=(h.r*37%100)/100-.5, jz=(h.r*53%100)/100-.5;
      x+=jr*1.2; z+=jz*1.2;
    }
    if(h.spot!=='roof'){
      if(Z.floorY===undefined){ [x,z]=resolveStuck(x,z); } // 室内（忠义堂）不参与推挤
      g.position.set(x, Z.floorY!==undefined?Z.floorY:getHeight(x,z), z);
    }
    g.rotation.y=ry;                    // 人物面容建于 +z 侧，face 即朝向
    g.userData.homeYaw=g.userData.yaw=ry;
    scene.add(g); npcs.push(g);
    g.userData.r=h.r; g.userData.hname=h.name; g.userData.zone=key;
    h._obj=g;
  });
}
(function spawnNPCs(){
  const byZone={};
  HEROES.forEach(h=>{ (byZone[h.zone]=byZone[h.zone]||[]).push(h); });
  Object.entries(byZone).forEach(([k,list])=>layoutZone(k,list));
  window.__npcs=npcs; // 调试
  if(location.search.includes('npclog')){
    npcs.forEach(g=>{
      let clear=1e9;
      for(const c of colliders){ if(g.userData.zone==='hall') break; clear=Math.min(clear, Math.hypot(g.position.x-c.x,g.position.z-c.z)-c.r); }
      console.log('[npc]', g.userData.hname, g.userData.zone,
        g.position.x.toFixed(1)+','+g.position.z.toFixed(1), 'clearance='+clear.toFixed(2));
    });
  }
})();

// ---------------- 玩家 ----------------
const playerRig=buildCharacter({face:'fair',beard:'none',head:'wrap',accent:0x3d5a74,weapon:'sword'},{walking:true});
const player=playerRig.group;
// 武松骨骼模型（含走路/跑步动画），加载完成后热替换；失败则保留程序化小人
new GLTFLoader().load('tripo-output/wusong-pixel/tripo_convert_a670f705-3399-4c61-815a-9c0190440a07.glb', gltf=>{
  const model=gltf.scene;
  model.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true;
      if(o.isSkinnedMesh) o.frustumCulled=false;  // 骨骼动画包围盒随动作变化
      const m=o.material;
      if(m){ m.metalness=0; m.roughness=.9; if(m.map){ m.map.anisotropy=4; } }
    }
  });
  const wrap=new THREE.Group();                    // 乘船下沉等作用于此层
  wrap.rotation.y=-Math.PI/2;                      // 该模型本地朝 +x，转到与小人一致的 +z
  wrap.add(model);
  player.clear();
  player.add(wrap);
  // 动画：按时长区分 走(循环较长) / 跑(循环较短)
  const mixer=new THREE.AnimationMixer(model);
  const sorted=[...gltf.animations].sort((a,b)=>b.duration-a.duration);
  const walkC=sorted[0], runC=sorted[sorted.length-1];
  // 记录头/颈骨骼绑定姿态四元数（在 mixer 播放前取，作为每帧修正的基准）
  const boneRefs={ head:model.getObjectByName('Head'), neck:model.getObjectByName('NeckTwist01') };
  if(boneRefs.head) boneRefs.headQ=boneRefs.head.quaternion.clone();
  if(boneRefs.neck) boneRefs.neckQ=boneRefs.neck.quaternion.clone();
  // 骨骼模型渲染尺寸以动画姿态为准（绑定网格包围盒可能与骨架缩放不一致）：
  // 临时归零玩家变换，播第 0 帧，量取蒙皮包围盒后归一化到 1.9m
  const saveP=player.position.clone(), saveY=player.rotation.y;
  player.position.set(0,0,0); player.rotation.set(0,0,0);
  mixer.clipAction(walkC).play(); mixer.update(0);
  player.updateMatrixWorld(true);
  const bb=new THREE.Box3();
  model.traverse(o=>{ if(o.isSkinnedMesh){ o.computeBoundingBox(); bb.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  if(bb.isEmpty()) bb.setFromObject(model);
  const size=bb.getSize(new THREE.Vector3()), ctr=bb.getCenter(new THREE.Vector3());
  const s=1.9/size.y;
  wrap.scale.setScalar(s);
  model.position.set(-ctr.x, -bb.min.y, -ctr.z); // 脚底贴地、中心对齐
  player.position.copy(saveP); player.rotation.y=saveY;
  playerRig.legL=playerRig.legR=playerRig.armL=playerRig.armR=playerRig.head=null;
  playerRig.body=wrap;
  playerRig.glb=true; playerRig.mixer=mixer; playerRig.runW=0;
  playerRig.bones=boneRefs;
  playerRig.actWalk=mixer.clipAction(walkC); playerRig.actRun=mixer.clipAction(runC);
  playerRig.actWalk.play(); playerRig.actRun.play(); playerRig.actRun.setEffectiveWeight(0);
}, undefined, err=>console.error('玩家模型加载失败，保留默认小人', err));
// 抬头修正：动画帧含低头姿态，在 mixer 覆写骨骼后追加局部旋转
function fixHeadUpReset(){
  const bn=playerRig.bones; if(!bn) return;
  if(bn.head&&bn.headQ) bn.head.quaternion.copy(bn.headQ);
  if(bn.neck&&bn.neckQ) bn.neck.quaternion.copy(bn.neckQ);
}
function fixHeadUp(){
  const bn=playerRig.bones; if(!bn||!bn.head) return;
  bn.head.rotateX(.20);
  if(bn.neck) bn.neck.rotateX(.06);
}
// 静止专用：头颈直接钉回绑定姿态（站直平视），不依赖定格帧的动画姿势
function fixHeadUpIdle(){
  const bn=playerRig.bones; if(!bn||!bn.head||!bn.headQ) return fixHeadUp();
  bn.head.quaternion.copy(bn.headQ); bn.head.rotateX(.1);
  if(bn.neck&&bn.neckQ){ bn.neck.quaternion.copy(bn.neckQ); bn.neck.rotateX(.05); }
}
const playerBoat=(function(){
  // 玩家小船（水泊摆渡）
  const hull=new THREE.Mesh(new THREE.BoxGeometry(1.7,.6,5.2),new THREE.MeshStandardMaterial({color:0x4a3018,roughness:.9}));
  hull.position.y=.1;
  const prow=new THREE.Mesh(new THREE.ConeGeometry(.85,1.6,4),new THREE.MeshStandardMaterial({color:0x4a3018,roughness:.9}));
  prow.rotation.x=Math.PI/2; prow.rotation.z=Math.PI/4; prow.scale.set(1,1,.5); prow.position.set(0,.15,2.9);
  const canopy=new THREE.Mesh(new THREE.CylinderGeometry(.78,.78,1.9,10,1,false,0,Math.PI),new THREE.MeshStandardMaterial({color:0x8f7a3a,roughness:1}));
  canopy.rotation.z=Math.PI/2; canopy.rotation.y=Math.PI/2; canopy.position.set(0,.62,.9);
  // 船尾竹篙
  const poleM=new THREE.Mesh(new THREE.CylinderGeometry(.028,.028,2.6,5),new THREE.MeshStandardMaterial({color:0x6e5a30,roughness:1}));
  poleM.position.set(-.5,.9,-1.9); poleM.rotation.z=.24; poleM.rotation.x=-.3;
  const g=new THREE.Group(); g.add(hull,prow,canopy,poleM); g.visible=false;
  scene.add(g); return g;
})();
player.position.set(world.spawn.x, 0, world.spawn.z);
player.rotation.y=Math.PI;   // 初始背对镜头（面北望泊）
scene.add(player);

// ---------------- 控制 ----------------
const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyE') tryInteract();
  if(e.code==='KeyM') toggleMap();
  if(e.code==='KeyH') toggleHelp();
  if(e.code==='Escape'){ closeDialog(); closeMap(); }
});
addEventListener('keyup',e=>keys[e.code]=false);
let camYaw=0, camPitch=.34, camDist=13;
let dragging=false, lastX=0,lastY=0;
const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;});
addEventListener('pointerup',()=>dragging=false);
addEventListener('pointermove',e=>{
  if(!dragging||dialogOpen) return;
  camYaw-=(e.clientX-lastX)*.0045; camPitch+=(e.clientY-lastY)*.003;
  camPitch=Math.max(.08,Math.min(1.15,camPitch));
  lastX=e.clientX;lastY=e.clientY;
});
addEventListener('wheel',e=>{ camDist=Math.max(6,Math.min(30,camDist+e.deltaY*.012)); },{passive:true});

// ---------------- 对话 ----------------
const dlg=document.getElementById('dialog');
const dlgPortrait=document.getElementById('dlg-portrait');
const dlgName=document.getElementById('dlg-name');
const dlgMeta=document.getElementById('dlg-meta');
const dlgText=document.getElementById('dlg-text');
const dlgHint=document.getElementById('dlg-hint');
let dialogOpen=false, dlgPages=[], dlgPage=0, dlgChar=0, dlgTimer=null, currentHero=null;
const metHeroes=new Set();

const portraitCache={}; // name -> {ok, url}
function loadPortrait(hero, cb){
  const cached=portraitCache[hero.name];
  if(cached!==undefined){ cb(cached); return; }
  const img=new Image();
  const url='assets/portraits/'+encodeURIComponent(hero.name)+'.jpg';
  img.onload=()=>{ portraitCache[hero.name]=url; cb(url); };
  img.onerror=()=>{ portraitCache[hero.name]=null; cb(null); };
  img.src=url;
}
function openDialog(hero){
  dialogOpen=true; currentHero=hero;
  metHeroes.add(hero.name);
  document.getElementById('met-count').textContent=metHeroes.size;
  dlgPages=[hero.greet, ...hero.story, '（'+hero.name+'拱手还礼）客官慢走，山寨之大，列位弟兄各有故事，不妨都去拜会一番。'];
  dlgPage=0;
  // 头像：优先真实绣像（陈洪绶《水浒叶子》），否则程序化水墨
  dlgPortrait.innerHTML='';
  dlgPortrait.appendChild(drawHeroPortrait(hero,220));
  loadPortrait(hero,(url)=>{
    if(url && currentHero===hero){
      dlgPortrait.innerHTML='';
      const img=new Image(); img.src=url; img.alt=hero.name;
      dlgPortrait.appendChild(img);
      dlgMeta.textContent=hero.star+' · 座次第'+hero.r+'位 · '+(hero.title||'')+' · 绣像：明·陈洪绶《水浒叶子》';
    }
  });
  dlgName.textContent=hero.nick+' · '+hero.name;
  dlgMeta.textContent=hero.star+' · 座次第'+hero.r+'位 · '+(hero.title||'');
  dlg.classList.add('open');
  startTyping();
  playVO(hero.r,0);
}
function startTyping(){
  clearInterval(dlgTimer); dlgChar=0;
  const text=dlgPages[dlgPage];
  dlgText.textContent='';
  dlgTimer=setInterval(()=>{
    dlgChar++;
    dlgText.textContent=text.slice(0,dlgChar);
    if(dlgChar>=text.length){ clearInterval(dlgTimer); dlgHint.textContent=(dlgPage<dlgPages.length-1?'E / 点击 — 下一篇':'E / 点击 — 结束'); }
  },14);
  dlgHint.textContent='…';
}
function nextDialog(){
  if(!dialogOpen) return;
  const text=dlgPages[dlgPage];
  if(dlgChar<text.length){ clearInterval(dlgTimer); dlgChar=text.length; dlgText.textContent=text; dlgHint.textContent=(dlgPage<dlgPages.length-1?'E / 点击 — 下一篇':'E / 点击 — 结束'); return; }
  if(dlgPage<dlgPages.length-1){ dlgPage++; startTyping(); playVO(currentHero.r, dlgPage<dlgPages.length-1?dlgPage:-1); }
  else closeDialog();
}
function closeDialog(){
  if(!dialogOpen) return;
  dialogOpen=false; clearInterval(dlgTimer);
  dlg.classList.remove('open');
  voAudio.pause(); bgmDuck=false;
}
dlg.addEventListener('click',nextDialog);

// ---------------- 交互 ----------------
const prompt=document.getElementById('interact-prompt');
let nearNPC=null;
function updateInteract(){
  nearNPC=null;
  if(dialogOpen){ prompt.style.opacity=0; return; }
  let best=4.6;
  for(const g of npcs){
    const d=Math.hypot(g.position.x-player.position.x, g.position.z-player.position.z);
    if(d<best){ best=d; nearNPC=g; }
  }
  if(nearNPC){
    const h=nearNPC.userData.hero;
    prompt.innerHTML='<b>E</b> 与 '+h.nick+' '+h.name+' 交谈';
    prompt.style.opacity=1;
  } else { prompt.style.opacity=0; prompt.innerHTML=''; }
}
function tryInteract(){
  if(dialogOpen){ nextDialog(); return; }
  if(nearNPC) openDialog(nearNPC.userData.hero);
}

// ---------------- 地名横幅 ----------------
const banner=document.getElementById('loc-banner');
const bannerTitle=document.getElementById('loc-title');
const bannerSub=document.getElementById('loc-sub');
let curZone='', bannerTimer=null;
function updateZone(){
  let found='', bestDepth=-Infinity;
  for(const [k,Z] of Object.entries(ZONES)){
    const depth=Z.r-Math.hypot(player.position.x-Z.x, player.position.z-Z.z);
    if(depth>0 && depth>bestDepth){ bestDepth=depth; found=k; }
  }
  if(found && found!==curZone){
    curZone=found;
    bannerTitle.textContent=ZONES[found].label;
    bannerSub.textContent=ZONES[found].sub;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer=setTimeout(()=>banner.classList.remove('show'),3200);
  } else if(!found) curZone='';
  setZoneBGM(found||'');
}

// ---------------- 地图 ----------------
const mapCanvas=document.getElementById('minimap');
const mctx=mapCanvas.getContext('2d');
const WORLD=1120, MAPB=800;          // 底图覆盖 ±560 世界单位，800px 分辨率
let mapBase=null;
function buildMapBase(){
  const c=document.createElement('canvas'); c.width=c.height=MAPB;
  const g=c.getContext('2d');
  g.fillStyle='#3d5a66'; g.fillRect(0,0,MAPB,MAPB);
  const N=400;
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const wx=-560+i/N*WORLD, wz=-560+j/N*WORLD;
    const h=getHeight(wx,wz);
    if(h>2.6) g.fillStyle='#77906b';
    else if(h>WATER_Y+.45) g.fillStyle='#a89a6a';
    else if(h>WATER_Y-.5) g.fillStyle='#5d7d6e';
    else g.fillStyle='#41626e';
    g.fillRect(i/N*MAPB,j/N*MAPB,MAPB/N+.5,MAPB/N+.5);
  }
  mapBase=c;
}
buildMapBase();
const fullMap=document.getElementById('fullscreen-map');
const fctx=fullMap.getContext('2d');
let mapOpen=false;
function w2m(x,z,S){ return [(x+560)/WORLD*S, (z+560)/WORLD*S]; }

// 局部小地图：以玩家为中心放大
function drawMiniMap(){
  const S=200, RANGE=130;                       // 显示半径（世界单位）
  const px=(player.position.x+560)/WORLD*MAPB;
  const py=(player.position.z+560)/WORLD*MAPB;
  const win=RANGE*2/WORLD*MAPB;                 // 底图上的窗口像素
  mctx.clearRect(0,0,S,S);
  mctx.save();
  mctx.beginPath(); mctx.arc(S/2,S/2,S/2-3,0,7); mctx.clip();
  mctx.drawImage(mapBase, px-win/2, py-win/2, win, win, 0, 0, S, S);
  const k=S/(RANGE*2);                          // 世界单位→像素
  // 建筑 + 就近地名
  for(const Z of Object.values(ZONES)){
    const dx=Z.x-player.position.x, dz=Z.z-player.position.z;
    if(Math.abs(dx)>RANGE||Math.abs(dz)>RANGE) continue;
    const mx=S/2+dx*k, my=S/2+dz*k;
    mctx.fillStyle='rgba(60,40,26,.9)';
    mctx.fillRect(mx-3.4,my-3.4,6.8,6.8);
    mctx.strokeStyle='rgba(201,160,58,.95)'; mctx.lineWidth=1.4;
    mctx.strokeRect(mx-3.4,my-3.4,6.8,6.8);
    mctx.font='12px "Kaiti SC","STKaiti","KaiTi",serif';
    mctx.textAlign='center';
    mctx.lineWidth=3; mctx.strokeStyle='rgba(20,16,10,.75)';
    mctx.strokeText(Z.label,mx,my-7);
    mctx.fillStyle='#f0e2c4'; mctx.fillText(Z.label,mx,my-7);
  }
  // NPC
  mctx.fillStyle='#c9503a';
  for(const g of npcs){
    const dx=g.position.x-player.position.x, dz=g.position.z-player.position.z;
    if(Math.abs(dx)>RANGE||Math.abs(dz)>RANGE) continue;
    mctx.beginPath(); mctx.arc(S/2+dx*k,S/2+dz*k,2.2,0,7); mctx.fill();
  }
  mctx.restore();
  // 玩家箭头（随人物朝向）
  mctx.save(); mctx.translate(S/2,S/2);
  mctx.rotate(Math.PI-player.rotation.y);
  mctx.fillStyle='#4e8ae0'; mctx.strokeStyle='#0e1c30'; mctx.lineWidth=1.5;
  mctx.beginPath(); mctx.moveTo(0,-8); mctx.lineTo(5.5,6); mctx.lineTo(0,3); mctx.lineTo(-5.5,6); mctx.closePath();
  mctx.fill(); mctx.stroke();
  mctx.restore();
  // 北向
  mctx.font='bold 13px "Kaiti SC","STKaiti",serif'; mctx.textAlign='center';
  mctx.fillStyle='#f0e2c4'; mctx.strokeStyle='rgba(20,16,10,.8)'; mctx.lineWidth=3;
  mctx.strokeText('北',S/2,15); mctx.fillText('北',S/2,15);
}
// 全屏全图（竖版核心区：x∈[-330,330] z∈[-230,510]）
const FW=720, FH=800;
const FX0=-330, FX1=330, FZ0=-230, FZ1=510;
function w2mF(x,z){ return [(x-FX0)/(FX1-FX0)*FW, (z-FZ0)/(FZ1-FZ0)*FH]; }
function drawFullMap(){
  fctx.clearRect(0,0,FW,FH);
  // 从 ±560 底图裁出核心区
  const sx=(FX0+560)/WORLD*MAPB, sy=(FZ0+560)/WORLD*MAPB;
  const sw=(FX1-FX0)/WORLD*MAPB, sh=(FZ1-FZ0)/WORLD*MAPB;
  fctx.drawImage(mapBase, sx,sy,sw,sh, 0,0,FW,FH);
  fctx.strokeStyle='rgba(201,160,58,.5)'; fctx.lineWidth=2; fctx.strokeRect(1,1,FW-2,FH-2);
  // NPC 红点
  fctx.fillStyle='#c9503a'; fctx.strokeStyle='rgba(120,30,20,.55)'; fctx.lineWidth=1;
  for(const g of npcs){
    if(g.position.x<FX0||g.position.x>FX1||g.position.z<FZ0||g.position.z>FZ1) continue;
    const [mx,my]=w2mF(g.position.x,g.position.z);
    fctx.beginPath(); fctx.arc(mx,my,3,0,7); fctx.fill(); fctx.stroke();
  }
  // 据点注记（自动防重叠 + 引线）
  const rects=[];
  const overlaps=(x,y,w,h)=>rects.some(r=>x<r.x+r.w&&x+w>r.x&&y<r.y+r.h&&y+h>r.y);
  fctx.font='16px "Kaiti SC","STKaiti","KaiTi",serif';
  fctx.textAlign='left'; fctx.textBaseline='middle';
  for(const Z of Object.values(ZONES)){
    if(Z.x<FX0||Z.x>FX1||Z.z<FZ0||Z.z>FZ1) continue;
    const [mx,my]=w2mF(Z.x,Z.z);
    fctx.fillStyle='rgba(60,40,26,.9)'; fctx.fillRect(mx-5,my-5,10,10);
    fctx.strokeStyle='rgba(201,160,58,.95)'; fctx.lineWidth=1.6; fctx.strokeRect(mx-5,my-5,10,10);
    const w=Z.label.length*16, h=18;
    const offs=[[10,-14],[10,10],[-w-10,-14],[-w-10,10],[0,-26],[0,20],[18,0],[-w-18,0]];
    let lx=mx+10, ly=my-14, ok=false;
    for(const [ox,oy] of offs){ const tx=mx+ox, ty=my+oy;
      if(tx>4&&tx+w<FW-4&&ty>24&&ty+18<FH-30&&!overlaps(tx,ty,w,h)){ lx=tx; ly=ty; ok=true; break; } }
    if(!ok){ // 兜底：垂直向下找空位
      for(let d=30;d<FH;d+=22){ if(!overlaps(mx+10,my+d,w,h)){ lx=mx+10; ly=my+d; break; } }
    }
    rects.push({x:lx,y:ly,w,h});
    fctx.strokeStyle='rgba(201,160,58,.55)'; fctx.lineWidth=1;
    fctx.beginPath(); fctx.moveTo(mx,my); fctx.lineTo(lx+(lx>mx?0:w),ly+h/2); fctx.stroke();
    fctx.strokeStyle='rgba(20,16,10,.85)'; fctx.lineWidth=4; fctx.strokeText(Z.label,lx,ly+h/2);
    fctx.fillStyle='#f5e8cc'; fctx.fillText(Z.label,lx,ly+h/2);
  }
  // 玩家箭头
  let [px,py]=w2mF(player.position.x,player.position.z);
  px=Math.min(FW-12,Math.max(12,px)); py=Math.min(FH-12,Math.max(12,py));
  fctx.save(); fctx.translate(px,py);
  fctx.rotate(Math.PI-player.rotation.y);
  fctx.fillStyle='#4e8ae0'; fctx.strokeStyle='#0e1c30'; fctx.lineWidth=2;
  fctx.beginPath(); fctx.moveTo(0,-11); fctx.lineTo(8,9); fctx.lineTo(0,4.5); fctx.lineTo(-8,9); fctx.closePath();
  fctx.fill(); fctx.stroke();
  fctx.restore();
  // 标题 / 图例 / 指北
  fctx.textAlign='center'; fctx.textBaseline='alphabetic';
  fctx.font='26px "Kaiti SC","STKaiti","KaiTi",serif';
  fctx.strokeStyle='rgba(20,16,10,.85)'; fctx.lineWidth=5; fctx.strokeText('梁 山 泊 舆 图',FW/2,34);
  fctx.fillStyle='#f0e2c4'; fctx.fillText('梁 山 泊 舆 图',FW/2,34);
  fctx.font='13px "Kaiti SC","STKaiti",serif'; fctx.textAlign='right';
  fctx.fillStyle='#c9503a'; fctx.beginPath(); fctx.arc(FW-116,FH-20,3.5,0,7); fctx.fill();
  fctx.fillStyle='#e8dcc0'; fctx.fillText('好汉',FW-84,FH-15);
  fctx.fillStyle='#4e8ae0'; fctx.beginPath(); fctx.moveTo(FW-64,FH-27); fctx.lineTo(FW-57,FH-14); fctx.lineTo(FW-64,FH-18); fctx.lineTo(FW-71,FH-14); fctx.closePath(); fctx.fill();
  fctx.fillStyle='#e8dcc0'; fctx.fillText('你',FW-48,FH-15);
  fctx.textAlign='center'; fctx.font='bold 22px "Kaiti SC","STKaiti",serif';
  fctx.strokeStyle='rgba(20,16,10,.85)'; fctx.lineWidth=4; fctx.strokeText('北',FW/2,26+18);
  fctx.fillStyle='#f5e8cc'; fctx.fillText('北',FW/2,26+18);
}
function toggleMap(){
  mapOpen=!mapOpen;
  fullMap.style.display=mapOpen?'block':'none';
  document.getElementById('map-tip').style.display=mapOpen?'block':'none';
}
function closeMap(){ if(mapOpen) toggleMap(); }

// ---------------- 音效 / 配乐 / 配音 ----------------
let audioOn=false, actx=null, master=null;
function initAudio(){
  actx=new (window.AudioContext||window.webkitAudioContext)();
  master=actx.createGain(); master.gain.value=.5; master.connect(actx.destination);
  // 水声
  const nb=actx.createBuffer(1,actx.sampleRate*2,actx.sampleRate);
  const d=nb.getChannelData(0); let last=0;
  for(let i=0;i<d.length;i++){ const w=Math.random()*2-1; last=(last+.02*w)/1.02; d[i]=last*3.5; }
  const src=actx.createBufferSource(); src.buffer=nb; src.loop=true;
  const lp=actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420;
  const g=actx.createGain(); g.gain.value=.16;
  src.connect(lp).connect(g).connect(master); src.start();
  // 风
  const src2=actx.createBufferSource(); src2.buffer=nb; src2.loop=true; src2.playbackRate.value=.5;
  const bp=actx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=700; bp.Q.value=.6;
  const g2=actx.createGain(); g2.gain.value=.05;
  src2.connect(bp).connect(g2).connect(master); src2.start();
  const lfo=actx.createOscillator(); lfo.frequency.value=.13;
  const lg=actx.createGain(); lg.gain.value=280;
  lfo.connect(lg).connect(bp.frequency); lfo.start();
  audioOn=true;
  // 雁鸣
  (function gullLoop(){
    if(!audioOn) return;
    const o=actx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(1350,actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(820,actx.currentTime+.28);
    const env=actx.createGain();
    env.gain.setValueAtTime(0,actx.currentTime);
    env.gain.linearRampToValueAtTime(.03,actx.currentTime+.03);
    env.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.34);
    o.connect(env).connect(master); o.start(); o.stop(actx.currentTime+.4);
    setTimeout(gullLoop, 9000+Math.random()*20000);
  })();
}
document.getElementById('audio-btn').addEventListener('click',()=>{
  if(!actx){ initAudio(); document.getElementById('audio-btn').textContent='♪ 音效：开'; }
  else { audioOn=!audioOn; master.gain.value=audioOn?.5:0; document.getElementById('audio-btn').textContent=audioOn?'♪ 音效：开':'♪ 音效：关'; }
});

// ---- 背景配乐（探索 / 忠义堂 双曲交叉淡化）----
const bgmMain=new Audio('assets/audio/bgm-main.mp3');
const bgmHall=new Audio('assets/audio/bgm-hall.mp3');
[bgmMain,bgmHall].forEach(a=>{ a.loop=true; a.volume=0; a.preload='auto'; });
let bgmOn=true, bgmTarget='main', bgmDuck=false, bgmStarted=false;
function bgmStart(){
  if(bgmStarted) return; bgmStarted=true;
  bgmMain.play().catch(()=>{}); bgmHall.play().catch(()=>{});
  document.getElementById('bgm-btn').textContent='♫ 配乐：开';
}
function setZoneBGM(zone){ bgmTarget=(zone==='hall')?'hall':'main'; }
function updateBGM(){
  const duck=bgmDuck?.28:1;
  const tm=bgmOn?(bgmTarget==='main'?.34*duck:0):0;
  const th=bgmOn?(bgmTarget==='hall'?.42*duck:0):0;
  bgmMain.volume+=(tm-bgmMain.volume)*.02;
  bgmHall.volume+=(th-bgmHall.volume)*.02;
}
document.getElementById('bgm-btn').addEventListener('click',()=>{
  bgmStart();
  bgmOn=!bgmOn;
  document.getElementById('bgm-btn').textContent=bgmOn?'♫ 配乐：开':'♫ 配乐：关';
});

// ---- 对话配音（按页播放，无文件自动静默）----
const voAudio=new Audio();
voAudio.addEventListener('play',()=>{ bgmDuck=true; });
voAudio.addEventListener('ended',()=>{ bgmDuck=false; });
voAudio.addEventListener('error',()=>{ bgmDuck=false; });
function playVO(rank,page){
  voAudio.pause();
  if(page<0) return;
  voAudio.src='assets/audio/vo/'+rank+'_'+page+'.mp3';
  voAudio.play().catch(()=>{ bgmDuck=false; });
}

// ---------------- 帮助 ----------------
const helpPanel=document.getElementById('help');
function toggleHelp(){ helpPanel.style.display=helpPanel.style.display==='block'?'none':'block'; }

// ---------------- 移动与物理 ----------------
const vel=new THREE.Vector3();
let onWater=false, moving=false, walkPhase=0, wakeT=0;
// 忠义堂台基地板（堂内高台 + 台阶过渡）
const FLOORS=[
  {x0:-21,x1:21,z0:-16,z1:12.5,y:42.35},
  {x0:-7,x1:7,z0:12.5,z1:15,y:41.5},
  {x0:-7,x1:7,z0:15,z1:17,y:40.8},
];
function floorAt(x,z){
  let y=-Infinity;
  for(const f of FLOORS) if(x>f.x0&&x<f.x1&&z>f.z0&&z<f.z1) y=Math.max(y,f.y);
  for(const f of DECK_FLOORS) if(x>f.x0&&x<f.x1&&z>f.z0&&z<f.z1) y=Math.max(y,f.y);
  return y;
}
function groundAt(x,z){ return Math.max(getHeight(x,z), floorAt(x,z)); }
function updatePlayer(dt){
  if(dialogOpen||mapOpen){ moving=false; return; }
  const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
  const r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  moving=(f!==0||r!==0);
  const run=keys.ShiftLeft||keys.ShiftRight;
  const h=groundAt(player.position.x,player.position.z);
  onWater=h<WATER_Y+.12;
  let speed=onWater?15:(run?13:7);
  if(!onWater){
    const hx=(getHeight(player.position.x+1,player.position.z)-getHeight(player.position.x-1,player.position.z))/2;
    const hz=(getHeight(player.position.x,player.position.z+1)-getHeight(player.position.x,player.position.z-1))/2;
    const slope=Math.hypot(hx,hz);
    if(slope>.85) speed*=Math.max(.25,1.15-slope*.6);
  }
  if(moving){
    const dir=new THREE.Vector3();
    const cy=camYaw;
    dir.x=(Math.sin(cy)*-f + Math.cos(cy)*r);
    dir.z=(Math.cos(cy)*-f - Math.sin(cy)*r);
    dir.normalize().multiplyScalar(speed*dt);
    player.position.add(dir);
    player.rotation.y=Math.atan2(dir.x,dir.z);
    walkPhase+=dt*(run?11:7);
  }
  // 边界
  const dCenter=Math.hypot(player.position.x,player.position.z+30);
  if(dCenter>720){ const k=720/dCenter; player.position.x*=k; player.position.z*=k; }
  // 碰撞
  for(const c of colliders){
    const dx=player.position.x-c.x, dz=player.position.z-c.z;
    const d=Math.hypot(dx,dz), min=c.r+.55;
    if(d<min && d>0.0001){ const push=(min-d); player.position.x+=dx/d*push; player.position.z+=dz/d*push; }
  }
  // 高度/船
  const h2=groundAt(player.position.x,player.position.z);
  const targetY=onWater? (WATER_Y+.5+Math.sin(clockT*1.6)*.09) : h2;
  player.position.y+=(targetY-player.position.y)*Math.min(1,dt*8);
  playerBoat.visible=onWater;
  if(onWater){
    playerBoat.position.set(player.position.x,player.position.y-.62,player.position.z);
    playerBoat.rotation.y=player.rotation.y;
    playerBoat.position.y+=Math.sin(clockT*1.3)*.07;
    playerBoat.rotation.z=Math.sin(clockT*.9)*.03;
    // 行船尾迹
    wakeT-=dt;
    if(moving&&wakeT<0){
      wakeT=.4;
      world.spawnRipple(player.position.x-Math.sin(player.rotation.y)*2.2,
                        player.position.z-Math.cos(player.rotation.y)*2.2, .9);
    }
  }
  // 步态：双腿对摆、双臂随摆、身体起伏
  if(playerRig.legL){
    const sw=moving&&!onWater? Math.sin(walkPhase):0;
    const amp=keys.ShiftLeft||keys.ShiftRight?.68:.48;
    playerRig.legL.rotation.x=sw*amp;
    playerRig.legR.rotation.x=-sw*amp;
    playerRig.armL.rotation.x=-sw*amp*.75 + (onWater?-.9:Math.sin(clockT*1.8)*.05);
    playerRig.armR.rotation.x=sw*amp*.75 + (onWater?-.9:Math.sin(clockT*1.8+2)*.05);
    playerRig.body.position.y=moving&&!onWater? Math.abs(Math.cos(walkPhase))*.055:0;
    playerRig.legL.visible=playerRig.legR.visible=!onWater;   // 船上立桨，腿隐于船体
  }else if(playerRig.glb){ // 骨骼模型：走/跑动画权重渐变；静止时定格站立帧
    const wk=playerRig.actWalk, rn=playerRig.actRun;
    if(moving){
      playerRig.idleFrozen=false;
      wk.paused=false;
      const wantRun=!onWater&&(keys.ShiftLeft||keys.ShiftRight);
      playerRig.runW+=((wantRun?1:0)-playerRig.runW)*Math.min(1,dt*6);
      rn.setEffectiveWeight(playerRig.runW); wk.setEffectiveWeight(1-playerRig.runW);
      wk.timeScale=1; rn.timeScale=1;
      fixHeadUpReset();
      playerRig.mixer.update(dt);
      fixHeadUp();
    }else if(!playerRig.idleFrozen){
      playerRig.idleFrozen=true; playerRig.runW=0;
      rn.setEffectiveWeight(0); wk.setEffectiveWeight(1);
      wk.time=playerRig.freezeT||0; wk.paused=true; // 定格走路循环中的站立帧
      fixHeadUpReset();
      playerRig.mixer.update(0);
      fixHeadUpIdle();
    }
    playerRig.body.position.y=onWater? -.32:0;   // 乘船下沉坐稳
    playerRig.body.rotation.x=0;
  }else if(playerRig.body){ // GLB 模型：拆出的小腿摆动 + 行走起伏；乘船时收腿下沉
    const sw=moving&&!onWater? Math.sin(walkPhase):0;
    const amp=keys.ShiftLeft||keys.ShiftRight?.6:.42;
    if(playerRig.glbLegL){
      playerRig.glbLegL.rotation.x=sw*amp;
      playerRig.glbLegR.rotation.x=-sw*amp;
      playerRig.glbLegL.visible=playerRig.glbLegR.visible=!onWater; // 船上腿隐于船体
    }
    playerRig.body.position.y=onWater? -.32 : (moving? Math.abs(Math.cos(walkPhase))*.05:0);
    playerRig.body.rotation.x=moving&&!onWater? .05:0;
  }
}
let camInit=false, camDistCur=13, dlgYaw=0;
function updateCamera(dt){
  // 对话时：推近至过肩视角，对准交谈的好汉（侧移让出 NPC）
  let lookX=player.position.x, lookZ=player.position.z, lookY=player.position.y+1.7, sideOff=0;
  if(dialogOpen&&currentHero&&currentHero._obj){
    const o=currentHero._obj.position;
    dlgYaw=Math.atan2(player.position.x-o.x, player.position.z-o.z);
    let dy=dlgYaw-camYaw; while(dy>Math.PI)dy-=6.283; while(dy<-Math.PI)dy+=6.283;
    camYaw+=dy*Math.min(1,dt*2.2);
    lookX=player.position.x*.35+o.x*.65; lookZ=player.position.z*.35+o.z*.65;
    lookY=player.position.y*.4+(o.y+1.5)*.6;
    sideOff=1.35;
  }
  camDistCur+=((dialogOpen?5.6:camDist)-camDistCur)*Math.min(1,dt*4);
  const cx=player.position.x+Math.sin(camYaw)*Math.cos(camPitch)*camDistCur+Math.cos(camYaw)*sideOff;
  const cz=player.position.z+Math.cos(camYaw)*Math.cos(camPitch)*camDistCur-Math.sin(camYaw)*sideOff;
  let cy=player.position.y+1.6+Math.sin(camPitch)*camDistCur;
  const gh=getHeight(cx,cz)+1.4;
  if(cy<gh) cy=gh;
  if(!camInit){ camera.position.set(cx,cy,cz); camInit=true; }
  camera.position.lerp(new THREE.Vector3(cx,cy,cz), Math.min(1,dt*7));
  camera.lookAt(lookX,lookY,lookZ);
  // 太阳跟随（阴影覆盖）
  sun.position.set(player.position.x+180, 260, player.position.z-160);
  sun.target.position.copy(player.position);
}

// ---------------- UI 引导 ----------------
const hint3=document.getElementById('interact-hint');
setTimeout(()=>hint3&&hint3.classList.add('fade'), 14000);

// ---------------- 主循环 ----------------
const clock=new THREE.Clock();
let clockT=0;
let mmTick=0;
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,clock.getDelta());
  clockT+=dt;
  updatePlayer(dt);
  updateCamera(dt);
  updateInteract();
  updateZone();
  // NPC 行为动画：呼吸 / 转头看人 / 拱手见礼 / 演武操练 / 锻打
  for(let i=0;i<npcs.length;i++){
    const g=npcs[i], u=g.userData, rig=u.rig;
    const b=u.baseY||g.position.y; u.baseY=b;
    const dx=player.position.x-g.position.x, dz=player.position.z-g.position.z;
    const distP=Math.hypot(dx,dz);
    u.label.material.opacity=Math.min(1, Math.max(0, 1.6-distP/34));
    u.label.visible=distP<60;
    if(distP>75) continue;                       // 远处省算力
    const k=Math.min(1,dt*6);
    const talking=dialogOpen&&currentHero===u.hero;
    // 呼吸起伏
    g.position.y=b+Math.sin(clockT*1.8+u.phase)*.035;
    // 身体朝向：近则转身迎客，远则归位
    let yawT=u.homeYaw;
    if(distP<9||talking) yawT=Math.atan2(dx,dz);
    let dy=yawT-u.yaw; while(dy>Math.PI)dy-=6.283; while(dy<-Math.PI)dy+=6.283;
    u.yaw+=dy*k*.8; g.rotation.y=u.yaw;
    // 头：看人（限幅）或闲顾
    let headT=0;
    if(distP<13){ headT=Math.atan2(dx,dz)-u.yaw; while(headT>Math.PI)headT-=6.283; while(headT<-Math.PI)headT+=6.283; headT=Math.max(-1,Math.min(1,headT)); }
    else headT=Math.sin(clockT*.23+u.phase)*.35;
    u.headYaw+=(headT-u.headYaw)*k; rig.head.rotation.y=u.headYaw;
    // 手臂
    let aLx=Math.sin(clockT*1.6+u.phase)*.06, aRx=-Math.sin(clockT*1.6+u.phase)*.06, aLz=0, aRz=0, lean=0;
    if(talking){                                 // 拱手还礼
      aLx=aRx=-1.15; aLz=.5; aRz=-.5; lean=.09+Math.sin(clockT*1.2)*.02;
    }else if(u.drill){                           // 演武场操练
      const c=clockT*2.4+u.phase;
      aRx=-1.3+Math.sin(c)*.9; aLx=-.5+Math.cos(c*.5)*.3;
    }else if(u.forge){                           // 铁匠锻打
      aRx=-.7-Math.abs(Math.sin(clockT*3.2+u.phase))*.7;
      aLx=-.4;
    }
    rig.armL.rotation.x+=(aLx-rig.armL.rotation.x)*k;
    rig.armR.rotation.x+=(aRx-rig.armR.rotation.x)*k;
    rig.armL.rotation.z+=(aLz-rig.armL.rotation.z)*k;
    rig.armR.rotation.z+=(aRz-rig.armR.rotation.z)*k;
    rig.body.rotation.x+=(lean-rig.body.rotation.x)*k;
    rig.head.rotation.x+=(lean*.9-rig.head.rotation.x)*k;
  }
  for(const a of world.animated) a.fn(clockT,dt);
  // 小地图每4帧
  if(++mmTick%4===0 && !mapOpen) drawMiniMap();
  if(mapOpen) drawFullMap();
  updateBGM();
  // 自适应分辨率：帧时 EMA 超预算降 renderScale，宽裕则升
  frameEMA=frameEMA*.92+dt*1000*.08;
  governorT+=dt;
  if(governorT>1.2){
    governorT=0;
    if(frameEMA>24&&renderScale>.62){ renderScale-=.08; fitSize(); }
    else if(frameEMA<14&&renderScale<1){ renderScale=Math.min(1,renderScale+.05); fitSize(); }
  }
  composer.render();
}

// ---------------- 调试传送（?tp=x,z） ----------------
window.__tp=(x,z)=>{ player.position.set(x,groundAt(x,z),z); };
const __qs=new URLSearchParams(location.search);
{
  const tp=__qs.get('tp');
  if(tp){ const [x,z]=tp.split(',').map(Number); if(isFinite(x)&&isFinite(z)) window.__tp(x,z); }
  const yaw=+(__qs.get('yaw')||'NaN');
  if(isFinite(yaw)) camYaw=yaw;
}

// ---------------- 启动 ----------------
const title=document.getElementById('title');
document.getElementById('start-btn').addEventListener('click',()=>{
  title.classList.add('hidden');
  setTimeout(()=>title.style.display='none',900);
  if(!actx){ initAudio(); document.getElementById('audio-btn').textContent='♪ 音效：开'; }
  bgmStart();
});
if(__qs.get('autostart')) document.getElementById('start-btn').click();
if(__qs.get('walk')) setTimeout(()=>{ keys.KeyW=true; }, 300);
{
  const stopAfter=+(__qs.get('stopafter')||0);   // 走 N 毫秒后松开，复现"停下后姿态"
  if(stopAfter) setTimeout(()=>{ keys.KeyW=true; setTimeout(()=>{ keys.KeyW=false; }, stopAfter); }, 300);
  const ft=+(__qs.get('ft')||0); if(ft) playerRig.freezeT=ft; // 调试：指定定格帧时刻
}
if(__qs.get('run')) setTimeout(()=>{ keys.KeyW=true; keys.ShiftLeft=true; }, 300);
{
  const dlgRank=+(__qs.get('dlg')||0);
  if(dlgRank) setTimeout(()=>{ const h=HEROES.find(h=>h.r===dlgRank); if(h) openDialog(h); }, 700);
}
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  fitSize();
});
fitSize();
loop();

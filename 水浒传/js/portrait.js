// ============================================================
// 程序化水墨人物画像生成器
// 依据 heroes.js 中的 look 描述，为每位好汉生成唯一的
// 宣纸底、面部、须发、冠巾、袍色、印章 —— 全部 Canvas2D 绘制
// ============================================================

// 简易确定性随机
import * as THREE from 'three';
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

const FACE_COLORS = {
  black:['#7a6a58','#5d4f40'], red:['#b07a5a','#8f5c42'], fair:['#e8cfae','#d3b78e'],
  tan:['#c9a071','#a97f52'], dark:['#5f5245','#463b30'], pale:['#d8c8a4','#bfb08a'],
  white:['#efe4d2','#d9ccb6']
};
const BEARD_COLORS = { none:null, mustache:'#2e2a24', short:'#33302a', full:'#26231e', long:'#2b2721', whiskers:'#1f1d19' };

export function drawHeroPortrait(hero, size=512){
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const S = size/512;
  const rnd = mulberry32([...hero.name].reduce((a,ch)=>a*31+ch.charCodeAt(0),7));

  c.save(); c.scale(S,S);

  // ---------- 宣纸底 ----------
  const bg = c.createRadialGradient(256,230,60,256,256,360);
  bg.addColorStop(0,'#efe6d0'); bg.addColorStop(.7,'#e5d9bc'); bg.addColorStop(1,'#d8caa6');
  c.fillStyle = bg; c.fillRect(0,0,512,512);
  // 纸纹噪点
  for(let i=0;i<900;i++){
    c.fillStyle = `rgba(${120+rnd()*60|0},${105+rnd()*55|0},${80+rnd()*45|0},${(rnd()*.09).toFixed(3)})`;
    c.fillRect(rnd()*512, rnd()*512, 1.5, 1.5);
  }
  // 淡墨晕染
  for(let i=0;i<7;i++){
    const gx = 60+rnd()*392, gy = 60+rnd()*392, r = 50+rnd()*90;
    const g = c.createRadialGradient(gx,gy,0,gx,gy,r);
    g.addColorStop(0,'rgba(70,64,52,.08)'); g.addColorStop(1,'rgba(70,64,52,0)');
    c.fillStyle=g; c.beginPath(); c.arc(gx,gy,r,0,7); c.fill();
  }

  // ---------- 淡墨远山 ----------
  c.strokeStyle='rgba(60,56,46,.16)'; c.lineWidth=7; c.lineCap='round';
  c.beginPath(); c.moveTo(20,470);
  c.quadraticCurveTo(120,380,220,455); c.quadraticCurveTo(300,510,400,430);
  c.quadraticCurveTo(450,395,495,460); c.stroke();

  // ---------- 肩/袍 ----------
  const accent = '#'+ (hero.look.accent||0x555555).toString(16).padStart(6,'0');
  const sh = 340; // 肩线高度
  // 袍身大笔
  const robe = c.createLinearGradient(120,sh,380,512);
  robe.addColorStop(0, shade(accent,.55)); robe.addColorStop(1, shade(accent,.25));
  c.fillStyle = robe;
  c.beginPath();
  c.moveTo(120,512); c.quadraticCurveTo(128,sh+8,196,sh);
  c.quadraticCurveTo(256,sh-14,318,sh);
  c.quadraticCurveTo(386,sh+8,392,512); c.closePath(); c.fill();
  // 袍上墨线衣纹
  c.strokeStyle='rgba(30,26,20,.5)'; c.lineWidth=3;
  for(let i=0;i<5;i++){
    const x0=170+i*46;
    c.beginPath(); c.moveTo(x0,sh+14+rnd()*8);
    c.quadraticCurveTo(x0+(rnd()*40-20),440,x0+(rnd()*30-15),510);
    c.stroke();
  }
  // 领口
  c.fillStyle=shade(accent,.8);
  c.beginPath(); c.moveTo(216,sh); c.quadraticCurveTo(256,sh+56,296,sh);
  c.quadraticCurveTo(256,sh-16,216,sh); c.fill();
  c.strokeStyle='rgba(30,26,20,.6)'; c.lineWidth=2.5; c.stroke();

  // ---------- 面部 ----------
  const [f1,f2] = FACE_COLORS[hero.look.face]||FACE_COLORS.tan;
  const fx=256, fy=225, fw=88+ (hero.look.face==='fair'?-4:0), fh=118;
  // 颈
  c.fillStyle=f2; c.fillRect(236,sh-26,40,36);
  // 脸
  const fg = c.createRadialGradient(fx-24,fy-30,14,fx,fy,fh*.9);
  fg.addColorStop(0,f1); fg.addColorStop(1,f2);
  c.fillStyle=fg;
  c.beginPath(); c.ellipse(fx,fy,fw*.62,fh*.55,0,0,7); c.fill();
  // 脸颊淡红（猛将）
  if(hero.look.face==='red'||hero.look.face==='dark'){
    c.fillStyle='rgba(150,60,40,.18)';
    c.beginPath(); c.ellipse(fx-44,fy+22,20,13,0,0,7); c.fill();
    c.beginPath(); c.ellipse(fx+44,fy+22,20,13,0,0,7); c.fill();
  }
  // 女将花黄
  if(hero.look.female){
    c.fillStyle='rgba(160,60,60,.35)';
    c.beginPath(); c.arc(fx-16,fy-52,3.4,0,7); c.fill();
    c.beginPath(); c.arc(fx+16,fy-52,3.4,0,7); c.fill();
    c.strokeStyle='rgba(150,60,60,.3)'; c.lineWidth=2;
    c.beginPath(); c.moveTo(fx-10,fy-46); c.lineTo(fx+10,fy-46); c.stroke();
  }
  // 墨线脸廓
  c.strokeStyle='rgba(40,34,26,.66)'; c.lineWidth=4; c.lineCap='round';
  c.beginPath(); c.ellipse(fx,fy,fw*.62,fh*.55,0,-.5,3.4); c.stroke();

  // 眉（剑眉/虎眉）
  c.lineWidth=7; c.strokeStyle='rgba(28,24,18,.85)';
  const browTilt = (hero.look.beard==='none'&&!hero.look.female)?2:5;
  c.beginPath(); c.moveTo(fx-58,fy-26+browTilt); c.quadraticCurveTo(fx-32,fy-40,fx-8,fy-27); c.stroke();
  c.beginPath(); c.moveTo(fx+58,fy-26+browTilt); c.quadraticCurveTo(fx+32,fy-40,fx+8,fy-27); c.stroke();
  // 目
  c.lineWidth=4.5;
  c.beginPath(); c.moveTo(fx-46,fy-6); c.quadraticCurveTo(fx-28,fy-11,fx-10,fy-6); c.stroke();
  c.beginPath(); c.moveTo(fx+46,fy-6); c.quadraticCurveTo(fx+28,fy-11,fx+10,fy-6); c.stroke();
  c.fillStyle='rgba(20,16,12,.9)';
  c.beginPath(); c.ellipse(fx-28,fy-5,6.5,4.5,0,0,7); c.fill();
  c.beginPath(); c.ellipse(fx+28,fy-5,6.5,4.5,0,0,7); c.fill();
  // 鼻
  c.strokeStyle='rgba(40,34,26,.5)'; c.lineWidth=3.5;
  c.beginPath(); c.moveTo(fx-4,fy-4); c.quadraticCurveTo(fx-9,fy+26,fx+2,fy+30); c.stroke();
  // 口（女将点唇）
  if(hero.look.female){
    c.fillStyle='rgba(160,50,50,.8)';
    c.beginPath(); c.ellipse(fx,fy+50,13,6,0,0,7); c.fill();
  }else{
    c.strokeStyle='rgba(40,32,26,.75)'; c.lineWidth=4;
    c.beginPath(); c.moveTo(fx-14,fy+48); c.quadraticCurveTo(fx,fy+54,fx+14,fy+48); c.stroke();
  }

  // ---------- 耳 ----------
  c.strokeStyle='rgba(40,34,26,.6)'; c.lineWidth=3;
  c.beginPath(); c.ellipse(fx-fw*.62,fy+8,8,15,0,0,7); c.stroke();
  c.beginPath(); c.ellipse(fx+fw*.62,fy+8,8,15,0,0,7); c.stroke();

  // ---------- 胡须 ----------
  const bc = BEARD_COLORS[hero.look.beard];
  if(bc){
    c.strokeStyle=bc; c.fillStyle=bc; c.lineCap='round';
    if(hero.look.beard==='mustache'){
      c.lineWidth=5;
      c.beginPath(); c.moveTo(fx-24,fy+42); c.quadraticCurveTo(fx-30,fy+56,fx-24,fy+62); c.stroke();
      c.beginPath(); c.moveTo(fx+24,fy+42); c.quadraticCurveTo(fx+30,fy+56,fx+24,fy+62); c.stroke();
    }else if(hero.look.beard==='short'){
      brushBlob(c,rnd,fx,fy+64,58,34,'rgba(38,34,28,.9)');
    }else if(hero.look.beard==='full'){
      brushBlob(c,rnd,fx,fy+58,64,44,'rgba(30,27,22,.94)');
      brushBlob(c,rnd,fx-58,fy+22,16,26,'rgba(30,27,22,.85)');
      brushBlob(c,rnd,fx+58,fy+22,16,26,'rgba(30,27,22,.85)');
    }else if(hero.look.beard==='long'){
      brushBlob(c,rnd,fx,fy+56,52,30,'rgba(35,31,26,.95)');
      c.strokeStyle='rgba(35,31,26,.9)'; c.lineWidth=6;
      for(let i=-1;i<=1;i++){
        c.beginPath(); c.moveTo(fx+i*16,fy+66);
        c.quadraticCurveTo(fx+i*22+6,340,fx+i*20+(rnd()*10-5),400+rnd()*30);
        c.stroke();
      }
    }else if(hero.look.beard==='whiskers'){
      brushBlob(c,rnd,fx,fy+60,54,36,'rgba(28,26,20,.92)');
      c.lineWidth=4;
      for(let i=0;i<5;i++){
        const bx=fx+(i-2)*22;
        c.beginPath(); c.moveTo(bx,fy+64); c.quadraticCurveTo(bx+14,fy+86,bx+26,fy+98); c.stroke();
      }
    }
  }

  // ---------- 冠巾发型 ----------
  drawHeadgear(c, rnd, fx, fy, fh, hero);

  // ---------- 星曜印章 ----------
  const sealY = 40;
  c.fillStyle='rgba(150,40,30,.92)';
  roundRect(c, 30, sealY, 74, 74, 8); c.fill();
  c.fillStyle='#f0e2c4';
  c.font='bold 30px "Kaiti SC","STKaiti","KaiTi",serif';
  c.textAlign='center'; c.textBaseline='middle';
  drawSealChar(c, hero.star[1], 67, sealY+37); // 星/罡/煞等
  // 名讳竖排
  c.fillStyle='rgba(60,30,20,.85)';
  c.font='bold 40px "Kaiti SC","STKaiti","KaiTi",serif';
  const chars=[...hero.name];
  chars.forEach((ch,i)=> c.fillText(ch, 452, 60+i*48));
  // 绰号小字
  c.font='20px "Kaiti SC","STKaiti",serif';
  c.fillStyle='rgba(90,60,40,.8)';
  c.fillText('「'+hero.nick+'」', 452, 60+chars.length*48+10);

  // 底部朱文小印
  c.fillStyle='rgba(150,40,30,.85)';
  roundRect(c, 408, 428, 60, 24, 4); c.fill();
  c.fillStyle='#f0e2c4'; c.font='bold 16px "Kaiti SC","STKaiti",serif';
  c.fillText('水泊梁山', 438, 441);

  c.restore();
  return cv;
}

function drawSealChar(c, ch, x, y){
  c.save(); c.translate(x,y); c.rotate(-.02);
  c.fillText(ch, 0, 0); c.restore();
}

// 冠巾
function drawHeadgear(c, rnd, fx, fy, fh, hero){
  const top = fy - fh*.55; // 发际
  c.lineCap='round';
  switch(hero.look.head){
    case 'wrap': { // 交脚幞头巾
      c.fillStyle='rgba(52,46,38,.95)';
      c.beginPath();
      c.moveTo(fx-62,top+8); c.quadraticCurveTo(fx,top-46,fx+62,top+8);
      c.quadraticCurveTo(fx+66,top+34,fx+52,top+44);
      c.quadraticCurveTo(fx,top+8,fx-52,top+44);
      c.quadraticCurveTo(fx-66,top+34,fx-62,top+8); c.fill();
      c.strokeStyle='rgba(24,20,16,.8)'; c.lineWidth=3;
      c.beginPath(); c.moveTo(fx-56,top+18); c.quadraticCurveTo(fx,top-8,fx+56,top+18); c.stroke();
      // 巾垂
      c.fillStyle='rgba(52,46,38,.9)';
      c.beginPath(); c.moveTo(fx-58,top+30); c.quadraticCurveTo(fx-92,top+70,fx-70,top+110); c.lineTo(fx-50,top+96);
      c.quadraticCurveTo(fx-58,top+60,fx-40,top+40); c.fill();
      break;
    }
    case 'hat': { // 范阳毡笠
      c.fillStyle='rgba(94,80,60,.95)';
      c.beginPath();
      c.moveTo(fx-108,top+34); c.quadraticCurveTo(fx,top-58,fx+108,top+34);
      c.quadraticCurveTo(fx+70,top+48,fx,top+46); c.quadraticCurveTo(fx-70,top+48,fx-108,top+34);
      c.fill();
      c.strokeStyle='rgba(30,24,18,.7)'; c.lineWidth=3;
      c.beginPath(); c.moveTo(fx-96,top+32); c.quadraticCurveTo(fx,top-40,fx+96,top+32); c.stroke();
      c.fillStyle='rgba(30,26,20,.9)';
      c.beginPath(); c.ellipse(fx,top-6,12,8,0,0,7); c.fill();
      break;
    }
    case 'dao': { // 道冠
      c.fillStyle='rgba(40,40,52,.95)';
      c.beginPath(); c.ellipse(fx,top+14,40,30,0,Math.PI,0); c.fill();
      c.fillStyle='#2c2c38';
      c.beginPath(); c.ellipse(fx,top-8,17,20,0,0,7); c.fill();
      c.strokeStyle='#b9a26a'; c.lineWidth=4;
      c.beginPath(); c.moveTo(fx-24,top+2); c.lineTo(fx+24,top+2); c.stroke();
      c.beginPath(); c.moveTo(fx,top-26); c.lineTo(fx,top+6); c.stroke();
      break;
    }
    case 'monk': { // 光头+戒疤
      c.fillStyle=shade(FACE_COLORS[hero.look.face]?FACE_COLORS[hero.look.face][0]:'#c9a071',.75);
      c.beginPath(); c.ellipse(fx,top+18,56,42,0,Math.PI,0); c.fill();
      c.strokeStyle='rgba(30,26,20,.5)'; c.lineWidth=3; c.stroke();
      c.fillStyle='rgba(90,70,50,.95)';
      for(let i=-1;i<=1;i++) for(let j=0;j<2;j++){
        c.beginPath(); c.arc(fx+i*26, top+2+j*13, 4.4, 0, 7); c.fill();
      }
      // 念珠
      c.strokeStyle='rgba(70,50,30,.8)'; c.lineWidth=3;
      c.beginPath(); c.arc(fx,fy+40,86,1.9,4.4); c.stroke();
      break;
    }
    case 'pilgrim': { // 头陀金箍
      c.fillStyle='rgba(30,26,22,.9)';
      c.beginPath(); c.ellipse(fx,top+16,58,40,0,Math.PI,0); c.fill();
      // 散发
      c.strokeStyle='rgba(26,22,18,.85)'; c.lineWidth=6;
      for(let i=0;i<6;i++){
        const bx=fx-52+i*21;
        c.beginPath(); c.moveTo(bx,top+18); c.quadraticCurveTo(bx-10,top+66,bx-4+rnd()*8,top+96); c.stroke();
      }
      c.strokeStyle='#c9a03a'; c.lineWidth=7;
      c.beginPath(); c.ellipse(fx,top+20,58,17,0,0,7); c.stroke();
      c.fillStyle='#c9a03a';
      c.beginPath(); c.arc(fx,top+8,7,0,7); c.fill();
      break;
    }
    case 'helmet': { // 兜鍪
      const hg=c.createLinearGradient(fx-70,top-40,fx+70,top+40);
      hg.addColorStop(0,'#8a8676'); hg.addColorStop(.5,'#6b675a'); hg.addColorStop(1,'#57544a');
      c.fillStyle=hg;
      c.beginPath();
      c.moveTo(fx-72,top+40); c.quadraticCurveTo(fx-64,top-44,fx,top-46);
      c.quadraticCurveTo(fx+64,top-44,fx+72,top+40);
      c.quadraticCurveTo(fx,top+12,fx-72,top+40); c.fill();
      c.strokeStyle='rgba(20,18,14,.8)'; c.lineWidth=3;
      c.beginPath(); c.moveTo(fx-70,top+38); c.quadraticCurveTo(fx,top+10,fx+70,top+38); c.stroke();
      // 红缨
      c.strokeStyle='rgba(160,44,34,.9)'; c.lineWidth=5;
      for(let i=0;i<5;i++){
        c.beginPath(); c.moveTo(fx,top-42); c.quadraticCurveTo(fx-20+i*10,top-72,fx-34+i*17,top-92); c.stroke();
      }
      // 护颈顿项
      c.fillStyle='rgba(74,70,60,.9)';
      for(let i=0;i<4;i++){
        c.beginPath(); c.moveTo(fx-66+i*10,top+42); c.quadraticCurveTo(fx-70+i*12,top+86,fx-62+i*13,top+104);
        c.lineTo(fx-46+i*11,top+96); c.quadraticCurveTo(fx-52+i*11,top+66,fx-44+i*9,top+44); c.fill();
      }
      for(let i=0;i<4;i++){
        c.beginPath(); c.moveTo(fx+66-i*10,top+42); c.quadraticCurveTo(fx+70-i*12,top+86,fx+62-i*13,top+104);
        c.lineTo(fx+46-i*11,top+96); c.quadraticCurveTo(fx+52-i*11,top+66,fx+44-i*9,top+44); c.fill();
      }
      break;
    }
    default: { // 发髻
      c.fillStyle='rgba(30,26,22,.95)';
      c.beginPath(); c.ellipse(fx,top+14,56,38,0,Math.PI,0); c.fill();
      c.beginPath(); c.ellipse(fx,top-12,20,15,0,0,7); c.fill();
      c.strokeStyle='rgba(150,40,30,.85)'; c.lineWidth=3;
      c.beginPath(); c.moveTo(fx-20,top-18); c.lineTo(fx+20,top-18); c.stroke();
    }
  }
  // 女将青丝
  if(hero.look.female && hero.look.head!=='helmet'){
    c.fillStyle='rgba(24,20,18,.95)';
    c.beginPath(); c.moveTo(fx-58,top+16); c.quadraticCurveTo(fx-78,top+140,fx-60,top+230);
    c.lineTo(fx-34,top+220); c.quadraticCurveTo(fx-52,top+120,fx-44,top+26); c.fill();
    c.beginPath(); c.moveTo(fx+58,top+16); c.quadraticCurveTo(fx+78,top+140,fx+60,top+230);
    c.lineTo(fx+34,top+220); c.quadraticCurveTo(fx+52,top+120,fx+44,top+26); c.fill();
  }
}

// 干笔皴出的须发块
function brushBlob(c, rnd, cx, cy, rw, rh, color){
  c.fillStyle=color;
  c.beginPath(); c.ellipse(cx,cy,rw,rh,0,0,7); c.fill();
  c.strokeStyle=color; c.lineWidth=5;
  for(let i=0;i<26;i++){
    const a = -Math.PI/2 + (rnd()-.5)*2.4;
    const x0 = cx + Math.cos(a)*(rw*.4), y0 = cy + Math.sin(a)*(rh*.4);
    const len = 18+rnd()*30;
    c.beginPath(); c.moveTo(x0,y0);
    c.lineTo(x0+Math.cos(a)*len + (rnd()*12-6), y0+Math.sin(a)*len + rnd()*10);
    c.stroke();
  }
}

function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}
function shade(hex,f){
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,(n>>16)*f|0), g=Math.min(255,((n>>8)&255)*f|0), b=Math.min(255,(n&255)*f|0);
  return `rgb(${r},${g},${b})`;
}

// 名牌贴图（NPC 头顶）
export function makeLabelTexture(name, nick, rank){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=96;
  const c=cv.getContext('2d');
  c.fillStyle='rgba(30,24,16,.62)';
  roundRect(c,4,10,248,64,10); c.fill();
  c.strokeStyle='rgba(190,150,80,.85)'; c.lineWidth=2.5; c.stroke();
  c.fillStyle='#efe0bc'; c.textAlign='center'; c.textBaseline='middle';
  c.font='bold 34px "Kaiti SC","STKaiti","KaiTi",serif';
  c.fillText(name, 128, 36);
  c.font='20px "Kaiti SC","STKaiti",serif';
  c.fillStyle='#d8bc84';
  c.fillText(rank+' · '+nick, 128, 62);
  const t=new THREE.Texture(cv); t.needsUpdate=true; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// 牌匾贴图
export function makePlaqueTexture(text){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128;
  const c=cv.getContext('2d');
  const g=c.createLinearGradient(0,0,0,128);
  g.addColorStop(0,'#20303f'); g.addColorStop(1,'#131e28');
  c.fillStyle=g; c.fillRect(0,0,512,128);
  c.strokeStyle='#c9a03a'; c.lineWidth=8; c.strokeRect(6,6,500,116);
  c.strokeStyle='rgba(201,160,58,.5)'; c.lineWidth=2; c.strokeRect(16,16,480,96);
  c.fillStyle='#e8d9ae'; c.textAlign='center'; c.textBaseline='middle';
  c.font='bold 86px "Kaiti SC","STKaiti","KaiTi",serif';
  c.fillText(text,256,68);
  const t=new THREE.Texture(cv); t.needsUpdate=true; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// 旗帜贴图（替天行道 / 梁 / 宋）
export function makeFlagTexture(text, bg='#c9a23a', fg='#1c1a14'){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=640;
  const c=cv.getContext('2d');
  c.fillStyle=bg; c.fillRect(0,0,512,640);
  c.strokeStyle='rgba(120,80,20,.6)'; c.lineWidth=10; c.strokeRect(8,8,496,624);
  c.fillStyle=fg; c.textAlign='center'; c.textBaseline='middle';
  const chars=[...text];
  const fs = chars.length>2? 120: 170;
  c.font=`bold ${fs}px "Kaiti SC","STKaiti","KaiTi",serif`;
  chars.forEach((ch,i)=> c.fillText(ch, 256, 90+ i*(490/Math.max(chars.length,1)) ));
  // 旗角火纹
  c.strokeStyle='rgba(140,40,30,.55)'; c.lineWidth=6;
  c.beginPath(); c.moveTo(30,600); c.quadraticCurveTo(70,560,60,610); c.quadraticCurveTo(100,580,90,616); c.stroke();
  const t=new THREE.Texture(cv); t.needsUpdate=true; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

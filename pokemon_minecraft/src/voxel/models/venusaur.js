import { Vox } from '../vox.js';
// 妙蛙花
export default function build() {
  const v = new Vox();
  const BG=0x5FAE96, SP=0x2E7560, LF=0x3F9C50, LT=0x7ED063,
        PT=0xE85454, PD=0xB53A3A, YC=0xF2C531,
        EYE=0xD8433C, W=0xFFFFFF, M=0x2E5C4E;
  v.bevelBox(-6,6,2,10,-7,3,BG);                    // 粗壮的四足身体
  v.box(-6,-4,0,3,1,4,BG);  v.box(4,6,0,3,1,4,BG);  // 前腿
  v.box(-6,-4,0,3,-7,-5,BG); v.box(4,6,0,3,-7,-5,BG);// 后腿
  v.bevelBox(-6,6,6,14,2,10,BG);                    // 宽大的头
  for(const s of [1,-1]){
    v.box(s*2,s*4,10,11,10,10,EYE); v.set(s*2,11,10,W); // 红眼睛
  }
  v.box(-3,3,7,8,10,10,M);                          // 大宽嘴
  v.set(-4,9,10,M); v.set(4,9,10,M);
  for(const s of [1,-1]){                           // 头顶两侧的叶片
    v.box(s*2,s*4,14,15,3,5,LF);
    v.set(s*3,15,4,LT);
  }
  v.box(-1,1,11,14,-5,-2,LF);                       // 花茎
  v.bevelBox(-3,3,14,18,-6,-1,YC);                  // 黄色花心
  v.box(-2,2,18,18,-5,-2,YC);                       // 花心顶
  for(const s of [1,-1]){                           // 左右大花瓣
    v.box(s*4,s*7,15,17,-5,-2,PT);
    v.box(s*5,s*6,17,18,-4,-3,PD);
  }
  v.box(-3,3,15,17,0,2,PT);                         // 前花瓣
  v.box(-2,2,17,18,0,1,PD);
  v.box(-3,3,15,17,-9,-7,PT);                       // 后花瓣
  v.box(-2,2,17,18,-8,-7,PD);
  // 身上的深色斑点
  [[6,8,-3],[-6,7,-4],[6,5,0],[-6,6,1],[6,9,2],[-6,5,-1],[4,12,8],[-4,12,7],[0,13,6],[5,4,-5]]
    .forEach(p=>v.set(p[0],p[1],p[2],SP));
  return v;
}

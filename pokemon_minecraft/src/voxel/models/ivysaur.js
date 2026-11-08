import { Vox } from '../vox.js';
// 妙蛙草
export default function build() {
  const v = new Vox();
  const BG=0x6FC0A8, SP=0x35836B, BD=0x3F9C50, BT=0x7ED063,
        PK=0xE87BA8, PD=0xC2527F, EYE=0xD8433C, W=0xFFFFFF, M=0x2E5C4E;
  v.bevelBox(-4,4,2,8,-5,2,BG);                     // 更大的四足身体
  v.box(-4,-2,0,2,1,3,BG);  v.box(2,4,0,2,1,3,BG);  // 前腿
  v.box(-4,-2,0,2,-5,-4,BG); v.box(2,4,0,2,-5,-4,BG);// 后腿
  v.bevelBox(-5,5,4,11,1,8,BG);                     // 更宽的头
  for(const s of [1,-1]){
    v.box(s*2,s*3,8,9,8,8,EYE); v.set(s*2,9,8,W);   // 红眼睛
  }
  v.box(-2,2,5,5,8,8,M); v.set(-3,6,8,M); v.set(3,6,8,M); // 大嘴
  for(const s of [1,-1]){                           // 尖耳
    v.box(s*2,s*3,12,13,3,4,BG);
    v.set(s*2,12,4,SP);
  }
  v.bevelBox(-3,3,8,13,-5,-1,BD);                   // 半开的球茎
  for(const s of [1,-1]){                           // 球茎两侧托叶
    v.box(s*3,s*4,9,10,-4,-2,BT);
  }
  v.bevelBox(-2,2,13,15,-4,-2,PK);                  // 粉红色花苞
  v.box(-1,1,15,16,-4,-3,PD);                       // 苞尖深色
  // 身上的深色斑点
  [[4,6,-2],[-4,5,-3],[4,4,0],[-4,6,1],[5,7,4],[-5,6,3],[5,5,5],[-1,10,6],[2,10,4],[3,7,-4]]
    .forEach(p=>v.set(p[0],p[1],p[2],SP));
  return v;
}

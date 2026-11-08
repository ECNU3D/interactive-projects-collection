import { Vox } from '../vox.js';
// 雷伊布
export default function build() {
  const v = new Vox();
  const Y=0xF2D13B, YD=0xD4A92E, WH=0xF5F2E0,
        EYE=0x1A1A1A, W=0xFFFFFF, M=0x6B4A2F;
  v.bevelBox(-2,2,2,6,-4,1,Y);                      // 四足身体
  v.box(-2,-1,0,1,0,1,Y); v.box(1,2,0,1,0,1,Y);     // 前腿
  v.box(-2,-1,0,1,-4,-3,Y); v.box(1,2,0,1,-4,-3,Y); // 后腿
  v.bevelBox(-3,3,5,10,1,6,Y);                      // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,7,8,6,6,EYE); v.set(s*1,8,6,W);   // 眼睛
  }
  v.set(0,6,6,M);                                   // 小鼻子
  for(const s of [1,-1]){                           // 又长又尖的耳朵
    v.box(s*1,s*2,10,12,2,3,Y);
    v.box(s*2,s*3,13,14,2,3,Y);
    v.set(s*2,14,3,YD);
  }
  v.box(-3,3,4,7,0,2,WH);                           // 白色颈毛
  for(const s of [1,-1]){                           // 颈毛炸开的尖刺
    v.box(s*3,s*4,5,6,0,1,WH);
    v.set(s*4,6,1,WH);
  }
  v.set(-2,8,0,WH); v.set(2,8,0,WH);                // 颈毛顶部尖刺
  // 全身错位的尖刺毛发
  [[3,5,-3],[3,4,-1],[3,6,0],[-3,5,-3],[-3,4,-1],[-3,6,0],
   [1,7,-4],[-1,7,-2],[0,7,-4],[1,6,-5],[-1,5,-5],
   [4,6,-2],[-4,6,-2],[4,5,0],[-4,5,0]]
    .forEach(p=>v.set(p[0],p[1],p[2],Y));
  [[2,7,-3],[0,6,-5],[3,3,-2],[-3,3,-2]]
    .forEach(p=>v.set(p[0],p[1],p[2],YD));          // 深色尖刺点缀
  v.box(0,0,4,6,-5,-5,Y);                           // 小尖尾巴
  v.set(0,7,-5,YD);
  return v;
}

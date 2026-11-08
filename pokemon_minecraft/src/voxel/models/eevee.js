import { Vox } from '../vox.js';
// 伊布
export default function build() {
  const v = new Vox();
  const BR=0xA8763E, BD=0x6B4A26, CR=0xF2E2BC,
        EYE=0x1A1A1A, W=0xFFFFFF, M=0x4A2E1A;
  v.bevelBox(-2,2,2,6,-4,1,BR);                     // 小巧的四足身体
  v.box(-2,-1,0,1,0,1,BR); v.box(1,2,0,1,0,1,BR);   // 前腿
  v.box(-2,-1,0,1,-4,-3,BR); v.box(1,2,0,1,-4,-3,BR);// 后腿
  v.bevelBox(-3,3,3,7,0,2,CR);                      // 奶油色大围脖
  v.bevelBox(-3,3,5,10,1,6,BR);                     // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,7,8,6,6,EYE); v.set(s*1,8,6,W);   // 眼睛
  }
  v.set(0,6,6,M);                                   // 小鼻子
  for(const s of [1,-1]){                           // 又大又尖的耳朵
    v.box(s*2,s*3,10,12,2,3,BR);
    v.box(s*3,s*4,13,14,2,3,BR);
    v.set(s*3,14,3,BD);
  }
  v.box(0,1,3,5,-5,-4,BR);                          // 尾巴根
  v.bevelBox(-1,2,5,8,-7,-5,BR);                    // 蓬松的尾巴
  v.box(0,1,8,9,-7,-5,CR);                          // 奶油色尾尖
  v.set(0,9,-6,CR);
  return v;
}

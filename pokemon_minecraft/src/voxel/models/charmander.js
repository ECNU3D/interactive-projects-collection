import { Vox } from '../vox.js';
// 小火龙
export default function build() {
  const v = new Vox();
  const O=0xF0862F, C=0xF7D77E, EYE=0x1A1A1A, W=0xFFFFFF, M=0xA33B22,
        R=0xE83B23, FO=0xFF9027, FY=0xFFE04A;
  v.bevelBox(-3,3,0,5,-2,3,O);                      // 身体
  v.box(-2,2,1,4,3,3,C);                            // 奶油色肚皮
  v.box(-3,-1,0,0,3,4,O); v.box(1,3,0,0,3,4,O);     // 脚
  for(const s of [1,-1]) v.box(s*4,s*5,3,4,0,2,O);  // 手臂
  v.bevelBox(-4,4,5,12,-3,4,O);                     // 头
  for(const s of [1,-1]){
    v.box(s*2,s*3,9,10,4,4,EYE); v.set(s*2,10,4,W); // 眼睛
  }
  v.box(-2,2,7,7,4,4,M);                            // 大嘴
  v.box(0,1,2,3,-4,-3,O);                           // 尾巴
  v.box(0,1,3,6,-6,-5,O);
  v.box(0,1,7,9,-6,-4,R);                           // 尾巴火焰:红
  v.box(0,1,10,10,-6,-5,FO);                        //           橙
  v.set(0,11,-5,FY); v.set(1,11,-6,FY);             //           黄尖
  return v;
}

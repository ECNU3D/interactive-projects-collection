import { Vox } from '../vox.js';
// 火恐龙
export default function build() {
  const v = new Vox();
  const O=0xE8662A, C=0xF7D77E, EYE=0x1A1A1A, W=0xFFFFFF, M=0xA33B22,
        R=0xE83B23, FO=0xFF9027, FY=0xFFE04A;
  v.bevelBox(-3,3,0,7,-2,3,O);                      // 更高更壮的身体
  v.box(-2,2,1,6,3,3,C);                            // 奶油色肚皮
  v.box(-3,-1,0,1,3,4,O); v.box(1,3,0,1,3,4,O);     // 脚
  for(const s of [1,-1]) v.box(s*4,s*5,4,6,0,2,O);  // 更有力的手臂
  v.bevelBox(-4,4,8,15,-3,4,O);                     // 头
  for(const s of [1,-1]){
    v.box(s*2,s*3,12,13,4,4,EYE); v.set(s*2,13,4,W);// 眼睛
  }
  v.box(-2,2,10,10,4,4,M);                          // 嘴
  v.box(-1,0,16,17,-1,0,O);                         // 头顶的尖角
  v.set(0,18,-1,O);
  v.box(0,1,2,4,-4,-3,O);                           // 尾巴
  v.box(0,1,4,7,-6,-5,O);
  v.box(-1,2,8,11,-6,-4,R);                         // 更大的尾巴火焰:红
  v.box(0,1,12,13,-6,-5,FO);                        //               橙
  v.set(0,14,-5,FY); v.set(1,14,-6,FY); v.set(0,15,-5,FY); // 黄尖
  return v;
}

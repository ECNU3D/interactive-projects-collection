import { Vox } from '../vox.js';
// 鬼斯通
export default function build() {
  const v = new Vox();
  const PU=0x7A4A9C, EYE=0x1A1A1A, W=0xFFFFFF, M=0x2A1A3A;
  v.bevelBox(-2,2,0,6,-2,2,PU);                       // 紫色气团身体
  v.set(0,7,0,PU); v.set(-1,7,-1,PU); v.set(1,7,-1,PU); // 头顶气刺
  for(const s of [1,-1]){
    v.box(s*1,s*2,4,4,2,2,EYE); v.set(s*2,5,2,EYE);   // 三角眼
    v.box(s*4,s*5,2,3,0,1,PU);                        // 分离的悬浮大手
    v.set(s*4,4,0,PU); v.set(s*5,4,0,PU); v.set(s*5,4,1,PU); // 三只尖指
  }
  v.box(-2,2,2,2,2,2,M);                              // 邪恶笑容
  v.set(-1,2,2,W); v.set(1,2,2,W);                    // 尖牙
  return v;
}

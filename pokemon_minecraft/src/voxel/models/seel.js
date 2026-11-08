import { Vox } from '../vox.js';
// 小海狮
export default function build() {
  const v = new Vox();
  const WH=0xF4F4F0, EYE=0x1A1A1A, W=0xFFFFFF, R=0xE84A4A;
  v.bevelBox(-2,2,0,4,-5,3,WH);                       // 圆筒身体水平趴姿
  v.box(-1,1,5,5,-3,-1,WH);                           // 后部略高的脊背
  v.set(0,5,2,WH); v.set(0,6,2,WH);                   // 头上小尖角
  for(const s of [1,-1]){
    v.box(s*2,s*2,2,3,3,3,EYE); v.set(s*2,3,3,W);     // 眼睛+高光
    v.box(s*3,s*4,0,0,1,3,WH);                        // 前鳍贴地
  }
  v.set(0,2,4,R);                                     // 红色小鼻子
  v.box(-1,1,1,2,-6,-6,WH);                           // 尾柄
  for(const s of [1,-1]) v.box(s*1,s*2,1,2,-7,-7,WH); // 尾巴分叉两叶鳍
  return v;
}

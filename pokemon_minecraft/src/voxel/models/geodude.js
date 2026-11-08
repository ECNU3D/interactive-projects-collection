import { Vox } from '../vox.js';
// 小拳石
export default function build() {
  const v = new Vox();
  const G=0x9A938A, BR=0x5A534A, M=0x4A3A32, EYE=0x1A1A1A, WH=0xFFFFFF;
  v.bevelBox(-3,3,0,5,-2,2,G);                        // 灰色圆石头身体(坐地)
  v.box(-1,1,6,7,-1,1,G);                             // 头顶石棱
  for(const s of [1,-1]){
    v.box(s*1,s*1,3,4,2,2,EYE); v.set(s*1,4,2,WH);    // 眼睛+高光
    v.box(s*1,s*2,5,5,2,2,BR); v.set(s*2,6,2,BR);     // 皱眉(外侧上挑的眉毛)
    v.box(s*4,s*5,3,5,-1,1,G);                        // 肌肉手臂
    v.box(s*4,s*5,1,2,0,2,G);                         // 大拳头
  }
  v.box(-1,1,2,2,2,2,M);                              // 紧抿的嘴
  return v;
}

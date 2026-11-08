import { Vox } from '../vox.js';
// 隆隆石
export default function build() {
  const v = new Vox();
  const G=0x9A938A, GD=0x7A736A, BR=0x5A534A, M=0x4A3A32,
        EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,1,1,2,G);                         // 短脚
  }
  v.bevelBox(-3,3,2,7,-2,2,G);                        // 更大的石头身体
  v.box(-2,2,8,8,-2,2,G);                             // 背部石台
  v.set(0,9,-1,GD); v.set(2,9,1,GD);                  // 棱角突起
  for(const s of [1,-1]){
    v.box(s*4,s*5,5,7,0,1,G);                         // 上手臂
    v.box(s*5,s*6,4,5,1,2,G);                         // 上拳头
    v.box(s*4,s*5,3,4,-1,0,G);                        // 下手臂
    v.box(s*4,s*5,1,2,0,1,G);                         // 下拳头
    v.box(s*1,s*1,5,6,2,2,EYE); v.set(s*1,6,2,WH);    // 眼睛+高光
    v.box(s*1,s*2,7,7,2,2,BR);                        // 重压的眉毛
  }
  v.box(-2,2,3,3,2,2,M);                              // 宽大的嘴
  return v;
}

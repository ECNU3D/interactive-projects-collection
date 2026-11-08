import { Vox } from '../vox.js';
// 玛瑙水母
export default function build() {
  const v = new Vox();
  const T=0x6FC8D8, R=0xD8352A, BR=0x8A5A32, EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*1,0,4,1,1,BR);                        // 下垂的棕色触手:前对
    v.box(s*3,s*3,0,6,0,0,BR);                        //              侧对(接上伞盖沿)
  }
  v.bevelBox(-3,3,5,9,-3,3,T);                        // 半透明感蓝绿色伞盖头
  v.box(-2,-1,7,8,3,4,R); v.box(1,2,7,8,3,4,R);       // 头顶两颗红色玛瑙珠
  for(const s of [1,-1]){
    v.box(s*1,s*1,5,6,3,3,EYE); v.set(s*1,6,3,WH);    // 眼睛+高光
  }
  return v;
}

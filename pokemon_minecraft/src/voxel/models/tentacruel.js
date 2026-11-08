import { Vox } from '../vox.js';
// 毒刺水母
export default function build() {
  const v = new Vox();
  const T=0x5FB8D0, R=0xD8352A, BR=0x7A4E2C, EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*2,s*2,0,8,2,2,BR);                        // 更粗的触手:前对(接上伞盖沿)
    v.box(s*3,s*3,0,8,0,0,BR);                        //            侧对
    v.box(s*1,s*1,0,8,-2,-2,BR);                      //            后对
  }
  v.bevelBox(-3,3,7,13,-2,2,T);                       // 更大的蓝绿色伞盖
  v.box(-1,1,10,11,2,3,R);                            // 正面大红玛瑙珠
  v.box(-4,-4,9,10,0,1,R); v.box(4,4,9,10,0,1,R);     // 两侧红玛瑙珠
  for(const s of [1,-1]){
    v.box(s*1,s*1,9,10,2,2,EYE); v.set(s*1,10,2,WH);  // 眼睛+高光
  }
  return v;
}

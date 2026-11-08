import { Vox } from '../vox.js';
// 耿鬼
export default function build() {
  const v = new Vox();
  const PU=0x5B3A7A, EYE=0xD83A3A, W=0xFFFFFF;
  v.bevelBox(-2,2,0,7,-2,2,PU);                       // 深紫圆润胖身体
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,1,2,3,PU);                        // 短脚
    v.box(s*3,s*3,3,4,0,1,PU);                        // 短手
    v.box(s*1,s*2,5,6,2,2,EYE);                       // 红色大眼睛
  }
  // 背上一排尖刺
  v.set(0,8,-1,PU); v.set(0,8,0,PU); v.set(0,8,1,PU);
  v.set(-1,8,-1,PU); v.set(1,8,-1,PU);
  v.set(-1,8,1,PU); v.set(1,8,1,PU);
  // 邪魅大笑(白色锯齿嘴)
  for(let x=-2;x<=2;x++) v.set(x,3,2,W);
  v.set(-2,2,2,W); v.set(0,2,2,W); v.set(2,2,2,W);
  return v;
}

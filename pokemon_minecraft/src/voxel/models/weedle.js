import { Vox } from '../vox.js';
// 独角虫
export default function build() {
  const v = new Vox();
  const BR=0xC8A048, DBR=0x9A7830, CR=0xF0E0A0, R=0xD84848,
        HORN=0x8A6028, EYE=0x1A1A1A, W=0xFFFFFF;
  v.bevelBox(-2,2,0,2,-2,2,BR);                       // 圆筒身体第 1 节
  v.box(-1,1,0,0,0,2,CR);                             // 奶油色腹足
  v.bevelBox(-2,2,3,5,-2,2,BR);                       // 第 2 节
  v.box(-2,2,3,3,-2,2,DBR);                           // 分节深纹
  v.bevelBox(-2,2,6,8,-2,2,BR);                       // 第 3 节
  v.box(-2,2,6,6,-2,2,DBR);                           // 分节深纹
  v.bevelBox(-2,2,9,12,-2,2,BR);                      // 头
  v.box(0,1,13,14,0,0,HORN);                          // 头顶毒针
  v.set(0,15,0,HORN);                                 // 针尖
  v.box(-1,0,9,10,3,3,R);                             // 红色大鼻子
  for(const s of [1,-1]){
    v.box(s*1,s*1,11,12,2,2,EYE); v.set(s*1,12,2,W);  // 眼睛+高光
  }
  return v;
}

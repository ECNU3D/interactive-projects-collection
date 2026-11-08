import { Vox } from '../vox.js';
// 绿毛虫
export default function build() {
  const v = new Vox();
  const GR=0x70C048, DG=0x3E6A2E, CR=0xF0E0A0, R=0xD84848, EYE=0x1A1A1A, W=0xFFFFFF;
  v.bevelBox(-2,2,0,2,-2,2,GR);                       // 身体第 1 节
  v.box(-1,1,0,0,0,2,CR);                             // 奶油色腹足
  v.bevelBox(-2,2,3,5,-2,2,GR);                       // 第 2 节
  v.bevelBox(-2,2,6,8,-2,2,GR);                       // 第 3 节
  v.box(-2,2,7,7,-2,2,CR);                            // 黄色体环
  v.bevelBox(-2,2,9,12,-2,2,GR);                      // 头部一节
  for(const s of [1,-1]){
    v.box(s*1,s*2,10,11,2,2,EYE); v.set(s*1,11,2,W);  // 大眼睛+高光
    v.set(s*1,13,0,R); v.set(s*1,14,0,R);             // 红色小触角
  }
  v.box(-1,0,9,9,2,2,DG);                             // 小嘴
  return v;
}

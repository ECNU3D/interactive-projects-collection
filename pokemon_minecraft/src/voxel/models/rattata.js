import { Vox } from '../vox.js';
// 小拉达
export default function build() {
  const v = new Vox();
  const PU=0x9C6BC4, DPU=0x7A4DA2, CR=0xF2E2BC, EYE=0x1A1A1A, W=0xFFFFFF, NOSE=0xE08A9A;
  v.bevelBox(-2,2,1,4,-3,2,PU);                       // 四足身体
  v.box(-1,1,1,1,-1,2,CR);                            // 奶油色肚皮
  v.box(-2,-1,0,0,1,2,PU);  v.box(1,2,0,0,1,2,PU);    // 前腿
  v.box(-2,-1,0,0,-3,-2,PU); v.box(1,2,0,0,-3,-2,PU); // 后腿
  v.bevelBox(-2,2,2,6,2,5,PU);                        // 头(朝 +z)
  v.box(-1,0,4,5,5,5,CR);                             // 奶油色吻部
  v.box(-1,0,3,3,5,5,W);                              // 两颗大门牙
  v.box(-1,0,4,4,6,6,NOSE);                           // 粉鼻子
  for(const s of [1,-1]){
    v.box(s*1,s*2,5,6,4,4,EYE); v.set(s*1,6,4,W);     // 眼睛+高光
    v.box(s*1,s*2,7,8,3,4,PU);                        // 圆耳朵
  }
  v.box(0,1,2,2,-4,-4,PU);                            // 长尾巴:根部
  v.box(0,1,2,3,-5,-5,PU);                            //       后伸
  v.box(0,1,3,4,-6,-6,DPU);                           //       上卷尾尖
  return v;
}

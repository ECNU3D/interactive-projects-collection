import { Vox } from '../vox.js';
// 铁甲蛹
export default function build() {
  const v = new Vox();
  const GR=0x70C048, DG=0x3E7A2E, EYE=0x1A1A1A, W=0xFFFFFF;
  v.bevelBox(-2,2,0,3,-2,2,GR);                       // 叶片形硬壳:底部收窄
  v.bevelBox(-3,3,2,9,-2,2,GR);                       // 中部鼓起
  v.bevelBox(-2,2,9,12,-2,2,GR);                      // 顶部收窄
  v.box(0,1,12,13,-1,0,GR);                           // 壳顶尖
  // 中间一条斜分割线(正面绕到两侧)
  v.set(-2,7,2,DG); v.set(-1,6,2,DG); v.set(0,6,2,DG);
  v.set(1,5,2,DG); v.set(2,5,2,DG);
  v.set(-3,7,0,DG); v.set(3,5,0,DG);
  for(const s of [1,-1]){
    v.box(s*1,s*2,9,9,2,2,EYE); v.set(s*1,10,2,W);    // 只露出的两只眼睛
  }
  return v;
}

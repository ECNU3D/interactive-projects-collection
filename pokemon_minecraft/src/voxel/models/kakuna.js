import { Vox } from '../vox.js';
// 铁壳蛹
export default function build() {
  const v = new Vox();
  const Y=0xE8C848, DY=0xB8952E, EYE=0x1A1A1A, W=0xFFFFFF;
  v.bevelBox(-2,2,0,9,-2,2,Y);                        // 竖立椭圆硬壳
  v.bevelBox(-3,3,2,7,-2,2,Y);                        // 中部鼓起
  v.bevelBox(-1,1,9,10,-1,1,Y);                       // 顶部收窄
  v.box(0,1,11,11,0,0,Y);                             // 顶部的尖
  v.set(0,12,0,Y);                                    // 尖端
  v.set(-3,5,0,DY); v.set(3,5,0,DY);                  // 壳面侧棱
  for(const s of [1,-1]){
    v.box(s*1,s*1,8,9,2,2,EYE); v.set(s*1,9,2,W);     // 只露出的眼睛+高光
  }
  return v;
}

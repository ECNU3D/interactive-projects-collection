import { Vox } from '../vox.js';
// 大针蜂
export default function build() {
  const v = new Vox();
  const Y=0xF0D040, B=0x2A2A2A, RD=0xD84848, WING=0xF0F0F0, W=0xFFFFFF;
  v.bevelBox(-2,2,0,5,-4,-1,Y);                       // 圆腹部
  v.box(-2,2,1,1,-4,-1,B);                            // 黑色横纹
  v.box(-2,2,3,3,-4,-1,B);                            // 黑色横纹
  v.box(0,1,2,3,-5,-5,W);                             // 白色尾针
  v.bevelBox(-2,2,5,9,-1,2,Y);                        // 胸部
  v.bevelBox(-2,2,9,13,0,3,Y);                        // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,10,11,3,3,RD); v.set(s*1,11,3,W);   // 红眼睛+高光
    v.box(s*1,s*1,14,15,1,1,B); v.set(s*2,15,1,B);    // 黑触角
    v.box(s*1,s*1,3,4,0,0,B);                         // 细黑腿
    v.box(s*3,s*3,6,7,0,0,Y);                         // 针刺手臂:黄基部
    v.box(s*4,s*5,6,8,0,0,W);                         // 白色粗针
    v.box(s*6,s*6,7,7,0,0,W); v.set(s*7,7,0,W);       // 收尖
    v.box(s*1,s*3,9,11,-2,-2,WING);                   // 透明感白翅膀(上)
    v.box(s*1,s*2,7,8,-2,-2,WING);                    // 透明感白翅膀(下)
  }
  return v;
}

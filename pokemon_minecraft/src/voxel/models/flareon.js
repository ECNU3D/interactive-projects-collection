import { Vox } from '../vox.js';
// 火伊布
export default function build() {
  const v = new Vox();
  const O=0xE87B3B, OD=0xC25A24, CR=0xF7D77E,
        EYE=0x1A1A1A, W=0xFFFFFF, M=0x6B2E1A;
  v.bevelBox(-2,2,2,6,-4,1,O);                      // 四足身体
  v.box(-2,-1,0,1,0,1,O); v.box(1,2,0,1,0,1,O);     // 前腿
  v.box(-2,-1,0,1,-4,-3,O); v.box(1,2,0,1,-4,-3,O); // 后腿
  v.bevelBox(-3,3,4,8,0,2,CR);                      // 奶油橙色大围脖
  v.bevelBox(-3,3,6,10,1,6,O);                      // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,8,9,6,6,EYE); v.set(s*1,9,6,W);   // 眼睛
  }
  v.set(0,7,6,M);                                   // 小鼻子
  for(const s of [1,-1]){                           // 尖耳朵
    v.box(s*2,s*3,10,12,2,3,O);
    v.set(s*2,12,3,OD);
  }
  v.box(-1,1,10,12,3,4,CR);                         // 头顶奶油色绒毛
  v.box(0,0,12,13,3,4,CR);
  v.box(0,1,3,5,-5,-4,O);                           // 尾巴根
  v.bevelBox(-2,3,4,9,-8,-5,CR);                    // 又大又蓬的奶油色尾巴
  v.box(-1,2,9,10,-7,-6,CR);                        // 尾尖
  v.set(0,10,-7,CR);
  return v;
}

import { Vox } from '../vox.js';
// 卡蒂狗
export default function build() {
  const v = new Vox();
  const O=0xF0862F, C=0xF7E3B0, K=0x26221E, EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,2,1,2,O);                         // 前腿
    v.box(s*1,s*2,0,2,-4,-3,O);                       // 后腿
  }
  v.bevelBox(-2,2,2,6,-4,2,O);                        // 四足橙色身体
  v.box(-2,2,6,6,-1,-1,K);                            // 背上黑色虎纹
  v.box(-2,2,6,6,-3,-3,K);
  v.box(-1,1,3,5,2,2,C);                              // 奶油色胸毛
  v.box(-2,2,6,7,0,1,C);                              // 奶油色大围脖
  v.bevelBox(-2,2,6,10,1,5,O);                        // 头
  v.box(-1,1,7,8,5,6,C);                              // 奶油色吻部
  v.set(0,8,6,K);                                     // 鼻子
  for(const s of [1,-1]){
    v.box(s*2,s*2,8,9,5,5,EYE); v.set(s*2,9,5,WH);    // 眼睛+高光
    v.box(s*1,s*1,11,12,3,3,O);                       // 小尖耳
  }
  v.box(-1,1,5,8,-5,-5,C);                            // 奶油色蓬松尾巴
  v.box(0,0,9,10,-5,-5,C);
  return v;
}

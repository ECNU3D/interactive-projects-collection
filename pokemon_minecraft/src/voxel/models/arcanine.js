import { Vox } from '../vox.js';
// 风速狗
export default function build() {
  const v = new Vox();
  const O=0xF0862F, C=0xF7E3B0, K=0x26221E, M=0x8C3A22,
        EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,7,1,1,O);                         // 健壮前腿
    v.box(s*1,s*2,0,7,-2,-2,O);                       // 健壮后腿
  }
  v.bevelBox(-2,2,7,10,-3,1,O);                       // 大型橙色身体
  v.box(-2,2,10,10,-1,-1,K);                          // 背上黑色虎纹
  v.box(-2,2,10,10,-3,-3,K);
  for(const s of [1,-1]) v.set(s*2,8,-2,K);           // 体侧虎纹
  v.box(-2,2,8,11,1,2,C);                             // 胸前蓬松大围脖
  v.box(-1,1,11,12,2,3,C);                            // 颈毛
  v.bevelBox(-2,2,12,16,2,6,O);                       // 威猛的头
  v.box(-1,1,13,14,6,7,C);                            // 奶油色吻部
  v.set(0,14,7,K);                                    // 鼻子
  v.box(-1,1,12,12,6,6,M);                            // 嘴
  v.set(-1,12,6,WH); v.set(1,12,6,WH);                // 露出的小獠牙
  for(const s of [1,-1]){
    v.box(s*1,s*1,15,16,6,6,EYE); v.set(s*1,16,6,WH); // 怒目+高光
    v.box(s*3,s*3,13,14,3,4,C);                       // 脸颊蓬松毛
    v.box(s*1,s*1,17,19,3,3,O);                       // 尖耳
  }
  v.box(-1,1,17,17,4,5,C);                            // 头顶蓬松毛
  v.box(-1,1,9,12,-4,-4,C);                           // 奶油色大尾巴
  v.box(0,0,13,15,-4,-4,C);
  return v;
}

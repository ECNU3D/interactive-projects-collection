import { Vox } from '../vox.js';
// 喷火龙
export default function build() {
  const v = new Vox();
  const O=0xF0862F, C=0xF7D77E, WB=0x2E4E8F, EYE=0x1A1A1A, W=0xFFFFFF,
        M=0xA33B22, R=0xE83B23, FO=0xFF9027, FY=0xFFE04A;
  v.box(-4,-2,0,4,0,2,O); v.box(2,4,0,4,0,2,O);     // 粗壮的腿
  v.box(-4,-2,0,0,3,4,O); v.box(2,4,0,0,3,4,O);     // 脚爪
  v.bevelBox(-4,4,4,12,-3,3,O);                     // 大型双足身体
  v.box(-3,3,5,11,3,3,C);                           // 奶油色肚皮
  for(const s of [1,-1]){                           // 短手臂
    v.box(s*5,s*6,9,11,0,2,O);
    v.set(s*5,8,2,W);                               // 白爪
  }
  v.bevelBox(-2,2,12,16,0,3,O);                     // 长颈
  v.bevelBox(-3,3,16,21,-1,5,O);                    // 头
  v.box(-2,2,17,19,5,6,O);                          // 吻部前伸
  for(const s of [1,-1]){
    v.box(s*2,s*3,19,20,4,4,EYE); v.set(s*2,20,4,W);// 眼睛
  }
  v.box(-1,1,17,17,6,6,M);                          // 嘴
  for(const s of [1,-1]){                           // 头后的双角
    v.box(s*1,s*2,21,22,-3,-2,O);
    v.box(s*1,s*2,22,23,-5,-4,O);
  }
  for(const s of [1,-1]){                           // 大翅膀
    v.box(s*5,s*6,11,15,-2,-1,O);                   // 翅膀根
    v.box(s*6,s*11,15,16,-2,-1,O);                  // 橙色翼梁
    v.box(s*6,s*11,12,14,-2,-1,WB);                 // 深蓝翼膜
    v.box(s*6,s*9,10,11,-2,-1,WB);
    v.box(s*6,s*7,9,9,-2,-1,WB);
  }
  v.box(0,1,5,7,-4,-3,O);                           // 尾巴
  v.box(0,1,7,9,-6,-5,O);
  v.box(-1,2,10,13,-6,-4,R);                        // 尾巴火焰:红
  v.box(0,1,14,15,-6,-5,FO);                        //           橙
  v.set(0,16,-5,FY); v.set(1,16,-6,FY);             //           黄尖
  return v;
}

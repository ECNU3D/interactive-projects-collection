import { Vox } from '../vox.js';
// 大比鸟
export default function build() {
  const v = new Vox();
  const BR=0xB08050, DBR=0x8A6440, CR=0xF0DCB0, OR=0xF0A030,
        GOLD=0xF0C040, RD=0xD84840, EYE=0x1A1A1A, W=0xFFFFFF;
  v.box(-2,-1,0,2,0,1,OR); v.box(1,2,0,2,0,1,OR);     // 橙色腿爪
  v.bevelBox(-3,3,3,10,-3,2,BR);                      // 大身体
  v.box(-2,2,4,9,2,2,CR);                             // 奶油色胸
  v.bevelBox(-2,2,10,14,-1,3,BR);                     // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,12,13,3,3,EYE); v.set(s*1,13,3,W);  // 眼睛+高光
    v.box(s*2,s*3,11,12,-1,0,RD);                     // 冠侧红羽
    v.box(s*4,s*6,8,9,-2,1,BR);                       // 完全展开的双翅:内段
    v.box(s*4,s*6,7,7,-2,1,CR);                       // 翼下奶油色
    v.box(s*7,s*10,7,8,-2,1,BR);                      // 外段(翼展宽于身体)
    v.box(s*7,s*10,6,6,-2,1,DBR);                     // 翼缘深色
    v.set(s*11,7,-1,DBR); v.set(s*11,7,0,DBR);        // 翼尖指羽
  }
  v.box(-1,0,11,12,4,4,OR);                           // 大喙
  v.box(-1,0,11,11,5,5,OR);
  v.box(-1,0,15,17,-1,1,GOLD);                        // 金黄华丽长羽冠
  v.box(-1,0,14,16,-3,-2,GOLD);                       // 向后延伸
  v.box(-1,0,13,15,-5,-4,RD);                         // 红色冠尾
  v.box(0,0,12,13,-7,-6,RD);
  v.box(-1,1,5,6,-4,-4,RD);                           // 长尾羽:红段
  v.box(-1,1,6,7,-6,-5,GOLD);                         // 金段
  v.box(0,1,7,9,-8,-7,GOLD);                          // 尾尖
  return v;
}

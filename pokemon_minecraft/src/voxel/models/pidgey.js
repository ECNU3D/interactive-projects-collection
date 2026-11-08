import { Vox } from '../vox.js';
// 波波
export default function build() {
  const v = new Vox();
  const BR=0xB08A58, DBR=0x8A6A40, CR=0xF0DCB0, OR=0xF0A030, EYE=0x1A1A1A, W=0xFFFFFF;
  v.bevelBox(-2,2,1,6,-2,2,BR);                       // 圆身体
  v.box(-1,1,2,5,2,2,CR);                             // 奶油色胸
  v.box(-2,-1,0,0,0,1,OR); v.box(1,2,0,0,0,1,OR);     // 橙色脚
  v.bevelBox(-2,2,6,10,-1,3,BR);                      // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,8,9,3,3,EYE); v.set(s*1,9,3,W);     // 眼睛+高光
    v.box(s*3,s*3,2,5,-1,1,DBR);                      // 贴体小翅膀
  }
  v.box(-1,0,7,8,4,4,OR);                             // 橙色短喙
  v.box(-1,0,11,11,0,1,BR);                           // 头顶羽冠
  v.box(0,0,12,12,-1,0,DBR);                          // 羽冠尖
  v.box(-1,0,2,4,-4,-3,BR);                           // 尾巴
  v.box(-1,0,4,5,-5,-5,DBR);                          // 尾尖
  return v;
}

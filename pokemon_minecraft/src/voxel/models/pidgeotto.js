import { Vox } from '../vox.js';
// 比比鸟
export default function build() {
  const v = new Vox();
  const BR=0xB08050, DBR=0x8A6440, CR=0xF0DCB0, OR=0xF0A030,
        PK=0xE87888, RD=0xC84840, EYE=0x1A1A1A, W=0xFFFFFF;
  v.bevelBox(-3,3,1,8,-3,2,BR);                       // 更大的圆身体
  v.box(-2,2,2,7,2,2,CR);                             // 奶油色胸
  v.box(-2,-1,0,0,0,1,OR); v.box(1,2,0,0,0,1,OR);     // 橙色脚
  v.bevelBox(-2,2,8,12,-1,3,BR);                      // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,10,11,3,3,EYE); v.set(s*1,11,3,W);  // 眼睛+高光
    v.box(s*4,s*4,4,7,-1,1,BR);                       // 翅膀基部展开一点
    v.box(s*5,s*6,5,6,-1,1,DBR);                      // 翼尖
  }
  v.box(-1,0,9,10,4,4,OR);                            // 喙
  v.box(-1,0,13,14,-1,1,PK);                          // 粉红大羽冠:头顶
  v.box(-1,0,12,13,-3,-2,RD);                         // 向后延伸
  v.box(0,0,11,12,-5,-4,RD);                          // 冠尖
  v.box(-1,1,4,5,-4,-4,BR);                           // 尾巴
  v.box(-1,1,5,6,-6,-5,RD);                           // 红色尾羽
  return v;
}

import { Vox } from '../vox.js';
// 巴大蝶
export default function build() {
  const v = new Vox();
  const PU=0x9A88D0, RD=0xD84848, WH=0xF2F2F2, BLK=0x2A2A2A, BLUE=0x5A88D8, W=0xFFFFFF;
  v.box(-2,-1,0,1,0,1,PU); v.box(1,2,0,1,0,1,PU);     // 小脚
  v.bevelBox(-2,2,1,6,-2,2,PU);                       // 紫色小人身体
  v.bevelBox(-3,3,6,11,-2,3,PU);                      // 大头
  for(const s of [1,-1]){
    v.box(s*1,s*2,8,10,3,3,RD); v.set(s*1,10,3,W);    // 大红眼睛+高光
    v.box(s*1,s*1,12,13,0,0,PU); v.set(s*2,14,0,PU);  // 触角
    v.box(s*3,s*3,3,4,1,1,BLUE);                      // 蓝色小手
    v.box(s*4,s*8,7,11,-3,-3,WH);                     // 上大翅膀(白底)
    v.set(s*8,10,-3,BLK); v.set(s*7,11,-3,BLK);       // 上翅黑斑
    v.set(s*5,10,-3,BLK);
    v.box(s*3,s*5,4,6,-3,-3,WH);                      // 下小翅膀(白底)
    v.set(s*4,5,-3,BLK);                              // 下翅黑斑
  }
  v.set(-1,7,3,W); v.set(1,7,3,W);                    // 小獠牙
  return v;
}

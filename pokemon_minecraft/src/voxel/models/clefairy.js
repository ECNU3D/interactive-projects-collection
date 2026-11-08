import { Vox } from '../vox.js';
// 皮皮
export default function build() {
  const v = new Vox();
  const PK=0xF0B0C0, BRE=0x8A5A40, WI=0xF8E4EC, EYE=0x1A1A1A, W=0xFFFFFF, M=0xA33B22;
  v.bevelBox(-3,3,0,7,-3,3,PK);                       // 大圆身体
  v.box(-2,-1,0,1,1,3,PK); v.box(1,2,0,1,1,3,PK);     // 短脚
  for(const s of [1,-1]) v.box(s*4,s*4,3,4,0,1,PK);   // 短手
  v.bevelBox(-3,3,7,12,-2,3,PK);                      // 圆头
  for(const s of [1,-1]){
    v.box(s*1,s*2,9,10,3,3,EYE); v.set(s*1,10,3,W);   // 眼睛+高光
    v.box(s*2,s*3,12,13,0,1,PK);                      // 尖耳朵
    v.box(s*3,s*4,13,14,0,0,BRE);                     // 棕色耳尖
    v.box(s*1,s*2,4,6,-4,-4,WI);                      // 小翅膀
  }
  v.set(-1,8,3,M); v.set(1,8,3,M); v.set(0,7,3,M);    // w 形嘴
  v.box(-1,0,13,13,1,2,PK);                           // 头顶卷曲呆毛
  v.set(-1,14,2,PK);                                  // 呆毛卷尖
  v.box(0,1,1,2,-4,-4,PK);                            // 卷尾巴:根部
  v.box(0,1,3,4,-5,-5,PK);                            // 卷起
  v.set(1,5,-4,PK);                                   // 卷尖
  return v;
}

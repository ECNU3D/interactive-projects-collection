import { Vox } from '../vox.js';
// 皮可西
export default function build() {
  const v = new Vox();
  const PK=0xF0B0C0, BRE=0x8A5A40, WI=0xF8E4EC, EYE=0x1A1A1A, W=0xFFFFFF, M=0xA33B22;
  v.bevelBox(-3,3,0,8,-3,3,PK);                       // 更高的大圆身体
  v.box(-2,-1,0,1,1,3,PK); v.box(1,2,0,1,1,3,PK);     // 脚
  for(const s of [1,-1]) v.box(s*4,s*4,3,6,0,1,PK);   // 较长的手
  v.bevelBox(-3,3,8,13,-2,3,PK);                      // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,10,11,3,3,EYE); v.set(s*1,11,3,W);  // 眼睛+高光
    v.box(s*2,s*3,13,15,0,1,PK);                      // 更大的耳朵
    v.box(s*2,s*2,13,14,1,1,WI);                      // 耳内
    v.box(s*3,s*4,15,16,0,0,BRE);                     // 棕色耳尖
    v.box(s*1,s*2,4,7,-4,-4,WI);                      // 稍大的翅膀
    v.box(s*2,s*3,5,6,-4,-4,WI);
  }
  v.set(-1,9,3,M); v.set(1,9,3,M); v.set(0,8,3,M);    // w 形嘴
  v.box(-1,0,14,14,1,2,PK);                           // 仍卷曲的呆毛
  v.set(-1,15,2,PK);
  v.box(0,1,1,2,-4,-4,PK);                            // 卷尾巴
  v.box(0,1,3,4,-5,-5,PK);
  v.set(1,5,-4,PK);
  return v;
}

import { Vox } from '../vox.js';
// 雷丘
export default function build() {
  const v = new Vox();
  const O=0xF2992E, C=0xFBE8C0, EAR=0x26221E, CH=0xF7D154,
        EYE=0x1A1A1A, W=0xFFFFFF, M=0x8C4A2F, BR=0x9C6528, Y=0xFFD93B;
  v.bevelBox(-3,3,0,6,-3,3,O);                      // 橙色身体
  v.box(-2,2,1,5,3,3,C);                            // 奶油色肚皮
  v.box(-3,-1,0,0,3,4,O); v.box(1,3,0,0,3,4,O);     // 前伸的脚
  for(const s of [1,-1]) v.box(s*4,s*5,3,5,-1,1,O); // 手臂
  v.bevelBox(-5,5,6,13,-4,3,O);                     // 头
  for(const s of [1,-1]){
    v.box(s*2,s*3,10,11,3,3,EYE); v.set(s*2,11,3,W);// 眼睛+高光
    v.box(s*3,s*4,8,9,3,3,CH);                      // 黄色电颊
  }
  v.set(-1,9,3,M); v.set(1,9,3,M); v.set(0,8,3,M);  // w 形嘴
  for(const s of [1,-1]){                           // 更长的耳朵,尖端黑色卷曲
    v.box(s*2,s*3,14,16,-2,-1,O);
    v.box(s*3,s*4,17,18,-2,-1,O);
    v.box(s*4,s*5,19,20,-2,-1,EAR);
    v.set(s*3,20,-2,EAR);                           // 黑色尖端回卷
  }
  v.box(0,0,2,6,-4,-4,BR);                          // 细长尾巴:棕色基部
  v.box(0,0,6,10,-5,-5,BR);
  v.box(-1,1,10,12,-6,-5,Y);                        // 黄色闪电形尾刃
  v.box(0,2,12,14,-6,-5,Y);
  v.del(2,12,-6); v.del(-1,10,-6);                  // 斜切出闪电形
  return v;
}

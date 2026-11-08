import { Vox } from '../vox.js';
// 皮卡丘
export default function build() {
  const v = new Vox();
  const Y=0xFFD93B, EAR=0x26221E, EYE=0x1A1A1A, W=0xFFFFFF,
        CHEEK=0xE8483F, M=0x8C4A2F, BR=0x9C6528;
  v.bevelBox(-3,3,0,5,-3,3,Y);                      // 身体
  v.box(-2,2,4,4,-3,-3,BR); v.box(-2,2,2,2,-3,-3,BR); // 背部两道棕纹
  v.box(-3,-1,0,0,3,4,Y);  v.box(1,3,0,0,3,4,Y);    // 前伸的脚
  for(const s of [1,-1]){
    v.box(s*4,s*5,2,4,-1,1,Y);                      // 手臂
  }
  v.bevelBox(-5,5,5,12,-4,3,Y);                     // 大头
  for(const s of [1,-1]){
    v.box(s*2,s*3,9,10,3,3,EYE); v.set(s*2,10,3,W); // 眼睛+高光
    v.box(s*3,s*4,7,8,3,3,CHEEK);                   // 红脸颊
  }
  v.set(-1,8,3,M); v.set(1,8,3,M); v.set(0,7,3,M);  // w 形嘴
  v.set(0,10,3,0x6B4A2F);                           // 鼻子
  for(const s of [1,-1]){                           // 斜向外的长耳朵
    v.box(s*2,s*3,13,14,-2,-1,Y);
    v.box(s*3,s*4,15,16,-2,-1,Y);
    v.box(s*4,s*5,17,18,-2,-1,EAR);
  }
  v.box(0,1,3,4,-4,-4,BR);                          // 尾巴棕色基部
  v.box(1,2,4,6,-5,-5,Y);                           // 闪电尾:第一段
  v.box(2,3,6,8,-6,-6,Y);                           //        第二段
  v.box(3,7,8,12,-6,-6,Y);                          //        大尾刃
  v.del(6,8,-6); v.del(7,8,-6); v.del(7,9,-6);      //        斜切成闪电形
  v.del(3,11,-6); v.del(3,12,-6);
  return v;
}

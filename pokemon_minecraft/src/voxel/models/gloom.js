import { Vox } from '../vox.js';
// 臭臭花
export default function build() {
  const v = new Vox();
  const BR=0x8A6A50, DBR=0x5A3040, FL=0xA04838, YL=0xF0D040,
        RD=0xD84848, W=0xFFFFFF, DR=0xB8E0E8;
  v.box(-2,-1,0,0,0,1,BR); v.box(1,2,0,0,0,1,BR);     // 小脚
  v.bevelBox(-2,2,1,7,-2,2,BR);                       // 更高的棕色身体
  for(const s of [1,-1]){
    v.box(s*3,s*3,3,4,0,1,BR);                        // 短手
    v.box(s*1,s*2,5,5,2,2,RD); v.set(s*1,5,2,W);      // 半阖红眼
    v.box(s*2,s*4,8,9,-1,1,FL);                       // 棕红色大花瓣(左右)
    v.set(s*3,9,0,YL); v.set(s*4,8,1,YL);             // 黄色花蕊斑点
  }
  v.box(-1,1,3,3,2,2,DBR);                            // 下垂的嘴
  v.set(-2,2,2,DBR); v.set(2,2,2,DBR);                // 嘴角下撇
  v.set(1,2,2,DR); v.set(1,1,2,DR);                   // 流口水
  v.box(-1,1,8,9,2,3,FL);                             // 前花瓣
  v.box(-1,1,8,9,-3,-2,FL);                           // 后花瓣
  v.box(-1,1,8,10,-1,1,FL);                           // 花心
  v.box(-1,0,10,10,0,0,FL);                           // 花顶
  v.set(0,9,3,YL); v.set(0,9,-3,YL); v.set(0,10,0,YL);// 黄色花蕊斑点
  return v;
}

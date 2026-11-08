import { Vox } from '../vox.js';
// 拉达
export default function build() {
  const v = new Vox();
  const BR=0x7A4A52, CR=0xF2E2BC, EYE=0x1A1A1A, W=0xFFFFFF, NOSE=0x4A2A2A, WH=0xE8E8E8;
  v.bevelBox(-3,3,1,6,-5,2,BR);                       // 壮硕身体(深棕紫)
  v.box(-2,2,1,4,1,2,CR);                             // 奶油色下腹
  v.box(-3,-2,0,0,0,2,BR);  v.box(2,3,0,0,0,2,BR);    // 前腿
  v.box(-3,-2,0,0,-4,-3,BR); v.box(2,3,0,0,-4,-3,BR); // 后腿
  v.bevelBox(-3,3,4,9,2,6,BR);                        // 大头
  v.box(-2,1,5,6,6,6,CR);                             // 奶油色吻部
  v.box(-1,0,5,6,7,7,NOSE);                           // 鼻子
  v.box(-1,0,3,4,6,6,W);                              // 更明显的大门牙
  for(const s of [1,-1]){
    v.box(s*1,s*2,7,8,5,5,EYE); v.set(s*1,8,5,W);     // 眼睛+高光
    v.box(s*2,s*3,10,12,3,4,BR);                      // 大耳朵
    v.box(s*2,s*3,10,11,4,4,CR);                      // 耳内
    v.set(s*4,5,6,WH); v.set(s*4,6,6,WH);             // 胡须
  }
  v.box(-1,1,2,3,-6,-6,BR);                           // 粗尾巴:根部
  v.box(-1,1,3,4,-7,-7,BR);                           //       后伸
  v.box(0,1,4,6,-8,-8,BR);                            //       上翘
  v.box(0,1,6,7,-9,-9,CR);                            //       奶油尾尖
  return v;
}

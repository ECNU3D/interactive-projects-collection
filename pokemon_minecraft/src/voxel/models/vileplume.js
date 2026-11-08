import { Vox } from '../vox.js';
// 霸王花
export default function build() {
  const v = new Vox();
  const BL=0x5568B8, RD=0xD84848, DRD=0x7A2828, SP=0xF0E8D0,
        EYE=0x1A1A1A, W=0xFFFFFF, M=0x8A3040;
  v.box(-3,-2,0,1,1,3,BL); v.box(2,3,0,1,1,3,BL);     // 矮壮的脚
  v.bevelBox(-4,4,1,12,-4,4,BL);                      // 矮壮蓝色身体
  for(const s of [1,-1]){
    v.box(s*5,s*5,5,7,0,2,BL);                        // 小短手
    v.box(s*1,s*2,8,9,4,4,EYE); v.set(s*1,9,4,W);     // 眼睛+高光
    v.box(s*4,s*6,13,14,-1,1,RD);                     // 巨花瓣:左右
    v.box(s*6,s*7,14,15,0,0,RD);                      // 瓣尖上翘
    v.set(s*5,14,0,SP); v.set(s*6,14,1,SP);           // 白斑
  }
  v.box(-2,2,5,5,4,4,M); v.set(-3,6,4,M); v.set(3,6,4,M); // 微笑大嘴
  v.box(-2,1,13,14,-2,1,RD);                          // 花心环
  v.box(-1,0,14,14,-1,0,DRD);                         // 花心暗洞
  v.box(-3,2,13,14,2,5,RD);                           // 巨花瓣:前
  v.box(-2,1,14,15,5,6,RD);                           // 前瓣上翘
  v.box(-1,0,15,16,6,6,RD);                           // 前瓣尖
  v.set(-2,14,3,SP); v.set(1,14,4,SP); v.set(0,15,6,SP); // 白斑
  v.box(1,4,13,14,-5,-2,RD); v.box(-4,-1,13,14,-5,-2,RD); // 巨花瓣:后两瓣
  v.box(2,3,14,15,-6,-5,RD); v.box(-3,-2,14,15,-6,-5,RD); // 后瓣尖(共 5 瓣)
  v.set(2,14,-3,SP); v.set(-3,14,-4,SP);              // 白斑
  return v;
}

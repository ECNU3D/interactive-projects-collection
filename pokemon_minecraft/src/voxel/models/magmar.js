import { Vox } from '../vox.js';
// 鸭嘴火兽
export default function build() {
  const v = new Vox();
  const R=0xD8433C, Y=0xF7D77E, O=0xF2A03D, FO=0xFF9027, FY=0xFFE04A,
        EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,2,0,1,R);                         // 双腿
    v.box(s*1,s*2,0,0,2,3,R);                         // 脚
  }
  v.bevelBox(-2,2,3,7,-2,2,R);                        // 红色身体
  v.box(-1,1,4,6,2,2,Y);                              // 黄色火焰纹腹部
  v.set(0,7,2,Y);                                     // 腹纹的火苗尖
  for(const s of [1,-1]) v.box(s*3,s*3,4,8,0,1,R);    // 粗壮手臂
  v.bevelBox(-2,2,8,12,-2,3,R);                       // 头
  v.box(-1,1,9,10,3,5,O);                             // 鸭嘴状的嘴
  for(const s of [1,-1]){
    v.box(s*1,s*1,11,12,3,3,EYE); v.set(s*1,12,3,WH); // 眼睛+高光
    v.box(s*1,s*1,13,14,-1,0,R);                      // 头侧火焰状突起
  }
  v.box(0,0,13,15,0,0,R);                             // 头顶主火焰
  v.set(0,16,0,FY);                                   // 火苗尖
  v.box(0,1,4,6,-4,-3,R);                             // 尾部火苗:红
  v.box(0,0,7,8,-4,-3,FO);                            //          橙
  v.set(0,9,-3,FY);                                   //          黄尖
  return v;
}

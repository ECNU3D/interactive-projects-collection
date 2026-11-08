import { Vox } from '../vox.js';
// 可达鸭
export default function build() {
  const v = new Vox();
  const Y=0xF2D24A, O=0xF2A03D, K=0x26221E, EYE=0x1A1A1A, WH=0xFFFFFF;
  v.bevelBox(-2,2,0,4,-2,2,Y);                        // 圆身体
  v.box(-3,-1,0,0,1,3,O);  v.box(1,3,0,0,1,3,O);      // 橙色蹼足
  v.bevelBox(-2,2,4,9,-2,3,Y);                        // 圆头
  v.box(-2,2,5,6,3,5,O);                              // 扁宽橙色嘴
  for(const s of [1,-1]){
    v.box(s*1,s*1,7,8,3,3,EYE); v.set(s*1,8,3,WH);    // 呆滞眼睛+高光
    v.box(s*3,s*3,3,7,0,1,Y);                         // 举起的手臂
    v.box(s*2,s*3,8,9,0,1,Y);                         // 抱头的手(经典动作)
  }
  v.set(-1,10,0,K); v.set(0,10,1,K); v.set(1,10,0,K); // 头顶三根黑色呆毛
  v.set(0,11,1,K);
  return v;
}

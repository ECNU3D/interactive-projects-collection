import { Vox } from '../vox.js';
// 鲤鱼王
export default function build() {
  const v = new Vox();
  const R=0xE2483A, RD=0xB93A2E, Y=0xF2C14A, GD=0xFFD94A,
        W=0xF5EFE0, EYE=0x1A1A1A, WH=0xFFFFFF, M=0x8C2A1A;
  v.bevelBox(-2,2,0,5,-4,2,R);                        // 侧扁的红色身体
  v.box(-1,1,0,1,-1,2,W);                             // 白色腹部
  v.box(-1,1,1,2,2,2,M);                              // 张大的嘴
  v.box(-1,1,3,3,2,2,RD);                             // 上唇
  for(const s of [1,-1]){
    v.box(s*2,s*2,3,4,2,2,EYE); v.set(s*2,4,2,WH);    // 眼睛+高光
    v.box(s*3,s*3,1,2,1,1,Y);                         // 金色长须
    v.set(s*3,1,-1,Y);                                // 胸鳍
  }
  v.box(-1,1,6,6,0,1,GD);                             // 头顶金色小冠
  v.set(-1,7,0,GD); v.set(0,7,1,GD); v.set(1,7,0,GD); // 冠的三个尖
  v.box(0,0,6,7,-2,-1,Y);                             // 黄色背鳍
  v.box(0,0,0,5,-6,-5,Y);                             // 黄色尾鳍
  v.del(0,0,-6); v.del(0,5,-6);                       // 尾鳍剪出叉形
  return v;
}

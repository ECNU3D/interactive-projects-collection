import { Vox } from '../vox.js';
// 水伊布
export default function build() {
  const v = new Vox();
  const BL=0x5FA8D8, BD=0x3E7BA8, FIN=0xD8E8A8, WH=0xF0F0E8,
        EYE=0x1A1A1A, W=0xFFFFFF, M=0x2E5C6E;
  v.bevelBox(-2,2,2,6,-4,1,BL);                     // 四足身体
  v.box(-2,-1,0,1,0,1,BL); v.box(1,2,0,1,0,1,BL);   // 前腿
  v.box(-2,-1,0,1,-4,-3,BL); v.box(1,2,0,1,-4,-3,BL);// 后腿
  v.bevelBox(-3,3,5,10,1,6,BL);                     // 头
  for(const s of [1,-1]){
    v.box(s*1,s*2,7,8,6,6,EYE); v.set(s*1,8,6,W);   // 眼睛
  }
  v.set(0,6,6,M);                                   // 小鼻子
  v.box(-1,1,10,12,2,3,FIN);                        // 头顶鳍冠
  v.box(0,0,12,13,2,3,FIN);
  for(const s of [1,-1]){                           // 头部两侧的鳍
    v.box(s*3,s*4,7,8,2,3,FIN);
    v.box(s*4,s*5,8,9,2,3,FIN);
  }
  for(const s of [1,-1]){                           // 颈部白色鳍领
    v.box(s*2,s*3,5,7,1,2,WH);
    v.box(s*3,s*4,6,7,1,2,WH);
  }
  v.box(-1,1,4,4,1,2,WH);
  v.box(0,0,6,8,-3,-2,BL);                          // 背鳍
  v.box(0,0,2,7,-5,-5,BL);                          // 鱼形尾巴
  v.box(0,0,3,8,-6,-6,BL);
  v.box(0,0,4,7,-7,-7,BL);
  v.set(0,8,-6,BD); v.set(0,3,-6,BD);               // 尾鳍深色边缘
  return v;
}

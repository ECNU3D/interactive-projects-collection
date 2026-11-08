import { Vox } from '../vox.js';
// 妙蛙种子
export default function build() {
  const v = new Vox();
  const BG=0x6FC0A8, SP=0x35836B, BD=0x3F9C50, BT=0x7ED063,
        EYE=0xD8433C, W=0xFFFFFF, M=0x2E5C4E;
  v.bevelBox(-3,3,1,6,-4,2,BG);                     // 四足身体
  v.box(-3,-2,0,1,1,2,BG);  v.box(2,3,0,1,1,2,BG);  // 前腿
  v.box(-3,-2,0,1,-4,-3,BG); v.box(2,3,0,1,-4,-3,BG);// 后腿
  v.bevelBox(-4,4,3,9,1,7,BG);                      // 前伸的宽头
  for(const s of [1,-1]){
    v.box(s*2,s*3,6,7,7,7,EYE); v.set(s*2,7,7,W);   // 红眼睛
  }
  v.box(-2,2,4,4,7,7,M); v.set(-3,5,7,M); v.set(3,5,7,M); // 大嘴
  for(const s of [1,-1]){                           // 尖耳
    v.box(s*2,s*3,10,11,3,4,BG);
    v.set(s*2,10,4,SP);
  }
  v.bevelBox(-2,2,6,11,-4,0,BD);                    // 背上的种子球茎
  v.box(-1,1,11,12,-3,-1,BT); v.set(0,13,-2,BT);    // 球茎尖
  // 身上的深色斑点
  [[3,5,-1],[-3,4,-2],[3,3,0],[-3,5,1],[4,6,4],[-4,5,3],[4,4,5],[-1,9,5],[2,9,3]]
    .forEach(p=>v.set(p[0],p[1],p[2],SP));
  return v;
}

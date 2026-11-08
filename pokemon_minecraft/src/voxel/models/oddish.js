import { Vox } from '../vox.js';
// 走路草
export default function build() {
  const v = new Vox();
  const BL=0x5568B8, GR=0x60B048, DG=0x488838, RD=0xD84848, W=0xFFFFFF, M=0x28345E;
  v.box(-2,-1,0,0,0,1,BL); v.box(1,2,0,0,0,1,BL);     // 两只小脚
  v.bevelBox(-2,2,1,6,-2,2,BL);                       // 蓝色小圆球身体
  for(const s of [1,-1]){
    v.box(s*1,s*2,4,5,2,2,RD); v.set(s*1,5,2,W);      // 小红眼+高光
    v.box(s*2,s*2,7,8,0,0,DG);                        // 侧叶:叶基
    v.box(s*3,s*3,8,9,0,0,DG); v.set(s*4,9,0,DG);     // 侧叶:外展叶尖
  }
  v.box(-1,1,3,3,2,2,M);                              // 小嘴
  v.box(-1,0,7,10,0,0,GR);                            // 中叶(直立)
  v.box(0,0,7,8,1,1,GR); v.set(0,9,2,GR);             // 前叶
  v.box(0,0,7,8,-1,-1,GR); v.set(0,9,-2,GR);          // 后叶(共 5 片散开)
  return v;
}

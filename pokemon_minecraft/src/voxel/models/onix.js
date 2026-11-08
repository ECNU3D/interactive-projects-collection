import { Vox } from '../vox.js';
// 大岩蛇
export default function build() {
  const v = new Vox();
  const G=0x9A9A94, GD=0x7A7A74, M=0x4A4A44, EYE=0x1A1A1A, WH=0xFFFFFF;
  v.bevelBox(-2,2,0,3,-8,-5,G);                       // S 形立起的长蛇身:第1节(贴地尾段)
  v.bevelBox(-2,2,2,5,-6,-3,G);                       // 第2节
  v.bevelBox(-2,2,4,7,-4,-1,G);                       // 第3节
  v.bevelBox(-1,1,6,9,-2,1,G);                        // 第4节 开始逐节变细
  v.bevelBox(-1,1,8,11,-3,0,G);                       // 第5节 向后弯
  v.bevelBox(-1,1,10,13,-1,2,G);                      // 第6节
  v.bevelBox(-1,1,12,15,0,3,G);                       // 第7节 向前立起
  v.set(2,4,-4,GD); v.set(-2,6,-2,GD);                // 石块的深色棱角
  v.set(1,9,-2,GD); v.set(-1,12,1,GD);
  v.bevelBox(-2,2,14,18,2,6,G);                       // 大岩石头部
  v.box(-2,2,14,14,6,6,M);                            // 宽大的嘴
  for(const s of [1,-1]){
    v.box(s*1,s*1,16,17,6,6,EYE); v.set(s*1,17,6,WH); // 怒目+高光
    v.box(s*1,s*2,18,18,6,6,GD);                      // 压眼的眉棱
  }
  v.box(0,0,19,21,4,4,G);                             // 头上的尖角
  return v;
}

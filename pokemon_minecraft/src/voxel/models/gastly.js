import { Vox } from '../vox.js';
// 鬼斯
export default function build() {
  const v = new Vox();
  const PU=0x6B4A8C, GAS=0x9B7AB8, EYE=0x1A1A1A, W=0xFFFFFF, M=0x2A1A3A;
  v.bevelBox(-2,2,0,4,-2,2,PU);                       // 深紫毒气球核心
  for(const s of [1,-1]){
    v.box(s*1,s*2,2,3,2,2,W);                         // 大眼白
    v.set(s*1,2,2,EYE);                               // 瞳孔
  }
  v.box(-1,1,1,1,2,2,M);                              // 大嘴
  v.set(-1,1,2,W); v.set(1,1,2,W);                    // 獠牙
  // 外围一圈错位浅紫气团,营造雾气感
  const G=[[4,2,0],[-4,3,1],[3,5,-3],[-3,1,-4],[0,5,4],[4,1,-2],
           [-4,4,-2],[3,0,3],[-3,5,3],[0,6,-1],[5,3,2],[-5,2,-1],
           [1,3,5],[-1,2,-5],[4,4,1],[-4,1,2],[2,6,2],[-2,0,-3]];
  G.forEach(p=>v.set(p[0],p[1],p[2],GAS));
  return v;
}

import { Vox } from '../vox.js';
// 九尾-阿罗拉
export default function build() {
  const v = new Vox();
  const SN=0xFBF8F0, HR=0xEFE6D2, EYE=0x7EC8E8, W=0xFFFFFF, NS=0x2A2A2A;
  v.bevelBox(-2,2,3,6,-4,2,SN);                       // 雪白四足身体
  for(const s of [1,-1]){
    v.box(s*1,s*1,0,2,1,2,SN);                        // 前腿
    v.box(s*1,s*1,0,2,-3,-2,SN);                      // 后腿
  }
  v.bevelBox(-2,2,7,10,2,5,SN);                       // 高昂的头
  for(const s of [1,-1]){
    v.box(s*1,s*2,8,9,5,5,EYE); v.set(s*1,9,5,W);     // 冰蓝眼睛+高光
    v.set(s*1,11,3,SN); v.set(s*1,12,3,SN);           // 尖耳
  }
  v.set(0,8,6,NS);                                    // 小鼻子
  v.box(-1,1,11,11,3,4,HR);                           // 头顶华丽卷毛
  v.set(0,12,4,HR); v.set(1,12,3,HR); v.set(-1,12,3,HR);
  const TAILS=[[-4,2],[-3,3],[-2,5],[-1,6],[0,8],[1,6],[2,5],[3,3],[4,2]];
  for(const [x,h] of TAILS){                          // 九条大尾巴扇形展开
    v.box(x,x,5,5+h-1,-5,-5,SN);
    v.set(x,5+h-1,-5,HR);                             // 奶油色尾尖
  }
  return v;
}

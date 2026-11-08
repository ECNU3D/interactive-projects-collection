import { Vox } from '../vox.js';
// 六尾-阿罗拉
export default function build() {
  const v = new Vox();
  const CR=0xF6EFE0, SN=0xFFFFFF, HR=0xEADFC6, EYE=0x4A90D9, W=0xFFFFFF, NS=0x2A2A2A;
  v.bevelBox(-2,2,2,4,-4,2,CR);                       // 奶油白四足身体
  v.box(-2,-1,0,1,0,2,CR);  v.box(1,2,0,1,0,2,CR);    // 前腿
  v.box(-2,-1,0,1,-4,-3,CR); v.box(1,2,0,1,-4,-3,CR); // 后腿
  v.bevelBox(-2,2,4,7,2,5,CR);                        // 头
  for(const s of [1,-1]){
    v.box(s*2,s*2,5,6,5,5,EYE); v.set(s*2,6,5,W);     // 蓝眼睛+高光
    v.box(s*1,s*2,8,8,3,4,CR);                        // 尖耳
    v.set(s*2,9,4,HR);
  }
  v.box(-1,1,8,8,4,5,HR); v.set(0,9,5,HR);            // 头顶卷曲毛
  v.set(0,5,5,NS);                                    // 小鼻子
  v.box(-1,-1,2,5,-5,-5,SN); v.box(1,1,2,5,-5,-5,SN); // 六尾:中间两股
  for(const s of [1,-1]){
    v.box(s*3,s*3,2,4,-4,-3,SN);                      //       侧股:内
    v.box(s*4,s*4,3,5,-3,-2,SN);                      //       侧股:外
  }
  return v;
}

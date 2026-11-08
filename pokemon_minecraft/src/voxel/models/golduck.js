import { Vox } from '../vox.js';
// 哥达鸭
export default function build() {
  const v = new Vox();
  const BL=0x4A90D9, CR=0xE8D8A0, R=0xD8352A, EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,2,0,1,BL);                        // 双腿
    v.box(s*1,s*2,0,0,2,3,BL);                        // 蹼足
    v.box(s*3,s*3,4,8,0,1,BL);                        // 长手臂
    v.box(s*3,s*3,3,3,0,1,WH);                        // 带蹼的手爪
    v.box(s*1,s*1,11,12,3,3,EYE); v.set(s*1,12,3,WH); // 锐利的眼睛+高光
  }
  v.bevelBox(-2,2,3,8,-2,2,BL);                       // 更高更壮的身体
  v.bevelBox(-2,2,9,13,-2,3,BL);                      // 头
  v.box(-2,2,9,10,3,5,CR);                            // 扁宽的嘴
  v.box(0,0,12,13,3,3,R);                             // 额头红色宝珠
  v.box(0,0,14,15,0,1,BL);                            // 头顶尖角
  v.box(0,0,14,14,-2,-1,BL);                          // 后脑尖刺
  v.box(0,0,4,6,-4,-3,BL);                            // 尾巴的鳍
  return v;
}

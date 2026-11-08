import { Vox } from '../vox.js';
// 隆隆岩
export default function build() {
  const v = new Vox();
  const SH=0x8A6B4A, SD=0x6B4F35, SK=0xA89A88, M=0x4A3A32,
        EYE=0x1A1A1A, WH=0xFFFFFF;
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,5,1,2,SK);                        // 粗壮后腿
    v.set(s*1,0,3,WH); v.set(s*2,0,3,WH);             // 白色脚爪
  }
  v.bevelBox(-3,3,5,9,-3,1,SH);                       // 深棕重甲壳(背部大壳)
  v.box(-1,1,10,10,-2,0,SD);                          // 壳顶棱甲
  v.box(-1,1,9,10,1,2,SK);                            // 缩进壳里的脖颈
  v.bevelBox(-2,2,10,14,1,5,SK);                      // 能缩进壳的圆头
  v.box(-1,1,10,10,5,5,M);                            // 嘴
  for(const s of [1,-1]){
    v.box(s*1,s*1,12,13,5,5,EYE); v.set(s*1,13,5,WH); // 眼睛+高光
    v.box(s*4,s*4,6,9,0,1,SK);                        // 粗壮手臂
    v.set(s*4,5,1,WH);                                // 手爪
  }
  return v;
}

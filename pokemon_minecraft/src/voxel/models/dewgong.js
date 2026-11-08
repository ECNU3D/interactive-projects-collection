import { Vox } from '../vox.js';
// 白海狮
export default function build() {
  const v = new Vox();
  const WH=0xF4F4F0, HR=0xFFFFFF, EYE=0x4A7ED9, IV=0xFFF2CC, NS=0x2A2A2A;
  v.bevelBox(-2,2,0,3,-7,2,WH);                       // 更长更壮的身体
  v.bevelBox(-2,2,2,5,3,6,WH);                        // 抬起的头
  for(const s of [1,-1]){
    v.box(s*2,s*2,4,5,6,6,EYE);                       // 蓝眼睛
    v.set(s*1,3,7,IV);                                // 小獠牙
    v.box(s*3,s*3,0,0,0,2,WH);                        // 前鳍贴地
  }
  v.set(0,3,7,NS);                                    // 鼻子
  v.box(0,0,5,6,2,5,HR);                              // 头顶白色长毛流向后方
  v.box(-1,1,1,2,-8,-8,WH);                           // 尾柄
  for(const s of [1,-1]) v.box(s*1,s*2,1,2,-9,-9,WH); // 尾巴大分叉鳍
  return v;
}

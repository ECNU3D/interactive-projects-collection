import { Vox } from '../vox.js';
// 暴鲤龙
export default function build() {
  const v = new Vox();
  const B=0x3A6BC4, C=0xF2E4B8, Y=0xF2C14A, M=0x8C2020,
        EYE=0x1A1A1A, WH=0xFFFFFF;
  v.bevelBox(-2,2,0,2,-7,-4,B);                       // S 形盘绕的多节身体:第1节(贴地尾段)
  v.bevelBox(-2,2,2,5,-6,-3,B);                       // 第2节
  v.bevelBox(-2,2,4,7,-4,-1,B);                       // 第3节
  v.bevelBox(-2,2,6,9,-2,1,B);                        // 第4节 向前弯
  v.bevelBox(-1,1,8,11,-1,2,B);                       // 第5节(变细)
  v.bevelBox(-1,1,10,13,-3,0,B);                      // 第6节 向后收
  v.bevelBox(-1,1,12,15,-1,2,B);                      // 第7节 再向前立起
  v.box(-1,1,0,1,-4,-4,C);                            // 奶油色腹部(沿 S 形贴在身体前侧)
  v.box(-1,1,2,4,-3,-3,C);
  v.box(-1,1,4,6,-1,-1,C);
  v.box(-1,1,6,8,1,1,C);
  v.box(0,0,8,10,2,2,C);
  v.box(0,0,10,12,0,0,C);
  v.box(0,0,12,14,2,2,C);
  v.box(0,0,3,5,-6,-6,WH);                            // 白色背鳍
  v.box(0,0,7,9,-2,-2,WH);
  v.box(0,0,11,13,-3,-3,WH);
  v.bevelBox(-2,2,14,17,2,6,B);                       // 大头
  v.box(-2,2,14,15,6,6,M);                            // 血盆大口
  v.set(-2,15,6,WH); v.set(2,15,6,WH);                // 上獠牙
  v.set(-1,14,6,WH); v.set(1,14,6,WH);                // 下獠牙
  for(const s of [1,-1]){
    v.box(s*1,s*2,16,17,6,6,EYE); v.set(s*1,17,6,WH); // 怒目+高光
  }
  v.box(-1,1,18,18,4,4,Y);                            // 三尖黄色冠:底座
  v.box(0,0,19,20,4,4,Y);                             //        中尖
  v.set(-2,18,4,Y); v.set(2,18,4,Y);                  //        左右尖
  return v;
}

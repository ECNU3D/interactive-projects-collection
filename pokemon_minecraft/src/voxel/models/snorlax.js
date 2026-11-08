import { Vox } from '../vox.js';
// 卡比兽
export default function build() {
  const v = new Vox();
  const T=0x2E6B5E, CR=0xF2E4BC, EYE=0x1A1A1A;
  v.bevelBox(-2,2,0,6,-2,2,T);                        // 深青绿巨胖圆身体(坐姿)
  v.box(-2,2,1,5,2,2,CR);                             // 奶油色大肚皮
  for(const s of [1,-1]){
    v.box(s*1,s*2,0,1,3,4,CR);                        // 粗短脚掌贴地
    v.box(s*3,s*3,3,5,0,1,T);                         // 粗短手臂
  }
  v.bevelBox(-2,2,7,10,0,3,T);                        // 头
  v.box(-2,2,7,9,3,3,CR);                             // 奶油色脸
  v.box(-2,-1,9,9,3,3,EYE); v.box(1,2,9,9,3,3,EYE);   // 闭眼(两条横线)
  for(const s of [1,-1]){                             // 小圆耳朵
    v.set(s*2,11,1,T); v.set(s*2,11,2,T);
  }
  return v;
}

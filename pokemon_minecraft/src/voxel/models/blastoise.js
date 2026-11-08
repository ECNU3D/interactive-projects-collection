import { Vox } from '../vox.js';
// 水箭龟
export default function build() {
  const v = new Vox();
  const BL=0x5E9BD6, SB=0x6B4A2E, CR=0xEFE0AE, CB=0xF2E4B4,
        GY=0x9AA5AD, GD=0x5A666E, EYE=0x5E2C1E, W=0xFFFFFF, M=0x2F5D6B;
  v.bevelBox(-5,5,0,9,-3,3,BL);                     // 大型身体
  v.box(-3,3,1,8,3,3,CB);                           // 奶油色肚皮
  v.box(-3,3,4,4,3,3,0xD8C98F);                     // 肚皮中缝
  for(let x=-5;x<=5;x++)for(let y=2;y<=9;y++){      // 深棕背甲(奶油边)
    const rim=(x===-5||x===5||y===2||y===9);
    v.set(x,y,-4, rim?CR:SB);
  }
  v.box(-4,4,3,8,-5,-5,SB);                         // 背甲鼓包
  v.box(-4,-2,0,1,2,4,BL); v.box(2,4,0,1,2,4,BL);   // 粗腿
  for(const s of [1,-1]) v.box(s*6,s*7,5,7,0,2,BL); // 粗手臂
  v.bevelBox(-4,4,10,16,-3,4,BL);                   // 头
  for(const s of [1,-1]){
    v.box(s*2,s*3,13,14,4,4,EYE); v.set(s*2,14,4,W);// 眼睛
    v.box(s*3,s*4,16,17,0,1,BL);                    // 小尖耳
  }
  v.box(-2,2,11,11,4,4,M);                          // 嘴
  for(const s of [1,-1]){                           // 肩上的水炮管
    v.box(s*3,s*4,9,10,-3,-1,GD);                   // 炮座
    v.box(s*3,s*4,10,11,0,3,GY);                    // 灰色炮管伸向前上方
    v.box(s*3,s*4,11,12,2,3,GY);
    v.box(s*3,s*4,10,11,4,4,GD);                    // 深色炮口
  }
  return v;
}

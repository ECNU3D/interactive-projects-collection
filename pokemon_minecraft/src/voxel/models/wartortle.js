import { Vox } from '../vox.js';
// 卡咪龟
export default function build() {
  const v = new Vox();
  const BL=0x6FA8D8, SB=0xB5713C, CR=0xEFE0AE, CB=0xF2E4B4,
        FE=0xBEE6F5, EYE=0x5E2C1E, W=0xFFFFFF, M=0x2F5D6B;
  v.bevelBox(-3,3,0,7,-2,2,BL);                     // 更高的身体
  v.box(-2,2,1,6,2,2,CB);                           // 肚皮
  for(let x=-3;x<=3;x++)for(let y=1;y<=6;y++){      // 背甲(棕色+奶油边)
    const rim=(x===-3||x===3||y===1||y===6);
    v.set(x,y,-3, rim?CR:SB);
  }
  v.box(-2,2,2,5,-4,-4,SB);                         // 背甲鼓包
  v.box(-3,-1,0,0,2,4,BL); v.box(1,3,0,0,2,4,BL);   // 脚
  for(const s of [1,-1]) v.box(s*4,s*5,4,5,0,2,BL); // 手臂
  v.bevelBox(-4,4,8,14,-3,4,BL);                    // 头
  for(const s of [1,-1]){
    v.box(s*2,s*3,11,12,4,4,EYE); v.set(s*2,12,4,W);// 眼睛
  }
  v.box(-1,1,9,9,4,4,M); v.set(-2,10,4,M); v.set(2,10,4,M); // 微笑
  for(const s of [1,-1]){                           // 浅蓝色羽状耳朵
    v.box(s*2,s*3,15,16,1,2,FE);
    v.box(s*3,s*4,16,17,0,1,FE);
    v.box(s*4,s*5,17,18,-1,0,FE);
  }
  v.box(0,1,1,3,-4,-3,BL);                          // 尾巴根
  v.bevelBox(-1,2,3,8,-7,-4,FE);                    // 又大又毛茸茸的卷尾
  v.box(0,1,8,9,-6,-5,FE);                          // 尾尖上卷
  return v;
}

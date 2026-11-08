import { Vox } from '../vox.js';
// 杰尼龟
export default function build() {
  const v = new Vox();
  const BL=0x79C1E4, SB=0xB5713C, CR=0xEFE0AE, CB=0xF2E4B4,
        EYE=0x5E2C1E, W=0xFFFFFF, M=0x2F5D6B;
  v.bevelBox(-3,3,0,6,-2,2,BL);                     // 身体
  v.box(-2,2,1,5,2,2,CB);                           // 肚皮
  for(let x=-3;x<=3;x++)for(let y=1;y<=5;y++){      // 背甲(棕色+奶油边)
    const rim=(x===-3||x===3||y===1||y===5);
    v.set(x,y,-3, rim?CR:SB);
  }
  v.box(-2,2,2,4,-4,-4,SB);                         // 背甲鼓包
  v.box(-3,-1,0,0,2,4,BL); v.box(1,3,0,0,2,4,BL);   // 脚
  for(const s of [1,-1]) v.box(s*4,s*5,3,4,0,2,BL); // 手臂
  v.bevelBox(-4,4,6,13,-4,3,BL);                    // 圆头
  for(const s of [1,-1]){
    v.box(s*2,s*3,10,11,3,3,EYE); v.set(s*2,11,3,W);// 大眼睛
  }
  v.box(-1,1,8,8,3,3,M); v.set(-2,9,3,M); v.set(2,9,3,M); // 微笑
  v.box(0,1,1,3,-4,-3,BL);                          // 卷尾巴
  v.box(1,2,3,5,-5,-4,BL);
  v.box(-1,1,5,6,-5,-5,BL);
  return v;
}

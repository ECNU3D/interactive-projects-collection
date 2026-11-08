// 体素建造器（与 examples/voxel-viewer.html 定案的模式一致，纯 JS 不依赖 THREE）
export class Vox {
  constructor(){ this.map = new Map(); }
  k(x,y,z){ return x+'|'+y+'|'+z; }
  set(x,y,z,c){ this.map.set(this.k(x,y,z), {x,y,z,c}); }
  del(x,y,z){ this.map.delete(this.k(x,y,z)); }
  has(x,y,z){ return this.map.has(this.k(x,y,z)); }
  nrm(a,b){ return a<=b?[a,b]:[b,a]; }
  box(x1,x2,y1,y2,z1,z2,c){
    [x1,x2]=this.nrm(x1,x2); [y1,y2]=this.nrm(y1,y2); [z1,z2]=this.nrm(z1,z2);
    for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++) this.set(x,y,z,c);
  }
  bevelBox(x1,x2,y1,y2,z1,z2,c){
    [x1,x2]=this.nrm(x1,x2); [y1,y2]=this.nrm(y1,y2); [z1,z2]=this.nrm(z1,z2);
    for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++){
      const e=(x===x1||x===x2)+(y===y1||y===y2)+(z===z1||z===z2);
      if(e>=2) continue;
      this.set(x,y,z,c);
    }
  }
  list(){ return [...this.map.values()]; }
}

// 为 heroes.js 注入 look.weapon / look.build / 头部特征（按人名定位条目，合并进 look）
import fs from 'fs';

const FILE='js/data/heroes.js';
// patch: 合并字段（weapon, build, head, beard, face）
const PATCH = {
  // ---- 天罡 ----
  '宋江':  { build:{h:.94} },
  '卢俊义':{ weapon:'spear', build:{h:1.14} },
  '吴用':  { weapon:'fan' },
  '公孙胜':{ weapon:'sword' },
  '关胜':  { weapon:'podao', face:'red', beard:'long' },
  '林冲':  { weapon:'spear' },
  '秦明':  { weapon:'mace' },
  '呼延灼':{ weapon:'whips' },
  '花荣':  { weapon:'bow' },
  '柴进':  { weapon:'fan' },
  '李应':  { weapon:'spear' },
  '朱仝':  { weapon:'podao', beard:'long' },
  '鲁智深':{ weapon:'staff', build:{w:1.2,h:1.15} },
  '武松':  { weapon:'blade', build:{w:1.12,h:1.05} },
  '董平':  { weapon:'twinSpears' },
  '张清':  { weapon:'pouch' },
  '杨志':  { weapon:'podao' },
  '徐宁':  { weapon:'spear' },
  '索超':  { weapon:'axe' },
  '戴宗':  { build:{h:.96} },
  '刘唐':  { weapon:'podao', head:'mark' },
  '李逵':  { weapon:'axe', head:'savage', beard:'bush', build:{w:1.3,h:1.1} },
  '史进':  { weapon:'trident', build:{w:1.06,h:1.02} },
  '雷横':  { weapon:'blade' },
  '李俊':  { weapon:'oar' },
  '阮小二':{ weapon:'oar', build:{w:1.1} },
  '阮小五':{ weapon:'oar' },
  '阮小七':{ weapon:'oar', build:{w:1.05,h:1.02} },
  '张横':  { weapon:'oar' },
  '张顺':  { build:{w:.86} },
  '解珍':  { weapon:'spear' },
  '解宝':  { weapon:'spear' },
  '燕青':  { weapon:'dagger', build:{w:.92,h:.98} },
  // ---- 特色地煞 ----
  '朱武':  { weapon:'fan' },
  '黄信':  { weapon:'sword' },
  '孙立':  { weapon:'spear' },
  '宣赞':  { weapon:'podao' },
  '郝思文':{ weapon:'spear' },
  '韩滔':  { weapon:'spear' },
  '彭玘':  { weapon:'spear' },
  '萧让':  { weapon:'brush' },
  '裴宣':  { weapon:'blade' },
  '凌振':  { weapon:'cannon' },
  '蒋敬':  { weapon:'abacus' },
  '安道全':{ weapon:'medbox' },
  '樊瑞':  { weapon:'sword', head:'dao' },
  '王英':  { build:{w:.92,h:.72} },
  '扈三娘':{ weapon:'spear', build:{w:.92,h:.98} },
  '鲍旭':  { weapon:'blade' },
  '孔明':  { weapon:'podao' },
  '孔亮':  { weapon:'blade' },
  '乐和':  { weapon:'flute' },
  '马麟':  { weapon:'flute' },
  '孙二娘':{ weapon:'jar' },
  '顾大嫂':{ weapon:'blade' },
  '时迁':  { weapon:'dagger', build:{w:.82,h:.9} },
  '郁保四':{ weapon:'banner', build:{w:.95,h:1.32} },
  '段景住':{ build:{h:.94} },
  '白胜':  { weapon:'jar' },
  '汤隆':  { weapon:'hammer' },
  '朱贵':  { weapon:'bow' },
  '石勇':  { weapon:'blade' },
  '杨雄':  { weapon:'blade' },
  '石秀':  { weapon:'blade', build:{w:1.04,h:1.02} },
  '杜迁':  { build:{h:1.08} },
  '宋万':  { build:{w:1.1,h:1.06} },
  '龚旺':  { weapon:'spear' },
  '丁得孙':{ weapon:'spear' },
  '单廷珪':{ weapon:'spear' },
  '魏定国':{ weapon:'spear' },
  '欧鹏':  { weapon:'podao' },
  '邓飞':  { weapon:'podao' },
  '燕顺':  { weapon:'blade' },
  '郑天寿':{ weapon:'blade' },
  '童威':  { weapon:'oar' },
  '童猛':  { weapon:'oar' },
  '张青':  { weapon:'jar' },
  '朱富':  { weapon:'jar' },
  '蔡福':  { weapon:'podao' },
  '蔡庆':  { weapon:'blade' },
  '陶宗旺':{ weapon:'hammer' },
  '孟康':  { weapon:'oar' },
  '邹渊':  { weapon:'podao' },
  '邹润':  { weapon:'podao' },
  '穆春':  { weapon:'blade' },
  '李忠':  { weapon:'podao' },
  '薛永':  { weapon:'podao' },
  '项充':  { weapon:'blade' },
  '李衮':  { weapon:'blade' },
  '曹正':  { weapon:'podao' },
  '穆弘':  { build:{w:1.08,h:1.04} },
};

let src=fs.readFileSync(FILE,'utf8');
let applied=0, missed=[];
for(const [name,patch] of Object.entries(PATCH)){
  const inject=Object.entries(patch).map(([k,v])=>`${k}:${JSON.stringify(v)}`).join(',');
  // 定位：name:'X' 所在行之后的第一处 look:{...}
  const nameRe=new RegExp(`name:'${name}',[\\s\\S]{0,120}?look:\\{([^}]*)\\}`);
  const m=src.match(nameRe);
  if(!m){ missed.push(name); continue; }
  // 去重：若已含同名字段则先移除旧值
  let inner=m[1];
  for(const k of Object.keys(patch)) inner=inner.replace(new RegExp(`,?${k}:[^,}]+`),'');
  inner=inner.trim().replace(/,$/,'');
  const merged=`look:{${inner}${inner?',':''}${inject}}`;
  src=src.slice(0,m.index)+src.slice(m.index).replace(`look:{${m[1]}}`, merged);
  applied++;
}
fs.writeFileSync(FILE,src);
console.log('applied:',applied,'missed:',missed.join('、')||'无');

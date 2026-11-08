// ============================================================
// 水泊梁山 · 全量音频生成
// 1) BGM ×2（music-2.6-free 纯音乐）
// 2) 108 将对话配音（speech-2.6-hd，按人物分配音色）
// 产物：assets/audio/bgm-main.mp3 / bgm-hall.mp3 / vo/{r}_{p}.mp3
// 支持断点续跑（已存在文件自动跳过）
// ============================================================
import fs from 'fs';
import path from 'path';
import { HEROES } from '../js/data/heroes.js';

const KEY = fs.readFileSync('配音配乐/mini_max_api','utf8').trim();
const BASE='https://api.minimaxi.com';
const OUT='assets/audio';
fs.mkdirSync(path.join(OUT,'vo'),{recursive:true});

// ---------------- 音色分配 ----------------
const FEMALE={ '扈三娘':'female-tianmei', '孙二娘':'female-yujie', '顾大嫂':'female-chengshu' };
const BADAO=new Set(['李逵','鲁智深','秦明','鲍旭','樊瑞','刘唐','雷横','解珍','解宝','龚旺','丁得孙','邹渊','邹润','焦挺','王英','李忠','周通','邓飞','燕顺','陈达','李立','石勇','穆春','周通']);
const JINGYING=new Set(['卢俊义','林冲','武松','花荣','徐宁','索超','史进','张清','杨志','董平','石秀','杨雄','孙立','孙新','穆弘','吕方','郭盛','单廷珪','魏定国','韩滔','彭玘','宣赞','郝思文','欧鹏','马麟','杨春','施恩','阮小二','阮小五','阮小七','张横','张顺','李俊','童威','童猛','郑天寿','宋清']);
const DAXUE=new Set(['燕青','时迁','王定六','段景住','孔明','孔亮','白胜','乐和']);
const PRES=new Set(['柴进','关胜','呼延灼','李应','朱仝','宋万','杜迁','陶宗旺','孟康','侯健','凌振','汤隆','蔡福','蔡庆','李云','朱贵','朱富','曹正','张青','杜兴','黄信','皇甫端','安道全','萧让','裴宣','金大坚','蒋敬']);

function voiceFor(h){
  if(FEMALE[h.name]) return FEMALE[h.name];
  if(BADAO.has(h.name)) return 'male-qn-badao';
  if(DAXUE.has(h.name)) return 'male-qn-daxuesheng';
  if(JINGYING.has(h.name)) return 'male-qn-jingying';
  if(PRES.has(h.name)) return 'presenter_male';
  return 'male-qn-qingse';
}
function tuneFor(h){
  const v=voiceFor(h);
  const pitch=(h.r*7)%9-4;                       // 轻微音高差异
  let speed=1, vol=1;
  if(v==='male-qn-badao'){ speed=1.04; }
  if(v==='male-qn-qingse'){ speed=.96; }
  if(v==='female-tianmei'){ }
  return {pitch,speed,vol};
}
function cleanText(t){
  return t.replace(/（[^）]*）/g,'').replace(/\(\)/g,'').trim(); // 去舞台提示
}

// ---------------- 请求封装 ----------------
async function postJSON(url, body, timeoutMs=120000){
  const ctl=new AbortController();
  const to=setTimeout(()=>ctl.abort(), timeoutMs);
  try{
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
      body:JSON.stringify(body),
      signal:ctl.signal
    });
    return await r.json();
  } finally { clearTimeout(to); }
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function genTTS(text, voice, tune){
  const body={
    model:'speech-2.6-hd',
    text, stream:false,
    voice_setting:{voice_id:voice, speed:tune.speed, vol:tune.vol, pitch:tune.pitch},
    audio_setting:{sample_rate:32000, bitrate:128000, format:'mp3', channel:1},
    output_format:'hex'
  };
  const j=await postJSON(BASE+'/v1/t2a_v2', body, 120000);
  if(j.base_resp?.status_code===0 && j.data?.audio) return Buffer.from(j.data.audio,'hex');
  const code=j.base_resp?.status_code, msg=j.base_resp?.status_msg;
  if(code===1002||code===1039){ const e=new Error('RATE'); e.rate=true; throw e; }
  throw new Error('TTS '+code+':'+msg);
}

async function genMusic(prompt){
  const body={
    model:'music-2.6-free',
    prompt, is_instrumental:true,
    stream:false, output_format:'url',
    audio_setting:{sample_rate:44100, bitrate:256000, format:'mp3'}
  };
  const j=await postJSON(BASE+'/v1/music_generation', body, 360000);
  if(j.base_resp?.status_code!==0) throw new Error('MUSIC '+j.base_resp?.status_code+':'+j.base_resp?.status_msg);
  if(j.data?.status!==2 || !j.data?.audio) throw new Error('MUSIC 未完成 status='+(j.data?.status)+' '+(j.extra_info?'':''));
  const url=j.data.audio;
  const r=await fetch(url);
  if(!r.ok) throw new Error('下载失败 '+r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function withRetry(fn, tries=4){
  for(let i=0;i<tries;i++){
    try{ return await fn(); }
    catch(e){
      if(e.rate||e.message==='RATE'){ console.log('  限流，等待 8s…'); await sleep(8000); continue; }
      if(i===tries-1) throw e;
      console.log('  重试('+i+')：'+e.message);
      await sleep(2500);
    }
  }
}

// ---------------- 任务清单 ----------------
const tasks=[]; // {file, text, voice, tune, tag}
for(const h of HEROES){
  const voice=voiceFor(h), tune=tuneFor(h);
  const pages=[h.greet, ...h.story];
  pages.forEach((t,p)=>{
    const text=cleanText(t);
    if(!text) return;
    tasks.push({file:path.join(OUT,'vo',`${h.r}_${p}.mp3`), text, voice, tune, tag:`${h.name}#${p}`});
  });
}

// ---------------- BGM ----------------
const BGMS=[
  {file:path.join(OUT,'bgm-main.mp3'),
   prompt:'中国古风纯音乐，古琴与竹箫主导，古筝和中国大鼓铺底，苍茫辽阔的江湖气息，水泊芦苇荡的悠远意境，中速舒缓，适合游戏地图探索长时间循环，不要人声'},
  {file:path.join(OUT,'bgm-hall.mp3'),
   prompt:'中国古风纯音乐，编钟、堂鼓与古筝，庄重恢弘的大殿气氛，宋代军乐元素，英雄聚义的豪迈庄严，中速，适合游戏大厅场景循环，不要人声'},
];

async function runBGMS(){
  for(const b of BGMS){
    if(fs.existsSync(b.file) && fs.statSync(b.file).size>100000){ console.log('[BGM] 跳过', b.file); continue; }
    console.log('[BGM] 生成', path.basename(b.file), '…');
    try{
      const buf=await withRetry(()=>genMusic(b.prompt), 3);
      fs.writeFileSync(b.file, buf);
      console.log('[BGM] 完成', path.basename(b.file), (buf.length/1048576).toFixed(1)+'MB');
    }catch(e){ console.log('[BGM] 失败', path.basename(b.file), e.message); }
  }
}

// ---------------- VO（并发池） ----------------
async function runVO(concurrency=3){
  const pending=tasks.filter(t=>!(fs.existsSync(t.file)&&fs.statSync(t.file).size>1000));
  console.log('[VO] 总任务', tasks.length, '已完成', tasks.length-pending.length, '待生成', pending.length);
  let done=0, fail=0; const fails=[];
  let idx=0;
  async function worker(wid){
    while(idx<pending.length){
      const t=pending[idx++];
      try{
        const buf=await withRetry(()=>genTTS(t.text,t.voice,t.tune));
        fs.writeFileSync(t.file, buf);
        done++;
        if(done%20===0) console.log(`[VO] ${done}/${pending.length} (最新: ${t.tag})`);
      }catch(e){
        fail++; fails.push(t.tag+' '+e.message);
        console.log('[VO] 放弃', t.tag, e.message);
      }
      await sleep(400); // 温和节流
    }
  }
  await Promise.all(Array.from({length:concurrency},(_,i)=>worker(i)));
  console.log(`[VO] 完成 ${done}，失败 ${fail}`);
  if(fails.length) console.log('[VO] 失败清单:\n'+fails.join('\n'));
}

// ---------------- 主流程 ----------------
const mode=process.argv[2]||'all';
if(mode==='bgm'||mode==='all') await runBGMS();
if(mode==='vo'||mode==='all') await runVO(Number(process.argv[3]||3));
console.log('== 全部结束 ==');

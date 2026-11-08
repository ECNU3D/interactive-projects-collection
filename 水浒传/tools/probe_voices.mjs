// 探测 MiniMax API 可用性：TTS 音色池 + 音乐生成
import fs from 'fs';

const KEY = fs.readFileSync('配音配乐/mini_max_api','utf8').trim();
const BASE='https://api.minimaxi.com';

async function tryTTS(voiceId){
  const body={
    model:'speech-2.6-hd',
    text:'俺是梁山泊好汉，替天行道！',
    stream:false,
    voice_setting:{voice_id:voiceId, speed:1, vol:1, pitch:0},
    audio_setting:{sample_rate:32000, bitrate:128000, format:'mp3', channel:1},
  };
  const r=await fetch(BASE+'/v1/t2a_v2',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
    body:JSON.stringify(body)
  });
  const j=await r.json();
  if(j.base_resp && j.base_resp.status_code===0 && j.data && j.data.audio){
    return {ok:true, len:j.data.audio.length/2, chars:j.extra_info?.usage_characters};
  }
  return {ok:false, err:j.base_resp?.status_code+':'+j.base_resp?.status_msg};
}

const VOICES=['male-qn-qingse','male-qn-badao','male-qn-jingying','male-qn-rouqing','male-qn-mosheng','male-qn-daxuesheng','male-qn-huanghun','presenter_male','female-chengshu','female-tianmei','female-yujie','female-shaonv'];

for(const v of VOICES){
  try{
    const res=await tryTTS(v);
    console.log(v, res.ok?('OK '+res.len+'B'):'FAIL '+res.err);
  }catch(e){ console.log(v,'ERR',e.message); }
  await new Promise(r=>setTimeout(r,300));
}

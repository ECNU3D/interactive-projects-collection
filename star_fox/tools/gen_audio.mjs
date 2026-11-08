// 批量生成剧情配音与环境配乐（MiniMax API）
// 用法: node tools/gen_audio.mjs [voice|music|all]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const API_KEY = readFileSync(fileURLToPath(new URL('../配音配乐/mini_max_api', import.meta.url)), 'utf8').trim();
const OUT = fileURLToPath(new URL('../assets/audio/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const VOICES = {
  narrator: 'male-qn-qingse',   // 旁白/佩珀将军
  peppy: 'male-qn-jingying',    // 佩比（导师）
  falco: 'male-qn-qingse',      // 法尔科
  slippy: 'female-shaonv',      // 斯利皮
};
const FALLBACK_VOICE = 'male-qn-qingse';

const VOICE_LINES = [
  ['opening_1', 'narrator', '利拉特星系，和平延续了无数世代。直到那一天——安德罗斯皇帝在维诺姆星崛起，向整个星系宣战。', 'calm'],
  ['opening_2', 'narrator', '科内利亚首都市区遭到猛烈攻击，行星防线岌岌可危。佩珀将军向宇宙中最传奇的佣兵小队发出了求救信号。', 'fearful'],
  ['opening_3', 'narrator', '他们，就是星际火狐。', 'calm'],
  ['briefing_corneria', 'narrator', '火狐小队，科内利亚市正在遭受攻击！击退敌机，保护城市，然后在海岸线截击敌军母舰！', 'angry'],
  ['briefing_meteo', 'narrator', '前方是陨石带。敌人的新型武器藏在小行星后面，小心碎石，找出并摧毁它！', 'calm'],
  ['briefing_katina', 'narrator', '卡蒂娜基地遭到围攻，协助防御部队击退敌军，注意地面的炮台和坦克！', 'angry'],
  ['briefing_zoness', 'narrator', '佐内斯的海洋已被污染。敌军潜艇潜伏在海面之下，注意探照灯，不要被打个措手不及！', 'calm'],
  ['briefing_fortuna', 'narrator', '侦测到沃尔夫小队的信号！他们是精英中的精英，全员提高戒备！', 'surprised'],
  ['briefing_venom', 'narrator', '这就是最后的决战。突入维诺姆核心，消灭安德罗斯——为了整个利拉特星系！', 'angry'],
  ['peppy_lockon', 'peppy', '听好了小子！按住鼠标右键锁定目标，准星变红就是锁定完成，松开右键，导弹会自动追踪！', 'fluent'],
  ['peppy_dodge', 'peppy', '被敌人咬住时，左右机动闪避，别当活靶子！', 'angry'],
  ['falco_intro', 'falco', '哼，别拖我后腿。这些杂鱼，交给我也行。', 'disgusted'],
  ['slippy_warn', 'slippy', '哇——敌机从四面八方围过来了！', 'fearful'],
  ['radio_boss', 'slippy', '警告！侦测到巨大能量反应！敌方头目接近中！', 'fearful'],
  ['radio_core', 'peppy', '核心暴露了！就是现在，集中火力攻击！', 'angry'],
  ['radio_victory', 'narrator', '干得好，火狐小队！区域已肃清，准备前往下一个战区！', 'happy'],
  ['radio_gameover', 'narrator', '战机损毁……福克斯，听到请回答！听到请回答！', 'sad'],
  ['falco_cover', 'falco', '我掩护你，冲上去！', 'angry'],
  // ---- 各关战前剧情 ----
  ['story_corneria_1', 'narrator', '福克斯，这里是佩珀。安德罗斯的先锋部队已经突破外层防线，科内利亚市区告急！', 'angry'],
  ['story_corneria_2', 'narrator', '你的任务是撕开敌军的包围圈。记住，整个星系的希望，都在你们的机翼之上。出发！', 'calm'],
  ['story_meteo_1', 'narrator', '科内利亚的危机暂时解除了，但安德罗斯的舰队，正向星系腹地推进。你们必须穿过梅特奥陨石带，抄近路追击！', 'calm'],
  ['story_meteo_2', 'narrator', '陨石带里侦测到不明的武器信号。保持警惕，火狐小队——碎石后面藏着什么，没人知道。', 'fearful'],
  ['story_katina_1', 'narrator', '卡蒂娜前线基地发来求救：敌军的地面部队正在强攻防线，守军撑不了多久了！', 'angry'],
  ['story_katina_2', 'narrator', '立刻驰援卡蒂娜！粉碎敌人的地面攻势，再把他们的母舰，从天上打下来！', 'angry'],
  ['story_zoness_1', 'narrator', '安德罗斯的舰队污染了佐内斯的海洋，整片海域正在死去。而毒海之下，藏着他们的一艘巨型潜艇。', 'sad'],
  ['story_zoness_2', 'narrator', '找出它，击沉它。小心水雷和探照灯——从现在起，你们踏进的是敌人的地盘。', 'calm'],
  ['story_fortuna_1', 'narrator', '截获加密通讯：沃尔夫小队已经在福尔图娜雪原设下埋伏，就等着你们自投罗网。', 'surprised'],
  ['story_fortuna_2', 'narrator', '他们是安德罗斯重金豢养的精英猎手。这一战没有侥幸——让狼群见识一下，什么才是真正的飞行技术！', 'angry'],
  ['story_venom_1', 'narrator', '沃尔夫小队已被击溃，通往维诺姆的航道打开了。安德罗斯，就藏在这颗死星的核心。', 'calm'],
  ['story_venom_2', 'narrator', '这是最后的一战。突入维诺姆核心，终结这场战争——利拉特的星空，等待你们凯旋！', 'angry'],
  // ---- 通关结局 ----
  ['ending_1', 'narrator', '安德罗斯的能量反应正在崩溃——维诺姆核心开始坍缩！福克斯，干得漂亮！', 'happy'],
  ['ending_2', 'narrator', '战争结束了。利拉特星系的每一颗星球，都在传颂火狐小队的名字。', 'happy'],
  ['ending_3', 'narrator', '但是，宇宙的暗处仍有残党蠢动。更高的挑战，正在等待传奇的翼尖。新的轮回，就此开启。', 'calm'],
];

const MUSIC = [
  ['bgm_opening', '史诗电影配乐，太空歌剧开场，恢弘管弦乐与合唱，从紧张压抑到激昂爆发，科幻大片片头曲风格'],
  ['bgm_menu', '英雄主义太空战机主题曲，激昂管弦乐进行曲，铜管嘹亮，鼓点有力，经典太空射击游戏主菜单音乐'],
  ['bgm_corneria', '快节奏英雄管弦乐，城市上空激战，希望与勇气，弦乐快速流动，铜管主题鲜明，游戏战斗配乐'],
  ['bgm_meteo', '紧张摇滚与电子混合，陨石带危机感，驱动力强烈的节奏，电吉他失真，游戏关卡配乐'],
  ['bgm_katina', '军事进行曲，沙漠基地保卫战，定音鼓与小军鼓强烈，铜管短促有力，紧张激烈'],
  ['bgm_zoness', '神秘黑暗电子乐，污染深海，悬疑不安的合成器音色，缓慢沉重节拍'],
  ['bgm_fortuna', '寒冷凛冽管弦乐，雪原高空缠斗，狼群般危险的弦乐颤音，史诗感'],
  ['bgm_venom', '黑暗史诗最终决战配乐，沉重合唱，压迫感极强， doom 氛围，最终Boss决战'],
  ['bgm_boss', '高强度Boss战音乐，急促弦乐十六分音符，重打击乐，铜管不协和音，极度紧张'],
  ['bgm_victory', '胜利凯旋短曲，辉煌铜管齐鸣，欢乐激昂，任务完成主题'],
];

async function post(url, body, timeoutMs = 560000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await res.json();
  } finally { clearTimeout(t); }
}

async function genVoice([name, role, text, emotion]) {
  const path = `${OUT}${name}.mp3`;
  if (existsSync(path)) { console.log(`skip ${name}`); return; }
  for (const vid of [VOICES[role], FALLBACK_VOICE]) {
    try {
      const d = await post('https://api-bj.minimaxi.com/v1/t2a_v2', {
        model: 'speech-2.8-hd', text, stream: false,
        voice_setting: { voice_id: vid, speed: 1.05, vol: 1, pitch: 0, emotion },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      }, 90000);
      if (d?.data?.audio) {
        writeFileSync(path, Buffer.from(d.data.audio, 'hex'));
        console.log(`OK voice ${name} (${vid}, ${(d.data.audio.length / 2 / 1024).toFixed(0)}KB)`);
        return;
      }
      console.log(`FAIL voice ${name} with ${vid}:`, JSON.stringify(d?.base_resp));
    } catch (e) { console.log(`ERR voice ${name} with ${vid}:`, e.message); }
  }
}

async function genMusic([name, prompt]) {
  const path = `${OUT}${name}.mp3`;
  if (existsSync(path)) { console.log(`skip ${name}`); return; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const d = await post('https://api-bj.minimaxi.com/v1/music_generation', {
        model: 'music-2.6-free', prompt, is_instrumental: true, stream: false, output_format: 'hex',
        audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
      }, 400000);
      if (d?.data?.audio) {
        writeFileSync(path, Buffer.from(d.data.audio, 'hex'));
        console.log(`OK music ${name} (attempt ${attempt}, ${(d.data.audio.length / 2 / 1024).toFixed(0)}KB)`);
        return;
      }
      console.log(`FAIL music ${name} attempt ${attempt}:`, JSON.stringify(d?.base_resp));
    } catch (e) { console.log(`ERR music ${name} attempt ${attempt}:`, e.message); }
    await new Promise(r => setTimeout(r, 20000)); // 失败后间隔 20s 再试
  }
}

const mode = process.argv[2] || 'all';
const GAP = +(process.env.GEN_GAP_S || 0);
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
if (mode === 'voice' || mode === 'all') {
  for (const v of VOICE_LINES) { await genVoice(v); if (GAP) await sleep(GAP); }
}
if (mode === 'music' || mode === 'all') {
  for (const m of MUSIC) { await genMusic(m); if (GAP) await sleep(GAP); }
}
console.log('DONE');

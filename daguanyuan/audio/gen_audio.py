#!/usr/bin/env python3
"""調用 MiniMax API 生成講解配音（TTS）與配樂（BGM）。

  cd audio && python3 gen_audio.py            # 生成缺少的音頻
  python3 gen_audio.py --only xiaoxiang       # 只生成指定條目
  python3 gen_audio.py --bgm                  # 只生成配樂

已存在且大於 10KB 的 mp3 會跳過；刪掉對應文件即可重生成。
密鑰取自 ../配音配乐/mini_max_api
"""
import json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(HERE, '..', '配音配乐', 'mini_max_api')).read().strip()
BASE = 'https://api.minimaxi.com'

# 地點講解用沉穩女聲；人物故事另用一色，聽感上把「導覽」與「說書」分開
VOICE_PLACE = 'female-chengshu'
VOICE_PERSON = 'female-tianmei'
PERSON_IDS = {
    'jiamu_ren', 'wangfuren', 'fengjie_ren', 'jiazheng', 'baoyu', 'daiyu', 'baochai',
    'tanchun', 'xiangyun', 'liwan', 'yingxi', 'miaoyu', 'xiren',
}

BGM = {
    'bgm_fu': ('中國古風純音樂，古琴、簫、編鐘與低音鼓，清代王府庭院，莊重深沉，'
               '緩慢肅穆，禮制森嚴的深宅大院，適合博物館展廳背景音樂，純器樂無人聲'),
    'bgm_yuan': ('中國古風純音樂，古箏、竹笛、琵琶與洞簫，江南園林春日，清雅空靈，'
                 '流水潺潺花木扶疏，少女詩社的閒適與淡淡愁緒，中慢速，純器樂無人聲'),
    'bgm_ye': ('中國古風純音樂，琵琶與洞簫為主，中秋月夜，寂寥清冷，'
               '疏落的音符與長長的留白，帶一絲淒美，慢速，純器樂無人聲'),
}


def post(path, payload, timeout=600):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def tts(text, out_path, voice_id, speed=0.95):
    body = {
        'model': 'speech-2.6-hd',
        'text': text,
        'stream': False,
        'language_boost': 'Chinese',
        'output_format': 'hex',
        'voice_setting': {'voice_id': voice_id, 'speed': speed, 'vol': 1.0, 'pitch': 0},
        'audio_setting': {'sample_rate': 32000, 'bitrate': 128000, 'format': 'mp3', 'channel': 1},
    }
    resp = post('/v1/t2a_v2', body)
    code = resp.get('base_resp', {}).get('status_code')
    if code != 0:
        raise RuntimeError(f"TTS failed {code}: {resp.get('base_resp', {}).get('status_msg')}")
    with open(out_path, 'wb') as f:
        f.write(bytes.fromhex(resp['data']['audio']))
    ms = resp.get('extra_info', {}).get('audio_length', 0)
    print(f"  ok {os.path.basename(out_path)} ({ms/1000:.1f}s, {os.path.getsize(out_path)//1024}KB)", flush=True)


def music(out_path, prompt):
    for model in ('music-2.6', 'music-2.6-free', 'music-1.5'):
        try:
            resp = post('/v1/music_generation', {
                'model': model,
                'prompt': prompt,
                'is_instrumental': True,
                'output_format': 'hex',
                'audio_setting': {'sample_rate': 44100, 'bitrate': 256000, 'format': 'mp3'},
            }, timeout=900)
            code = resp.get('base_resp', {}).get('status_code')
            if code != 0:
                print(f"  music {model} failed {code}: {resp.get('base_resp', {}).get('status_msg')}", flush=True)
                continue
            with open(out_path, 'wb') as f:
                f.write(bytes.fromhex(resp['data']['audio']))
            print(f"  ok {os.path.basename(out_path)} via {model} ({os.path.getsize(out_path)//1024}KB)", flush=True)
            return
        except Exception as e:
            print(f"  music {model} error: {e}", flush=True)
    raise RuntimeError('music generation failed on all models')


def main():
    args = sys.argv[1:]
    only = None
    if '--only' in args:
        only = args[args.index('--only') + 1]
    bgm_only = '--bgm' in args

    failed = []
    if not bgm_only:
        narrations = json.load(open(os.path.join(HERE, 'narrations.json'), encoding='utf-8'))
        items = [(k, v) for k, v in narrations.items() if only is None or k == only]
        print(f"narrations: {len(items)}", flush=True)
        for key, item in items:
            out = os.path.join(HERE, f'{key}.mp3')
            if os.path.exists(out) and os.path.getsize(out) > 10000 and only is None:
                print(f"  skip {key}.mp3 (exists)", flush=True)
                continue
            voice = VOICE_PERSON if key in PERSON_IDS else VOICE_PLACE
            print(f"  tts {key} [{voice}] ...", flush=True)
            for attempt in range(3):
                try:
                    tts(item['text'], out, voice)
                    break
                except Exception as e:
                    print(f"    attempt {attempt+1} failed: {e}", flush=True)
                    time.sleep(5 * (attempt + 1))
            else:
                failed.append(key)
            time.sleep(1.0)

    if only is None:
        for name, prompt in BGM.items():
            out = os.path.join(HERE, f'{name}.mp3')
            if os.path.exists(out) and os.path.getsize(out) > 100000:
                print(f"  skip {name}.mp3 (exists)", flush=True)
                continue
            print(f"  music {name} ...", flush=True)
            try:
                music(out, prompt)
            except Exception as e:
                print(f"  {name} FAILED: {e}", flush=True)
                failed.append(name)

    if failed:
        print(f"FAILED: {failed}", flush=True)
        sys.exit(1)
    print("ALL DONE", flush=True)


if __name__ == '__main__':
    main()

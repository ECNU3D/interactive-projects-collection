#!/usr/bin/env python3
"""调用 MiniMax API 生成讲解配音（TTS）与古风配乐（BGM）。"""
import json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(HERE, '..', '配音配乐', 'mini_max_api')).read().strip()
BASE = 'https://api.minimaxi.com'

def post(path, payload, timeout=300):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + KEY,
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))

def tts(text, out_path, voice_id='female-chengshu', speed=0.95):
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
    audio_hex = resp['data']['audio']
    with open(out_path, 'wb') as f:
        f.write(bytes.fromhex(audio_hex))
    ms = resp.get('extra_info', {}).get('audio_length', 0)
    print(f"  ok {os.path.basename(out_path)} ({ms/1000:.1f}s, {os.path.getsize(out_path)//1024}KB)", flush=True)

def music(out_path):
    prompt = ('中国古风纯音乐，古筝、竹笛、洞箫与琵琶，宋代汴京市井画卷，春日游赏，'
              '典雅悠远，温暖生动，中速，层次丰富，适合博物馆长卷展览的背景音乐，无人声')
    for model in ('music-2.6', 'music-2.6-free'):
        try:
            resp = post('/v1/music_generation', {
                'model': model,
                'prompt': prompt,
                'is_instrumental': True,
                'output_format': 'hex',
                'audio_setting': {'sample_rate': 44100, 'bitrate': 256000, 'format': 'mp3'},
            }, timeout=600)
            code = resp.get('base_resp', {}).get('status_code')
            if code != 0:
                print(f"  music {model} failed {code}: {resp.get('base_resp', {}).get('status_msg')}", flush=True)
                continue
            with open(out_path, 'wb') as f:
                f.write(bytes.fromhex(resp['data']['audio']))
            print(f"  ok bgm.mp3 via {model} ({os.path.getsize(out_path)//1024}KB)", flush=True)
            return
        except Exception as e:
            print(f"  music {model} error: {e}", flush=True)
    raise RuntimeError('music generation failed on all models')

def main():
    narrations = json.load(open(os.path.join(HERE, 'narrations.json')))
    print(f"narrations: {len(narrations)}", flush=True)
    failed = []
    for key, item in narrations.items():
        out = os.path.join(HERE, f'{key}.mp3')
        if os.path.exists(out) and os.path.getsize(out) > 10000:
            print(f"  skip {key}.mp3 (exists)", flush=True)
            continue
        print(f"  tts {key} ...", flush=True)
        for attempt in range(3):
            try:
                tts(item['text'], out)
                break
            except Exception as e:
                print(f"    attempt {attempt+1} failed: {e}", flush=True)
                time.sleep(5 * (attempt + 1))
        else:
            failed.append(key)
        time.sleep(1.2)

    bgm = os.path.join(HERE, 'bgm.mp3')
    if not (os.path.exists(bgm) and os.path.getsize(bgm) > 100000):
        print("  generating bgm ...", flush=True)
        try:
            music(bgm)
        except Exception as e:
            print(f"  BGM FAILED: {e}", flush=True)
            failed.append('bgm')

    if failed:
        print(f"FAILED: {failed}", flush=True)
        sys.exit(1)
    print("ALL DONE", flush=True)

if __name__ == '__main__':
    main()

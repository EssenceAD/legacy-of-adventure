# audio_raw/*.wav -> public/audio/bgm/*.mp3 (무음 자르기, 페이드, -16 LUFS, 160kbps)
#  팡파르 J6~J8 -> public/audio/jingle/J*.mp3 (앞 몇 초만 · 끝 페이드 · -16 LUFS)
#  실행: py scripts/audio_proc.py [번호 ...]   (예: py scripts/audio_proc.py 19 20 J6)
#  ffmpeg: PATH에 없으면 FFMPEG 환경 변수로 경로 (ffprobe 없어도 됨) · 임시 파일은 AUDIO_TMP(없으면 시스템 임시 폴더)
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
RAW, OUT, JOUT = ROOT / 'audio_raw', ROOT / 'public' / 'audio' / 'bgm', ROOT / 'public' / 'audio' / 'jingle'
FF = os.environ.get('FFMPEG', 'ffmpeg')
TMP = Path(os.environ.get('AUDIO_TMP', tempfile.gettempdir()))
NAMES = {'01':'legacy_of_adventure','02':'morning_firewood','03':'inn_afternoon','04':'market_day','05':'breezy_hill',
 '06':'by_the_campfire','07':'starlight_music_box','08':'sleeping_inn','09':'run_the_forest_path','10':'into_the_deep',
 '11':'king_of_the_forest','12':'final_strike','13':'feathered_hat_march','14':'neighbors_yard','15':'night_face_to_face',
 '16':'old_map_in_the_attic','17':'back_on_the_road','18':'this_is_my_place',
 # 2차 추가 (MUSIC_PLAN 「2차 추가」)
 '19':'endless_abyss','20':'wind_over_fields','21':'salt_and_sand','22':'ember_and_cloud','23':'giants_footsteps',
 '24':'all_together','25':'five_stars','26':'rainy_window','27':'lantern_lane'}
# 팡파르: 앞 몇 초만 [길이, 끝 페이드] (RAIDWEAPON §0: 승리 2~3초 · 레벨 업 1~1.5초)
JINGLES = {'J6': (2.8, 0.5), 'J7': (2.8, 0.5), 'J8': (1.4, 0.3)}
for d in (OUT, JOUT, TMP): d.mkdir(parents=True, exist_ok=True)
def run(a): return subprocess.run(a, capture_output=True, text=True, encoding='utf-8', errors='replace')
def duration(p):
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', run([FF, '-hide_banner', '-i', str(p)]).stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
def ebur(p):
    s = run([FF, '-hide_banner', '-nostats', '-i', str(p), '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr
    s = s[s.rindex('Summary:'):]
    return float(re.search(r'I:\s+(-?[\d.]+)', s)[1]), float(re.search(r'Peak:\s+(-?[\d.]+|-inf)', s)[1])
only = set(sys.argv[1:])
TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse'
for f in sorted(RAW.glob('*.wav')):
    if '(' in f.stem: continue  # 「19 Endless Abyss (1).wav」 같은 중복 다운로드는 건너뜀
    k = re.split(r'[ _]', f.stem)[0]
    if only and k not in only: continue
    if k in JINGLES:
        keep, fo = JINGLES[k]
        tmp = TMP / f'_{k}.wav'
        run([FF, '-y', '-hide_banner', '-i', str(f), '-af', 'silenceremove=start_periods=1:start_threshold=-50dB', '-t', str(keep), str(tmp)])
        d2 = duration(tmp)
        i, pk = ebur(tmp)
        gain = min(-16 - i, -1.5 - pk)  # -16 LUFS, 피크는 -1.5 dBFS 아래
        af = f'afade=t=in:d=0.005,afade=t=out:st={max(0, d2 - fo):.2f}:d={fo},volume={gain:.2f}dB,aresample=44100'
        dst = JOUT / f'{k}.mp3'
        r = run([FF, '-y', '-hide_banner', '-i', str(tmp), '-af', af, '-c:a', 'libmp3lame', '-b:a', '160k', str(dst)])
        tmp.unlink()
        print(f'{dst.name}: {duration(f):.1f}s -> {d2:.2f}s, in {i} LUFS / peak {pk} dB, gain {gain:+.1f}dB, {dst.stat().st_size/1e3:.0f}KB' if r.returncode == 0 else r.stderr[-400:])
        continue
    if k not in NAMES: continue
    dur = duration(f)
    m = run([FF,'-hide_banner','-i',str(f),'-af',TRIM+',loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}')+1])
    tmp = TMP / f'_{k}.wav'
    run([FF,'-y','-hide_banner','-i',str(f),'-af',TRIM,str(tmp)])
    d2 = duration(tmp)
    ln = f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
    af = f"afade=t=in:d=0.03,afade=t=out:st={max(0,d2-2.5):.2f}:d=2.5,{ln},aresample=44100"
    dst = OUT / f'{k}_{NAMES[k]}.mp3'
    r = run([FF,'-y','-hide_banner','-i',str(tmp),'-af',af,'-c:a','libmp3lame','-b:a','160k',str(dst)])
    tmp.unlink()
    print(f'{dst.name}: {dur:.1f}s -> {d2:.1f}s, in {j["input_i"]} LUFS / TP {j["input_tp"]}, {dst.stat().st_size/1e6:.1f}MB' if r.returncode==0 else r.stderr[-400:])

# audio_raw/*.wav -> public/audio/bgm/*.mp3 (무음 자르기, 페이드, -16 LUFS, 160kbps)
import json, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / 'audio_raw', ROOT / 'public' / 'audio' / 'bgm'
NAMES = {'01':'legacy_of_adventure','02':'morning_firewood','03':'inn_afternoon','04':'market_day','05':'breezy_hill',
 '06':'by_the_campfire','07':'starlight_music_box','08':'sleeping_inn','09':'run_the_forest_path','10':'into_the_deep',
 '11':'king_of_the_forest','12':'final_strike','13':'feathered_hat_march','14':'neighbors_yard','15':'night_face_to_face',
 '16':'old_map_in_the_attic','17':'back_on_the_road','18':'this_is_my_place'}
OUT.mkdir(parents=True, exist_ok=True)
def run(a): return subprocess.run(a, capture_output=True, text=True)
only = set(sys.argv[1:])
for f in sorted(RAW.glob('*.wav')):
    k = re.split(r'[ _]', f.stem)[0]
    if k not in NAMES or (only and k not in only): continue
    dur = float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(f)]).stdout)
    trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse'
    m = run(['ffmpeg','-hide_banner','-i',str(f),'-af',trim+',loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}')+1])
    tmp = Path('/tmp') / f'_{k}.wav'
    run(['ffmpeg','-y','-hide_banner','-i',str(f),'-af',trim,str(tmp)])
    d2 = float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(tmp)]).stdout)
    ln = f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
    af = f"afade=t=in:d=0.03,afade=t=out:st={max(0,d2-2.5):.2f}:d=2.5,{ln},aresample=44100"
    dst = OUT / f'{k}_{NAMES[k]}.mp3'
    r = run(['ffmpeg','-y','-hide_banner','-i',str(tmp),'-af',af,'-c:a','libmp3lame','-b:a','160k',str(dst)])
    tmp.unlink()
    print(f'{dst.name}: {dur:.1f}s -> {d2:.1f}s, {dst.stat().st_size/1e6:.1f}MB' if r.returncode==0 else r.stderr[-400:])

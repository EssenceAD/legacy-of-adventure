# audio_raw 효과음·팡파르·마을소리 -> public/audio/{sfx,jingle,amb}
import subprocess, numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; RAW = ROOT/'audio_raw'; PUB = ROOT/'public'/'audio'
SR = 44100
# 이름: (최대 길이 초, 목표 피크 dBFS)  — UI 소리는 작게
SFX = {'tap':(0.35,-12),'open':(0.9,-10),'close':(0.7,-11),'coin':(1.1,-6),'build':(1.1,-6),'place_bad':(0.7,-9),
 'mission':(1.6,-6),'event':(1.6,-7),'heart':(1.8,-8),'night':(3.0,-10),'item':(1.6,-6),'rare':(2.6,-5),'fail':(1.6,-7),
 'hit':(0.6,-6),'crit':(1.0,-4),'skill':(1.3,-6),'block':(0.9,-6),'perfect':(1.6,-5)}
JIN = {'J1':4.4,'J2':5.5,'J3':6.5,'J4':5.0,'J5':3.5}
def load(f, ch):
    r = subprocess.run(['ffmpeg','-v','error','-i',str(f),'-ac',str(ch),'-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True)
    return np.frombuffer(r.stdout,np.float32).reshape(-1,ch).copy()
def save(y, dst, ch, fmt):
    raw = np.clip(y,-1,1).astype(np.float32).tobytes()
    enc = ['-c:a','pcm_s16le'] if fmt=='wav' else ['-c:a','libmp3lame','-b:a',fmt]
    subprocess.run(['ffmpeg','-y','-v','error','-f','f32le','-ar',str(SR),'-ac',str(ch),'-i','-',*enc,str(dst)],input=raw,check=True)
def env(y, win=0.02):
    m = np.abs(y).max(1); n=int(SR*win); k=len(m)//n
    return np.sqrt((m[:k*n].reshape(k,n)**2).mean(1)), n
def trim(y, maxlen, rel=-42):
    e,n = env(y); pk = e.max(); thr = pk*10**(rel/20)
    idx = np.where(e>thr)[0]; s = max(0,idx[0]*n - int(0.004*SR)); t = min(len(y),(idx[-1]+1)*n)
    y = y[s:t][:int(maxlen*SR)]
    f = min(len(y)//3, int(0.12*SR)); y[-f:] *= np.linspace(1,0,f)[:,None]**2
    a = int(0.002*SR); y[:a] *= np.linspace(0,1,a)[:,None]
    return y
def peak(y, db): return y * (10**(db/20)/max(1e-6,np.abs(y).max()))
for d in ['sfx','jingle','amb']: (PUB/d).mkdir(parents=True,exist_ok=True)
for k,(ml,db) in SFX.items():
    y = peak(trim(load(RAW/f'{k}.wav',1), ml), db); save(y, PUB/'sfx'/f'{k}.wav', 1, 'wav')
    print(f'sfx {k}: {len(y)/SR:.2f}s')
for k,ml in JIN.items():
    y = load(RAW/f'{k}.wav',2); y = trim(y, ml, -48)
    f=int(0.6*SR); y[-f:] *= np.linspace(1,0,f)[:,None]
    y = peak(y,-2.5); save(y, PUB/'jingle'/f'{k}.mp3', 2, '160k'); print(f'jingle {k}: {len(y)/SR:.2f}s')
for k in ['amb_day','amb_night']:
    src = RAW/f'{k}.wav'
    # 노이즈 줄이기: 저역·고역 컷 + 약한 디노이즈
    r = subprocess.run(['ffmpeg','-v','error','-i',str(src),'-af','highpass=f=120,lowpass=f=7000,afftdn=nr=10:nf=-40','-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True)
    y = np.frombuffer(r.stdout,np.float32).reshape(-1,2).copy()
    y = y[int(0.3*SR):len(y)-int(0.3*SR)]
    F = int(2.0*SR); w = np.linspace(0,1,F)[:,None]   # 끝 2초를 처음과 겹쳐 이음매 없는 루프
    loop = y[:len(y)-F].copy(); loop[:F] = y[:F]*np.sqrt(w) + y[len(y)-F:]*np.sqrt(1-w)
    rms = np.sqrt((loop**2).mean()); loop *= 10**(-34/20)/rms   # 아주 작게 (배경음보다 한참 아래)
    save(loop, PUB/'amb'/f'{k}.mp3', 2, '128k'); print(f'amb {k}: {len(loop)/SR:.2f}s rms -34dB peak {20*np.log10(np.abs(loop).max()):.1f}dB')

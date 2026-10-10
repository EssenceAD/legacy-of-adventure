import sys,json,os,numpy as np
from PIL import Image
from scipy import ndimage as nd
import os
R=os.path.abspath(os.environ.get('ASSET_ROOT','.'))+'/'
SPEC=json.loads(sys.argv[1])  # {name:[footW,footH,widthFactor]}
def cut(im,ss=42):
    a=np.asarray(im.convert('RGB')).astype(int);mx=a.max(2);mn=a.min(2);sat=mx-mn
    cs=[a[2,2],a[2,-3],a[-3,2],a[-3,-3]]
    d=np.min([np.abs(a-c).sum(2) for c in cs],axis=0)
    bg=((d<70)&(sat<34))|((mx>228)&(sat<26))
    lab,n=nd.label(bg);edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    m=~np.isin(lab,list(edge))
    # second pass: soft grey shadows touching background
    sh=(mx>150)&(sat<16)&m
    lab2,_=nd.label(sh);bgd=nd.binary_dilation(~m,iterations=2)
    touch=set(np.unique(lab2[bgd&sh]))-{0}
    m&=~np.isin(lab2,list(touch))
    m=nd.binary_opening(m,iterations=2)
    l3,n3=nd.label(m);sizes=nd.sum(m,l3,range(1,n3+1));keep=[i+1 for i,s in enumerate(sizes) if s>max(sizes)*0.04]
    m=np.isin(l3,keep);m=nd.binary_fill_holes(m)
    H=m.shape[0];ys0=np.where(m.any(1))[0];lo=ys0.max()-int((ys0.max()-ys0.min())*.25)
    for _ in range(3 if ss else 0):
        wh=(mx>185)&(sat<ss)&m;wh[:lo]=False
        lw,_n=nd.label(wh);out=nd.binary_dilation(~m,iterations=1)
        t=set(np.unique(lw[out&wh]))-{0}
        if not t:break
        m&=~np.isin(lw,list(t))
    ys,xs=np.where(m);box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
    rgba=np.dstack([a.astype(np.uint8),(m*255).astype(np.uint8)])
    return Image.fromarray(rgba,'RGBA').crop(box)
outs={}
for k,v in SPEC.items():
    fw,fh,wf=v[:3];ss=v[3] if len(v)>3 else 42
    im=cut(Image.open(R+'raw/'+k+'.png'),ss)
    tw=round((fw+fh)*16*wf);th=round(im.height*tw/im.width)
    sm=im.resize((tw,th),Image.BOX)
    outs[k]=(sm,fw,fh)
# shared palette
pal_src=Image.open(R+'palette.png').convert('RGB') if os.path.exists(R+'palette.png') else None
if pal_src is None:
    tiles=[np.asarray(o[0])[...,:3][np.asarray(o[0])[...,3]>128] for o in outs.values()]
    allpx=np.concatenate(tiles)[None,...]
    pal_src=Image.fromarray(allpx.astype(np.uint8)).quantize(72,method=Image.MEDIANCUT)
    pal_src.convert('RGB').save(R+'palette.png')
palimg=pal_src if pal_src.mode=='P' else pal_src.quantize(72,method=Image.MEDIANCUT)
meta=json.load(open(R+'sp/meta.json')) if os.path.exists(R+'sp/meta.json') else {}
for k,(sm,fw,fh) in outs.items():
    a=np.asarray(sm);al=a[...,3]>140
    q=Image.fromarray(a[...,:3]).quantize(40,method=Image.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')
    qa=np.dstack([np.asarray(q),(al*255).astype(np.uint8)])
    # 1px dark outline on transparent neighbours (unify edges)
    o=qa.copy();mask=al;dil=nd.binary_dilation(mask)&~mask
    o[dil]=[28,16,24,255]
    Image.fromarray(o,'RGBA').save(R+'sp/'+k+'.png')
    meta[k]={'w':o.shape[1],'h':o.shape[0],'fw':fw,'fh':fh}
json.dump(meta,open(R+'sp/meta.json','w'))
print(meta)

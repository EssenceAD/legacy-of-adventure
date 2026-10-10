import numpy as np, json
from PIL import Image
import os
R=os.path.abspath(os.environ.get('ASSET_ROOT','.'))+'/'
B={
'inn':[(13,52,24,70),(34,60,46,78),(72,55,84,72),(12,80,23,98),(82,85,93,103),(63,92,75,110)],
'inn3':[(57,26,78,38),(47,64,56,76),(80,64,90,76),(108,62,124,80),(118,80,128,96),(106,100,118,116),(40,84,50,98),(53,80,63,96),(40,104,50,118),(53,100,63,116),(72,80,83,96),(86,84,97,100),(72,100,83,116),(86,104,97,118),(42,124,54,142),(56,122,66,136),(72,122,82,136),(86,126,96,140),(104,124,114,138),(118,122,128,136),(10,82,22,98),(20,104,30,120)],
'tavern':[(84,55,96,72),(70,60,81,77),(28,40,36,52)],
'tavern2':[(48,36,60,52),(78,50,92,66),(104,46,118,64),(82,74,94,92),(110,78,130,92)],
'cottage':[(18,40,31,55),(41,46,55,61),(23,19,33,33)],
'smith':[(14,48,46,74)]}
res={};vis=[]
for k,boxes in B.items():
    a=np.array(Image.open(R+f'sp/{k}.png').convert('RGBA')).astype(float)
    r,g,b,al=a[...,0]/255,a[...,1]/255,a[...,2]/255,a[...,3]
    mx=np.maximum(np.maximum(r,g),b);mn=np.minimum(np.minimum(r,g),b);s=(mx-mn)/np.maximum(mx,1e-6)
    d=mx-mn+1e-6;h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    inb=np.zeros(al.shape,bool)
    for x0,y0,x1,y1 in boxes:inb[y0:y1,x0:x1]=True
    keep=inb&(al>0)&(h>12)&(h<55)&(s>.36)&(mx>.58)
    res[k]=np.argwhere(keep).tolist();print(k,int(keep.sum()))
    o=np.zeros_like(a);o[...,3]=255;o[...,:3]=a[...,:3]*.3;o[keep,:3]=[255,230,120];vis.append(Image.fromarray(o.astype(np.uint8)))
json.dump(res,open(R+'sp/windows.json','w'))
W=sum(i.width+6 for i in vis);H=max(i.height for i in vis);S=Image.new('RGB',(W,H));x=0
for i in vis:S.paste(i,(x,0));x+=i.width+6
S.resize((W*2,H*2),Image.NEAREST).save(R+'lightmask.png')

/* ===== 모험의 유산 — isometric pixel village ===== */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$('#view'), cv=$('#scene'), ctx=cv.getContext('2d'), over=$('#over');
const N=14, TW=32, TH=16;
const S={land:3,night:false,nightT:0,day:1,gold:2400,name:'',visiting:null,started:false,zoom:2};
let LW=200,LH=400,SC=2,cam={x:0,y:0},T=0,last=0;
let WILD=[],objs=[],actors=[],parts=[],grid=null,pathT=new Set(),groundC=null,groundKey='';
const SPR={};['knight','mage','dwarf','rogue','cleric','hero','post'].forEach(k=>SPR[k]=buildChar(k));

/* ---------- sprites (AI pixel art, normalized) ---------- */
const IMG={},LIGHTS={};const LIT=['inn','inn3','tavern','tavern2','smith','cottage','bath'];
function loadSprites(cb){let n=0;const ks=Object.keys(SPR_IMG);ks.forEach(k=>{const im=new Image();im.onload=()=>{IMG[k]=im;if(LIT.includes(k))LIGHTS[k]=findLights(im,k);if(++n===ks.length)cb()};im.src=SPR_IMG[k].u})}
function findLights(im,k){const W=WIN[k]||[];const L=canvas(im.width,im.height),lx=L.getContext('2d');lx.drawImage(im,0,0);const src=lx.getImageData(0,0,im.width,im.height);const o=lx.createImageData(im.width,im.height);const cell={};
  W.forEach(([y,x])=>{const i=(y*im.width+x)*4,r=src.data[i],g=src.data[i+1],b=src.data[i+2];o.data[i]=Math.min(255,r*1.12+30);o.data[i+1]=Math.min(255,g*1.15+22);o.data[i+2]=Math.min(255,b*.9+10);o.data[i+3]=255;const c=(x>>3)+','+(y>>3);(cell[c]=cell[c]||[]).push([x,y])});
  lx.clearRect(0,0,im.width,im.height);lx.putImageData(o,0,0);
  const pts=[];for(const v of Object.values(cell))if(v.length>=5)pts.push([v.reduce((s,q)=>s+q[0],0)/v.length,v.reduce((s,q)=>s+q[1],0)/v.length]);
  return {c:L,pts:pts.slice(0,16)}}
/* roof recolor: rotate the hue of the roof's dominant hue band (top part of sprite) */
const ROOFS=[['원래',null],['청석',215],['단풍',8],['숲',100],['밤하늘',265]];
const RECOL={};
function recolored(key,hue){const k=key+'|'+hue;if(RECOL[k])return RECOL[k];const im=IMG[key];const c=canvas(im.width,im.height),x=c.getContext('2d');x.drawImage(im,0,0);
  const d=x.getImageData(0,0,im.width,im.height);const D=d.data;const top=Math.round(im.height*.55);
  const hs=[];for(let y=0;y<top;y++)for(let i=0;i<im.width;i++){const j=(y*im.width+i)*4;if(!D[j+3])continue;const [h,s,l]=hsl(D[j],D[j+1],D[j+2]);if(s>.35&&l>.2&&l<.75)hs.push(h)}
  hs.sort((a,b)=>a-b);const base=hs[hs.length>>1]||0;
  for(let y=0;y<top+8;y++)for(let i=0;i<im.width;i++){const j=(y*im.width+i)*4;if(!D[j+3])continue;let [h,s,l]=hsl(D[j],D[j+1],D[j+2]);const dh=Math.min(Math.abs(h-base),360-Math.abs(h-base));if(dh<28&&s>.2){const nh=(hue+(h-base)+360)%360;const [r,g,b]=rgb(nh,Math.min(1,s*1.05),hue===265?l*.8:l);D[j]=r;D[j+1]=g;D[j+2]=b}}
  x.putImageData(d,0,0);return RECOL[k]=c}
function hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}return [h,s,l]}
function rgb(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return [(r+m)*255,(g+m)*255,(b+m)*255].map(Math.round)}

/* ---------- catalog ---------- */
const CAT={
  inn:{n:'여관 본관',sp:'inn',up:'inn3',cost:0,unique:true,act:'sleep',desc:'손님이 묵는 곳. 레벨이 오르면 방이 늘어요'},
  cottage:{n:'객실 별채',sp:'cottage',cost:300,act:'sleep',desc:'방 2칸이 늘어나요'},
  tavern:{n:'주점',sp:'tavern',up:'tavern2',cost:400,act:'drink',desc:'모험가들이 모여 떠들어요 · 케미 발생 ↑'},
  smith:{n:'대장간',sp:'smith',cost:600,act:'forge',desc:'장비 강화 · 파밍한 재료로 제작'},
  bath:{n:'온천',sp:'bath',cost:800,act:'bath',desc:'피로 회복 · 기분 ↑'},
  training:{n:'훈련장',sp:'training',cost:350,act:'train',desc:'모험가 레벨업 · 허수아비를 팹니다'},
  garden:{n:'텃밭',sp:'garden',cost:200,act:'farm',desc:'식재료 수확 · 식사 품질 ↑'},
  well:{n:'우물',sp:'well',cost:80,deco:true,desc:'마을 장식 · 주변 기분 +'},
  board:{n:'의뢰 게시판',sp:'board',cost:120,deco:true,desc:'의뢰를 받아 던전에 나가요'},
  tree:{n:'나무',sp:'tree',cost:20,deco:true,desc:'장식'},
  pine:{n:'소나무',sp:'pine',cost:20,deco:true,desc:'장식'},
  fire:{n:'모닥불',sp:null,fw:1,fh:1,cost:60,deco:true,act:'fire',desc:'밤이면 손님들이 둘러앉아요'},
  dungeon:{n:'던전 입구',sp:'dungeon',cost:0,unique:true,fixed:true,act:'dungeon',desc:'파티가 원정을 떠나요'}
};
function fp(o){const sp=o.sp&&SPR_IMG[o.sp];return sp?[sp.fw,sp.fh]:[1,1]}
const BOUND=[null,[4,10],[3,11],[2,12],[1,13],[0,14]];
const inLand=(x,y)=>{const [a,b]=BOUND[S.visiting?S.visiting.land:S.land];return x>=a&&x<b&&y>=a&&y<b};

/* ---------- layout ---------- */
function addObj(kind,tx,ty,o={}){const c=CAT[kind];const ob={kind,tx,ty,sp:c.sp,lvl:1,hue:null,inside:[],...o};const [fw,fh]=fp(ob);ob.fw=fw;ob.fh=fh;objs.push(ob);return ob}
function defaultTown(stage){
  objs=[];
  addObj('inn',6,4);addObj('dungeon',10,1);addObj('well',5,8);
  if(stage>=2){addObj('tree',4,3);addObj('fire',7,9)}
  if(stage>=3){addObj('garden',2,6);addObj('tavern',9,5);addObj('training',2,9);addObj('board',8,10)}
  if(stage>=4){addObj('smith',9,9);addObj('cottage',2,3);addObj('pine',12,12)}
  if(stage>=5){addObj('bath',0,0);addObj('tree',13,7)}
}
function neighborTown(v){objs=[];const L=v.layout;L.forEach(([k,x,y,lv,hue])=>{const o=addObj(k,x,y,{hue:hue==null?null:hue});if(lv>1)upgradeObj(o,true)})}
function occ(){const g=Array.from({length:N},()=>Array(N).fill(null));objs.forEach(o=>{for(let j=0;j<o.fh;j++)for(let i=0;i<o.fw;i++){const x=o.tx+i,y=o.ty+j;if(x>=0&&y>=0&&x<N&&y<N)g[y][x]=o}});return g}
function doorOf(o){return [o.tx+Math.floor(o.fw/2),o.ty+o.fh]}
function walk(x,y){if(x<0||y<0||x>=N||y>=N)return false;if(!inLand(x,y)&&!(S.party&&false))return false;const o=grid[y][x];return !o||o.kind==='training'||o.kind==='garden'}
function astar(sx,sy,gx,gy){
  sx=Math.round(sx);sy=Math.round(sy);const key=(x,y)=>y*N+x;const open=[[sx,sy]],came={},g={[key(sx,sy)]:0};
  const h=(x,y)=>Math.abs(x-gx)+Math.abs(y-gy);let it=0;
  while(open.length&&it++<800){open.sort((a,b)=>(g[key(...a)]+h(...a))-(g[key(...b)]+h(...b)));const [x,y]=open.shift();if(x===gx&&y===gy){const p=[[x,y]];let k=key(x,y);while(came[k]!==undefined){const pk=came[k];p.unshift([pk%N,Math.floor(pk/N)]);k=pk}return p}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(!(nx===gx&&ny===gy)&&!walk(nx,ny))continue;const nk=key(nx,ny),ng=g[key(x,y)]+1+(pathT.has(nk)?-.4:0);if(g[nk]===undefined||ng<g[nk]){g[nk]=ng;came[nk]=key(x,y);open.push([nx,ny])}}}
  return null}
function rebuildPaths(){grid=occ();pathT=new Set();const inn=objs.find(o=>o.kind==='inn');if(!inn)return;const hub=doorOf(inn);
  objs.filter(o=>!CAT[o.kind].deco||o.kind==='board').forEach(o=>{if(o===inn)return;const d=doorOf(o);const p=astar(d[0],d[1],hub[0],hub[1]);if(p)p.forEach(([x,y])=>{if(!grid[y]||!grid[y][x])pathT.add(y*N+x)})});
  pathT.add(hub[1]*N+hub[0]);groundKey=''}

/* ---------- projection & camera ---------- */
const sx=(x,y)=>(x-y)*TW/2, sy=(x,y)=>(x+y)*TH/2;
let OX=0,OY=0; // world origin in canvas logical coords (incl. camera)
function resize(){const r=view.getBoundingClientRect();SC=S.zoom;LW=Math.ceil(r.width/SC);LH=Math.ceil(r.height/SC);cv.width=LW;cv.height=LH;cv.style.width=LW*SC+'px';cv.style.height=LH*SC+'px';ctx.imageSmoothingEnabled=false;clampCam();groundKey=''}
function clampCam(){const lim=N*TW/2;cam.x=Math.max(-lim,Math.min(lim,cam.x));cam.y=Math.max(-N*TH*.6,Math.min(N*TH*.6,cam.y))}
function origin(){OX=Math.round(LW/2-sx(7,7)-cam.x);OY=Math.round(LH*0.5-sy(7,7)-cam.y)}
/* ---------- ground (cached) ---------- */
function drawGround(){
  const W=N*TW+TW*8, H=N*TH+TH*8;const c=canvas(W,H),p=P(c.getContext('2d'));const ox=W/2,oy=TH*4;
  const r=rng(11);
  // wild forest floor beyond the map
  p.rect(0,0,W,H,'#3e6a34');for(let i=0;i<500;i++){p.px(r()*W|0,r()*H|0,'#4a7a3c')}
  for(let y=-3;y<N+3;y++)for(let x=-3;x<N+3;x++){
    const X=ox+sx(x,y),Y=oy+sy(x,y);const land=inLand(x,y),inMap=x>=0&&y>=0&&x<N&&y<N;
    const path=pathT.has(y*N+x)&&land;const v=((x*7+y*13)%5);
    let a,b;if(path){a='#c99a5e';b='#b8864e'}else if(land){a=v<2?'#78b84a':'#6fae45';b='#5f9a3c'}else if(inMap){a='#58894a';b='#4c7a42'}else{a='#476f3c';b='#3e6a34'}
    for(let j=0;j<TH;j++){const hw=(j<TH/2?j+1:TH-j)*2;for(let i=-hw;i<hw;i++){const px=X+i,py=Y+j;p.px(px,py,(BAYER[py&3][(px+64)&3]<3)?b:a)}}
    if(land&&!path&&r()<.35)p.px(X+(r()*16-8|0),Y+4+(r()*8|0),'#9ad860');
    if(land&&!path&&r()<.08)p.px(X+(r()*16-8|0),Y+4+(r()*8|0),['#ffd36b','#ff9fbf','#ffffff'][r()*3|0]);
    if(path&&r()<.3)p.px(X+(r()*12-6|0),Y+5+(r()*6|0),'#e0bb83');
  }
  // wild trees on locked / outside land (cleared when the land grows)
  const [la,lb]=BOUND[S.visiting?S.visiting.land:S.land];const wr=rng(23);WILD=[];
  for(let y=-3;y<N+3;y++)for(let x=-3;x<N+3;x++){const v=wr(),k=wr()<.6?'pine':'tree';if(inLand(x,y))continue;
    const back=x<la-1||y<la-1, frontGap=(x>=lb&&x<lb+2)||(y>=lb&&y<lb+2), sideGap=(x===la-1||y===la-1);
    if(sideGap||(!back&&frontGap&&!(x>=lb+2||y>=lb+2)))continue;const inMap=x>=0&&y>=0&&x<N&&y<N;if(v<(inMap?.3:.36))WILD.push({x,y,k})}
  const drawWild=()=>{};
  // fence along the land border
  const [a,b]=BOUND[S.visiting?S.visiting.land:S.land];const post=(x,y)=>{const X=ox+sx(x,y),Y=oy+sy(x,y);p.rect(X-1,Y-7,2,7,'#7a4a2a');p.px(X-1,Y-8,'#a06a3c')};
  const rail=(x0,y0,x1,y1)=>{const n=24;for(let k=0;k<=n;k++){const t=k/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;const X=ox+sx(x,y)|0,Y=oy+sy(x,y)|0;p.px(X,Y-5,'#a06a3c');p.px(X,Y-3,'#8a5a34')}};
  for(let i=a;i<=b;i++){post(i,a);post(a,i);post(i,b);post(b,i)}
  rail(a,a,b,a);rail(a,a,a,b);rail(a,b,b,b);rail(b,a,b,b);
  drawWild();groundC={c,ox,oy};
}
/* ---------- actors ---------- */
const NAMES={knight:['로이','한스','베른'],mage:['실바나','엘린','미르'],dwarf:['브롬','두린','토르'],rogue:['피핀','릭','네모'],cleric:['세레나','마리엘','루나']};
function cap(){const inn=objs.find(o=>o.kind==='inn');return 2+(inn?inn.lvl*2:0)+objs.filter(o=>o.kind==='cottage').length*2}
function spawnActors(){actors=[];over.querySelectorAll('.bub').forEach(b=>b.remove());const kinds=['knight','dwarf','mage','rogue','cleric'];
  const inn=objs.find(o=>o.kind==='inn');const d=doorOf(inn);
  for(let i=0;i<cap();i++){const k=kinds[i%5];actors.push(mkA(k,NAMES[k][Math.floor(i/5)%3],d[0]+(Math.random()*2-1),d[1]+Math.random()))}
  if(!S.visiting){const b=objs.find(o=>o.kind==='well')||inn;actors.push(mkA('post','모모',b.tx+1.2,b.ty+1.4,'npc'))}}
function mkA(kind,name,x,y,role){return {kind,name,x,y,dir:1,st:'idle',t:Math.random()*2,ph:Math.random()*9,role,path:null,lvl:3+(Math.random()*12|0),hp:60+(Math.random()*40|0),food:40+(Math.random()*60|0),mood:50+(Math.random()*50|0),hidden:false}}
const LINES={idle:['방 좋네~','오늘 던전 갈까?','배고프다…','이 마을 맘에 들어','주인장 최고!'],drink:['캬~!','한 잔 더!','건배!!'],train:['하앗!','받아라!'],farm:['쑥쑥 자라라~'],bath:['아~ 시원하다','피로가 싹…'],forge:['깡! 깡!'],sleep:['드르렁…'],fire:['불멍 최고…','옛날 얘기 해줄까?']};
const CHEM=[['dwarf','rogue','또 너야?','술 한잔 어때?'],['knight','cleric','오늘도 무사히.','제가 지켜드릴게요!'],['mage','rogue','내 지팡이 어디 갔지?','…몰라요?'],['dwarf','knight','방패 좀 빌려줘','갑옷이 더 단단해!'],['cleric','mage','차 한잔 해요','좋지요~']];
const pick=a=>a[Math.random()*a.length|0];
function goTo(a,tx,ty,then){const p=astar(a.x,a.y,tx,ty);if(!p){a.st='idle';a.t=1;return}a.path=p;a.st='walk';a.then=then}
function choose(a){
  if(a.role==='npc'){a.st='idle';a.t=3;return}
  const r=Math.random();const blds=objs.filter(o=>CAT[o.kind].act&&o.kind!=='dungeon');
  let want=null;
  if(S.night){const fire=objs.find(o=>o.kind==='fire');if(fire&&r<.35)want=fire;else want=pick(objs.filter(o=>CAT[o.kind].act==='sleep'))}
  else if(r<.42){const nb=blds.filter(o=>CAT[o.kind].act!=='sleep');want=nb.length&&Math.random()<.8?pick(nb):pick(blds)}
  if(want){const [dx,dy]=want.kind==='fire'?[want.tx+(Math.random()<.5?-1:1)*(Math.random()<.5?1:0),want.ty+1]:CAT[want.kind].act==='train'||CAT[want.kind].act==='farm'?[want.tx+1+(Math.random()*2|0)-1+1,want.ty+1+(Math.random()*2|0)]:doorOf(want);
    goTo(a,Math.max(0,Math.min(N-1,dx)),Math.max(0,Math.min(N-1,dy)),()=>enter(a,want));return}
  // wander
  const [lo,hi]=BOUND[S.visiting?S.visiting.land:S.land];let tx,ty,k=0;do{tx=lo+(Math.random()*(hi-lo)|0);ty=lo+(Math.random()*(hi-lo)|0)}while(!walk(tx,ty)&&k++<20);
  goTo(a,tx,ty,()=>{a.st='idle';a.t=1+Math.random()*2;if(Math.random()<.3)say(a,pick(LINES.idle));chem(a)});
}
function enter(a,o){const act=CAT[o.kind].act;a.at=o;
  if(act==='train'){a.st='atk';a.dir=1;a.t=3+Math.random()*2;say(a,pick(LINES.train),.5);setTimeout(()=>{if(!S.visiting){a.lvl+=Math.random()<.3?1:0}},2000);return}
  if(act==='farm'){a.st='pray';a.t=3;say(a,pick(LINES.farm),.5);return}
  if(act==='fire'){a.st='sit';a.dir=a.x<o.tx+.5?1:-1;a.t=5+Math.random()*4;say(a,pick(LINES.fire),.5);return}
  // go inside
  a.st='in';a.hidden=true;o.inside.push(a);a.t=act==='sleep'?(S.night?14:5):4+Math.random()*4;
  puffAt(o,'#efe2c6',3);
  if(act==='drink'){bldSay(o,pick(LINES.drink));earn(o,6)}
  else if(act==='bath'){bldSay(o,pick(LINES.bath));earn(o,10)}
  else if(act==='forge'){bldSay(o,pick(LINES.forge));earn(o,8)}
  else if(act==='sleep'){earn(o,12)}
}
function leave(a){const o=a.at;if(o){o.inside=o.inside.filter(x=>x!==a);if(a.hidden){const d=doorOf(o);a.x=d[0];a.y=d[1];a.pop=.4}}a.hidden=false;a.at=null;choose(a)}
function chem(a){a.back=false;if(Math.random()>.5)return;const o=actors.find(b=>b!==a&&!b.hidden&&b.st==='idle'&&b.role!=='npc'&&Math.hypot(b.x-a.x,b.y-a.y)<2.5&&CHEM.some(c=>(c[0]===a.kind&&c[1]===b.kind)||(c[1]===a.kind&&c[0]===b.kind)));if(!o)return;
  const c=CHEM.find(c=>(c[0]===a.kind&&c[1]===o.kind)||(c[1]===a.kind&&c[0]===o.kind));const [f,s]=c[0]===a.kind?[a,o]:[o,a];
  f.dir=sx(s.x,s.y)>sx(f.x,f.y)?1:-1;s.dir=-f.dir;f.st=s.st='idle';f.t=s.t=3.6;say(f,c[2],1,'chem');setTimeout(()=>say(s,c[3],1,'chem'),1100);
  setTimeout(()=>floatW((f.x+s.x)/2,(f.y+s.y)/2,34,'♥ 케미 +1','heart'),1900)}
function upd(dt){
  for(const a of actors){a.t-=dt;if(a.pop)a.pop=Math.max(0,a.pop-dt);
    if(a.st==='walk'){const sp=(a.party?2.4:1.7)*dt;const nx=a.path[0];if(!nx){a.st='idle';const f=a.then;a.then=null;f?f():(a.t=1);continue}
      const dx=nx[0]-a.x,dy=nx[1]-a.y,d=Math.hypot(dx,dy);const ds=sx(dx,dy);if(Math.abs(ds)>.01)a.dir=ds>0?1:-1;if(Math.abs(dx)+Math.abs(dy)>.01)a.back=(dx+dy)<0;
      if(d<=sp){a.x=nx[0];a.y=nx[1];a.path.shift()}else{a.x+=dx/d*sp;a.y+=dy/d*sp}}
    else if(a.party){}
    else if(a.st==='in'){if(a.t<=0){if(S.night&&CAT[a.at.kind].act==='sleep'&&Math.random()<.8){a.t=5;continue}leave(a)}}
    else if(a.t<=0){if(a.at&&a.st!=='in'){a.at=null}choose(a)}
  }
}
/* ---------- bubbles / floats ---------- */
function scr(x,y){return [OX+sx(x,y),OY+sy(x,y)+TH/2]}
function say(a,txt,p=1,cls=''){if(Math.random()>p||a.bub||a.hidden)return;const b=document.createElement('div');b.className='bub '+cls;b.textContent=txt;over.appendChild(b);a.bub=b;b._a=a;setTimeout(()=>{b.remove();if(a.bub===b)a.bub=null},2800)}
function bldSay(o,txt){const b=document.createElement('div');b.className='bub';b.textContent=txt;over.appendChild(b);b._o=o;setTimeout(()=>b.remove(),2600)}
function floatW(x,y,up,t,cls=''){const [X,Y]=scr(x,y);const e=document.createElement('div');e.className='flt '+cls;e.textContent=t;e.style.left=X*SC+'px';e.style.top=(Y-up)*SC+'px';over.appendChild(e);setTimeout(()=>e.remove(),1500)}
function earn(o,v){if(S.visiting)return;const [x,y]=[o.tx+o.fw/2,o.ty+o.fh/2];floatW(x,y,40,'+'+v);addGold(v)}
function addGold(v){S.gold+=v;$('#goldv').textContent=S.gold.toLocaleString();const g=$('#gold');g.classList.remove('bump');void g.offsetWidth;g.classList.add('bump')}
function posBubbles(){over.querySelectorAll('.bub').forEach(b=>{let X,Y;if(b._a){if(b._a.hidden){b.remove();return}[X,Y]=scr(b._a.x,b._a.y);Y-=30}else if(b._o){const o=b._o;const sp=SPR_IMG[o.sp];[X,Y]=scr(o.tx+o.fw,o.ty+o.fh);X=OX+sx(o.tx,o.ty)+ (o.fw-o.fh)*8;Y=Y-(sp?sp.h:20)+6}else return;b.style.left=Math.round(X*SC)+'px';b.style.top=Math.round(Y*SC)+'px';b.classList.toggle('rt',X*SC>LW*SC-90)})}

/* ---------- particles ---------- */
function puff(x,y,c,vx,vy,life,size){parts.push({x,y,vx,vy,life,max:life,c,size})}
function puffAt(o,c,n){const X=OX+sx(o.tx,o.ty)+(o.fw-o.fh)*8,Y=OY+sy(o.tx+o.fw,o.ty+o.fh);for(let i=0;i<n;i++)puff(X+(Math.random()-.5)*o.fw*20-OX,Y-4-OY,c,(Math.random()-.5)*16,-8-Math.random()*10,.7,2)}
/* chimney spots (relative to sprite top-left) */
const SMOKE={inn:[[44,8]],inn3:[[47,26],[100,26]],tavern:[[67,10]],tavern2:[[100,8]],smith:[[69,12]],cottage:[],bath:[[30,74]]};

/* ---------- render ---------- */
let NL=0;const TINT=new WeakMap();
function tintCol(nt){return `rgb(${Math.round(255-200*nt)},${Math.round(255-175*nt)},${Math.round(255-90*nt)})`}
function T_(img){if(!NL)return img;let m=TINT.get(img);if(!m){m={};TINT.set(img,m)}if(m[NL])return m[NL];const c=canvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);x.globalCompositeOperation='multiply';x.fillStyle=tintCol(NL/10);x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='destination-in';x.drawImage(img,0,0);return m[NL]=c}
function drawLight(o){if(!NL||o.build||o.ghost)return;const L=LIGHTS[o.sp];if(!L)return;const [bx,by]=objTL(o);ctx.globalAlpha=NL/10;ctx.drawImage(L.c,bx,by);ctx.globalAlpha=1}
function frame(now){
  const dt=Math.min(.05,(now-last)/1000||0);last=now;T+=dt;
  S.nightT+=((S.night?1:0)-S.nightT)*Math.min(1,dt*1.1);const nt=S.nightT;
  origin();
  if(!groundC||groundKey!==S.land+'|'+(S.visiting?S.visiting.name:'')){groundKey=S.land+'|'+(S.visiting?S.visiting.name:'');drawGround()}
  ctx.fillStyle='#2f5530';ctx.fillRect(0,0,LW,LH);
  ctx.drawImage(groundC.c,OX-groundC.ox,OY-groundC.oy);
  NL=Math.round(nt*10);if(NL){ctx.globalCompositeOperation='multiply';ctx.fillStyle=tintCol(NL/10);ctx.fillRect(0,0,LW,LH);ctx.globalCompositeOperation='source-over'}
  // placement ghost tiles
  if(PL&&PL.tx!=null)drawGhostTiles();
  // depth-sorted draw list
  const list=[];
  objs.forEach(o=>list.push({d:o.tx+o.ty+o.fw+o.fh-1.5,o}));
  WILD.forEach(w=>list.push({d:w.x+w.y+.6,w}));
  actors.forEach(a=>{if(!a.hidden)list.push({d:a.x+a.y,a})});
  if(PL&&PL.tx!=null)list.push({d:PL.tx+PL.ty+PL.fw+PL.fh-1.4,ghost:true});
  list.sort((p,q)=>p.d-q.d);
  for(const it of list){if(it.o){drawObj(it.o);drawLight(it.o)}else if(it.a)drawActor(it.a);else if(it.w){const im0=IMG[it.w.k];if(im0){const im=T_(im0);const X=Math.round(OX+sx(it.w.x+.5,it.w.y+.5)-im.width/2),Y=Math.round(OY+sy(it.w.x+.5,it.w.y+.5)+TH/2-im.height+3);if(Y+im.height>-10&&Y<LH+10&&X+im.width>-10&&X<LW+10)ctx.drawImage(im,X,Y)}}else drawObj({...PL,ghost:1,inside:[]})}
  // smoke & fx
  if(Math.random()<dt*3)objs.forEach(o=>{const s=SMOKE[o.sp];if(!s)return;const [bx,by]=objTL(o);s.forEach(([x,y])=>puff(bx+x-OX,by+y-OY,nt>.5?'#8a90b0':'#ece6dc',2+Math.random()*3,-7-Math.random()*4,2.8,1+Math.random()*2|0))});
  objs.filter(o=>o.kind==='fire').forEach(o=>{if(Math.random()<dt*6){const X=OX+sx(o.tx+.5,o.ty+.5),Y=OY+sy(o.tx+.5,o.ty+.5)-4;puff(X-OX+(Math.random()-.5)*4,Y-OY,'#ffb04a',(Math.random()-.5)*4,-14,.6,1)}});
  updParts(dt);
  // night
  if(nt>.01){
    ctx.globalCompositeOperation='lighter';
    objs.filter(o=>o.kind==='fire').forEach(o=>{const X=OX+sx(o.tx+.5,o.ty+.5),Y=OY+sy(o.tx+.5,o.ty+.5);glow(X,Y-4,34,nt*(.45+Math.sin(T*9)*.05))});
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    for(let i=0;i<16;i++){const x=(i*53+Math.sin(T*.6+i)*20+LW*4)%LW|0,y=(i*97+Math.cos(T*.5+i*1.3)*16)%LH|0;if(Math.sin(T*2.5+i)>0)P(ctx).px(x,y,'#fff38a')}}
  else{ // day: drifting cloud shadows
    ctx.globalAlpha=.08;for(let i=0;i<3;i++){const x=((T*6+i*160)%(LW+200))-100,y=60+i*110;ctx.fillStyle='#1c2a40';ctx.beginPath();ctx.ellipse(x,y,60,22,0,0,7);ctx.fill()}ctx.globalAlpha=1}
  // inn name plate
  drawNamePlate(nt);
  posBubbles();
  requestAnimationFrame(frame);
}
function objTL(o){const sp=SPR_IMG[o.sp];if(!sp)return [0,0];const im=o.ghost?IMG[o.sp]:IMG[o.sp];const X=OX+sx(o.tx,o.ty)+(o.fw-o.fh)*TW/4,Yb=OY+sy(o.tx+o.fw,o.ty+o.fh);return [Math.round(X-sp.w/2),Math.round(Yb-sp.h+2)]}
function drawObj(o){
  if(o.kind==='fire'){const X=OX+sx(o.tx+.5,o.ty+.5),Y=OY+sy(o.tx+.5,o.ty+.5)+2;const p=P(ctx);
    p.rect(X-6,Y-2,12,3,'#7a7480');p.rect(X-5,Y-3,10,1,'#9a96a6');p.rect(X-4,Y-4,8,2,'#6a4428');p.rect(X-3,Y-5,6,1,'#8a5a34');
    for(let i=-3;i<=3;i++){const h=3+Math.round((Math.sin(T*11+i*1.9)+1)*2.2+Math.random()*1.5)-Math.abs(i);for(let j=0;j<h;j++)p.px(X+i,Y-6-j,j<2?'#ffe08a':j<4?'#ff9a3c':'#e0482e')}
    p.rect(X-12,Y-1,5,2,'#8a5a34');p.rect(X+8,Y+1,5,2,'#8a5a34');return}
  const key=o.sp;if(!IMG[key])return;let im=o.hue!=null?recolored(key,o.hue):IMG[key];if(!o.ghost)im=T_(im);const [x,y]=objTL(o);
  if(o.pop){const k=o.pop;ctx.save();ctx.translate(x+im.width/2,y+im.height);ctx.scale(1+k*.12,1-k*.18);ctx.drawImage(im,-im.width/2,-im.height);ctx.restore();o.pop=Math.max(0,o.pop-.04)}
  else if(o.ghost){ctx.globalAlpha=.6;ctx.drawImage(im,x,y);ctx.globalAlpha=1}
  else if(o.build){ // under construction: scaffold
    ctx.globalAlpha=.35;ctx.drawImage(im,x,y);ctx.globalAlpha=1;const p=P(ctx);for(let i=0;i<4;i++){const px=x+8+i*(im.width-16)/3|0;p.rect(px,y+im.height*.3|0,2,im.height*.7|0,'#a06a3c')}for(let j=0;j<3;j++)p.rect(x+6,y+im.height*.4+j*im.height*.2|0,im.width-12,2,'#c08050');
    if(Math.random()<.15)puff(x+Math.random()*im.width-OX,y+im.height*.8-OY,'#efe2c6',(Math.random()-.5)*20,-10,.7,2)}
  else ctx.drawImage(im,x,y);
  if(o.inside&&o.inside.length&&!o.ghost){const X=x+im.width/2,Y=y-6+Math.round(Math.sin(T*3)*1.5);const p=P(ctx);p.rect(X-7,Y-5,14,8,'#fff3d6');p.rect(X-6,Y-6,12,1,'#fff3d6');p.px(X,Y+3,'#fff3d6');ctx.fillStyle='#1c1018';ctx.font='8px "Galmuri9"';ctx.textAlign='center';ctx.fillText(o.inside.length+'',X,Y+2)}
}
function drawActor(a){const s=SPR[a.kind];let fr;
  if(a.st==='walk')fr=(a.back?s.walkB:s.walk)[Math.floor(T*8+a.ph)%4];else if(a.st==='idle'&&a.back&&!a.role)fr=s.idleB[Math.floor(T*1.6+a.ph)%2];else if(a.st==='atk')fr=s.atk[Math.floor(T*3+a.ph)%2];else if(a.st==='pray')fr=s.pray[Math.floor(T*1.5+a.ph)%2];else if(a.st==='sit')fr=s.sit[Math.floor(T*2+a.ph)%2];else fr=s.idle[Math.floor(T*1.6+a.ph)%2];
  const X=Math.round(OX+sx(a.x,a.y)),Y=Math.round(OY+sy(a.x,a.y)+TH/2);
  ctx.globalAlpha=.25;ctx.fillStyle='#1c1018';ctx.fillRect(X-5,Y-1,10,2);ctx.globalAlpha=a.pop?1-a.pop/.4:1;
  fr=T_(fr);const x=X-12,y=Y-32+(a.st==='sit'?3:0);if(a.dir<0){ctx.save();ctx.translate(x+24,y);ctx.scale(-1,1);ctx.drawImage(fr,0,0);ctx.restore()}else ctx.drawImage(fr,x,y);ctx.globalAlpha=1;
  if(a.st==='atk'&&Math.random()<.06)puff(X+a.dir*12-OX,Y-16-OY,'#ffffff',a.dir*10,-4,.25,1);
  if(a.st==='pray'&&Math.random()<.05)puff(X+a.dir*8-OX,Y-12-OY,'#8fd0ff',0,10,.5,1);
  if(a.role==='npc'){const b=Math.round(Math.sin(T*5)*1.5);P(ctx).rect(X-1,Y-38+b,2,5,'#ffd36b');P(ctx).rect(X-1,Y-31+b,2,2,'#ffd36b')}}
function glow(x,y,r,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,190,90,${a})`);g.addColorStop(1,'rgba(255,150,60,0)');ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
const HALO={};function halo(r){if(HALO[r])return HALO[r];const c=canvas(r*2+1,r*2+1),p=P(c.getContext('2d'));for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const d=Math.sqrt(x*x+y*y)/r;if(d>1)continue;if((1-d)*.9>(BAYER[(y+64)&3][(x+64)&3]+.5)/16)p.px(x+r,y+r,'#ffd27a')}return HALO[r]=c}
function updParts(dt){const p=P(ctx);parts=parts.filter(q=>{q.life-=dt;if(q.life<=0)return false;q.x+=q.vx*dt;q.y+=q.vy*dt;const s=q.size*(1+(1-q.life/q.max)*.8);ctx.globalAlpha=Math.min(1,q.life/q.max*1.5);p.rect(OX+q.x-s/2|0,OY+q.y-s/2|0,Math.max(1,s|0),Math.max(1,s|0),q.c);ctx.globalAlpha=1;return true})}
function drawNamePlate(nt){const inn=objs.find(o=>o.kind==='inn');if(!inn)return;const name=(S.visiting?S.visiting.name:S.name)||'';if(!name)return;const sp=SPR_IMG[inn.sp];const [x,y]=objTL(inn);
  ctx.font='10px "Galmuri9"';const w=Math.ceil(ctx.measureText(name).width)+10;const X=Math.round(x+sp.w/2-w/2),Y=y-16;const p=P(ctx);
  p.rect(X,Y,w,13,'#5a3a24');p.rect(X+1,Y+1,w-2,11,'#a06a3c');p.hline(X+1,Y+1,w-2,'#c08050');ctx.fillStyle='#5a3420';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(name,X+5,Y+3);ctx.fillStyle=nt>.5?'#ffe7a8':'#fff3d6';ctx.fillText(name,X+5,Y+2)}

/* ---------- input: pan, tap, place ---------- */
let drag=null,moved=false;
cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y};moved=false;cv.setPointerCapture?.(e.pointerId)});
cv.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;if(moved){cam.x=drag.cx-dx/SC;cam.y=drag.cy-dy/SC;clampCam()}});
cv.addEventListener('pointerup',e=>{const was=drag;drag=null;if(moved||!was)return;tap(e)});
function toTile(e){const r=cv.getBoundingClientRect();const X=(e.clientX-r.left)/SC-OX,Y=(e.clientY-r.top)/SC-OY;const a=X/(TW/2),b=Y/(TH/2);return [(a+b)/2,(b-a)/2]}
function tap(e){if(!S.started||DQ)return;const [fx,fy]=toTile(e);
  if(PL){PL.tx=Math.floor(fx-PL.fw/2+.5);PL.ty=Math.floor(fy-PL.fh/2+.5);PL.ok=canPlace(PL);$('#placeOk').disabled=!PL.ok;$('#placeTxt').textContent=PL.ok?CAT[PL.kind].n+' · 여기 괜찮아요':'여기엔 못 지어요';return}
  // actors first (screen distance)
  const r=cv.getBoundingClientRect();const mx=(e.clientX-r.left)/SC,my=(e.clientY-r.top)/SC;let best=null,bd=1e9;
  actors.forEach(a=>{if(a.hidden)return;const [X,Y]=scr(a.x,a.y);const d=Math.hypot(X-mx,Y-14-my);if(d<12&&d<bd){bd=d;best=a}});
  if(best){best.role==='npc'?openReport():showActor(best);return}
  // buildings: pixel hit test, front-most first
  const hits=objs.filter(o=>o.sp&&IMG[o.sp]).sort((p,q)=>(q.tx+q.ty+q.fw+q.fh)-(p.tx+p.ty+p.fw+p.fh));
  for(const o of hits){const [x,y]=objTL(o);const im=IMG[o.sp];if(mx>=x&&my>=y&&mx<x+im.width&&my<y+im.height){const c=hitC(o.sp);const a=c.getImageData(mx-x|0,my-y|0,1,1).data[3];if(a){showObj(o);return}}}
}
const HITC={};function hitC(k){if(HITC[k])return HITC[k];const c=canvas(IMG[k].width,IMG[k].height).getContext('2d',{willReadFrequently:true});c.drawImage(IMG[k],0,0);return HITC[k]=c}
/* placement */
let PL=null;
function canPlace(o,ignore){if(o.tx==null)return false;for(let j=0;j<o.fh;j++)for(let i=0;i<o.fw;i++){const x=o.tx+i,y=o.ty+j;if(!inLand(x,y))return false;const g=grid[y]&&grid[y][x];if(g&&g!==ignore)return false}
  const d=[o.tx+Math.floor(o.fw/2),o.ty+o.fh];if(CAT[o.kind]&&!CAT[o.kind].deco&&(!inLand(d[0],d[1])||(grid[d[1]]&&grid[d[1]][d[0]])))return false;return true}
function drawGhostTiles(){const p=P(ctx);for(let j=0;j<PL.fh;j++)for(let i=0;i<PL.fw;i++){const x=PL.tx+i,y=PL.ty+j;const X=OX+sx(x,y),Y=OY+sy(x,y);const c=PL.ok?'#7fe07f':'#ff6a6a';
  for(let k=0;k<TH;k++){const hw=(k<TH/2?k+1:TH-k)*2;for(let q=-hw;q<hw;q++)if(((k+q)&3)===0)p.px(X+q,Y+k,c)}}}
function startPlace(kind){closeWin();const c=CAT[kind];const sp=c.sp&&SPR_IMG[c.sp];PL={kind,sp:c.sp,fw:sp?sp.fw:1,fh:sp?sp.fh:1,tx:null,ty:null,ok:false};
  // suggest first valid spot near center
  const [a,b]=BOUND[S.land];outer:for(let r=0;r<N;r++)for(let y=a;y<b;y++)for(let x=a;x<b;x++){if(Math.abs(x-7)+Math.abs(y-7)!==r)continue;PL.tx=x;PL.ty=y;if(canPlace(PL))break outer;PL.tx=null}
  PL.ok=PL.tx!=null&&canPlace(PL);$('#placebar').hidden=false;$('#placeOk').disabled=!PL.ok;$('#placeTxt').textContent=PL.ok?c.n+' · 여기 괜찮아요':'지을 곳을 눌러요';
  if(PL.tx!=null){cam.x=sx(PL.tx+PL.fw/2,PL.ty+PL.fh/2);cam.y=sy(PL.tx,PL.ty)-LH*.15}}
$('#placeNo').onclick=()=>{PL=null;$('#placebar').hidden=true};
$('#placeOk').onclick=()=>{if(!PL||!PL.ok)return;const c=CAT[PL.kind];if(S.gold<c.cost){toastTxt('금화가 모자라요');return}addGold(-c.cost);
  const o=addObj(PL.kind,PL.tx,PL.ty,{build:true});PL=null;$('#placebar').hidden=true;rebuildPaths();
  floatW(o.tx+o.fw/2,o.ty+o.fh/2,40,'뚝딱뚝딱!','big');setTimeout(()=>{o.build=false;o.pop=1;puffAt(o,'#fff3b0',14);floatW(o.tx+o.fw/2,o.ty+o.fh/2,50,c.n+' 완성!','big');if(c.act==='sleep'){for(let i=0;i<2;i++){const k=pick(['knight','mage','dwarf','rogue','cleric']);const d=doorOf(o);actors.push(mkA(k,pick(NAMES[k]),d[0],d[1]))}}},2200)};
function upgradeObj(o,silent){const c=CAT[o.kind];if(!c.up)return false;const up=SPR_IMG[c.up];const nt={...o,tx:o.tx-(up.fw-o.fw),ty:o.ty-(up.fh-o.fh),fw:up.fw,fh:up.fh};if(!silent&&!canPlace(nt,o)){toastTxt('뒤쪽에 자리가 없어요 · 1칸 비워주세요');return false}
  Object.assign(o,{tx:nt.tx,ty:nt.ty,fw:up.fw,fh:up.fh,sp:c.up,lvl:o.lvl+1});if(!silent){rebuildPaths();o.pop=1;puffAt(o,'#fff3b0',20);floatW(o.tx+o.fw/2,o.ty+o.fh/2,70,c.n+' Lv.'+o.lvl+'!','big')}return true}

/* ---------- windows ---------- */
function openWin(title,html,cls=''){$('#winT').textContent=title;$('#winB').innerHTML=html;$('#win').className='win px on '+cls;$('#scrim').classList.add('on')}
function closeWin(){$('#win').classList.remove('on');$('#scrim').classList.remove('on')}
$('#scrim').onclick=closeWin;$('#winX').onclick=closeWin;
let tT;function toastTxt(t){const e=$('#toast');e.innerHTML=`<span>${t}</span>`;e.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>e.classList.remove('on'),2200)}
function sprThumb(k){return k?SPR_IMG[k].u:fireThumb()}
let FT;function fireThumb(){if(FT)return FT;const c=canvas(24,20),p=P(c.getContext('2d'));p.rect(6,14,12,3,'#7a7480');p.rect(7,12,10,2,'#6a4428');for(let i=-3;i<=3;i++)for(let j=0;j<6-Math.abs(i);j++)p.px(12+i,11-j,j<2?'#ffe08a':j<4?'#ff9a3c':'#e0482e');return FT=c.toDataURL()}
$('#bBuild').onclick=()=>{if(S.visiting)return;
  openWin('건설',`<p class="sub">원하는 자리에 지어요 · 금화 <b class="g">${S.gold.toLocaleString()}</b></p><div class="cat">`+Object.entries(CAT).filter(([k,c])=>!c.fixed&&!(c.unique&&objs.some(o=>o.kind===k))).map(([k,c])=>`<button data-k="${k}" ${S.gold<c.cost?'disabled':''}><img src="${sprThumb(c.sp)}" alt=""><b>${c.n}</b><small>${c.cost} G</small></button>`).join('')+`</div>`);
  $$('.cat button').forEach(b=>b.onclick=()=>startPlace(b.dataset.k))};
$('#bLand').onclick=()=>{if(S.visiting)return;const sizes=['6×6','8×8','10×10','12×12','14×14'],costs=[0,300,800,1600,3000];
  openWin('땅 넓히기',`<p class="sub">울타리를 밀어서 마을 땅을 넓혀요 · 최대 5단계</p><div class="steps">`+sizes.map((s,i)=>`<button class="stp ${i+1===S.land?'cur':''}" data-l="${i+1}"><span style="grid-column:1/3"><b>${i+1}단계 · ${s}칸</b><small>${['여관 하나로 시작','텃밭·나무 자리','주점·훈련장 자리','대장간·별채 자리','온천·최대 크기'][i]}</small></span><em>${i+1===S.land?'현재':i+1<S.land?'완료':costs[i]+'G'}</em></button>`).join('')+`</div><p class="note">시안이라 아무 단계나 눌러 볼 수 있어요</p>`);
  $$('.stp').forEach(b=>b.onclick=()=>expand(+b.dataset.l))};
function expand(l){closeWin();if(l===S.land)return;const old=S.land;S.land=l;rebuildPaths();groundKey='';
  const [a,b]=BOUND[l];for(let i=0;i<40;i++){const t=Math.random(),side=Math.random()*4|0;const [x,y]=side===0?[a+t*(b-a),a]:side===1?[a,a+t*(b-a)]:side===2?[a+t*(b-a),b]:[b,a+t*(b-a)];puff(sx(x,y),sy(x,y),'#efe2c6',(Math.random()-.5)*30,-10-Math.random()*15,1,3)}
  floatW(7,7,40,l>old?'땅이 넓어졌어요!':'시안: 땅 줄이기','big');if(l<old)defaultTown(l),rebuildPaths(),spawnActors()}
function bar(l,v,c){return `<div class="bar"><span>${l}</span><i><b style="width:${v}%;background:${c}"></b></i><em>${v}</em></div>`}
const ACTN={walk:'걷는 중',idle:'쉬는 중',atk:'수련 중',pray:'밭일 중',sit:'불멍 중',in:'건물 안'};
function showActor(a){const pals=CHEM.filter(x=>x[0]===a.kind||x[1]===a.kind).map(x=>x[0]===a.kind?x[1]:x[0]);
  openWin(a.name,`<div class="who"><img class="port" src="${PORT[a.kind]||''}" alt=""><div><p class="sub">Lv.${a.lvl} ${CLASSES[a.kind].name} · ${ACTN[a.st]||''}</p>${bar('체력',a.hp,'#e0544a')}${bar('포만',a.food,'#e8a23a')}${bar('기분',a.mood,'#6fb04b')}</div></div><div class="chips">${pals.map(p=>`<span class="chip"><img src="${PORT[p]}" alt="">${CLASSES[p].name}와 케미</span>`).join('')}<span class="chip q">??? 미발견</span></div>`)}
function showObj(o){const c=CAT[o.kind];const up=c.up&&o.sp!==c.up;
  const inside=o.inside.map(a=>`<div><img src="${PORT[a.kind]}" alt="">${a.name} · ${({sleep:'자는 중',drink:'한잔 중',bath:'온천욕 중',forge:'장비 손질 중'})[c.act]||'머무는 중'}</div>`).join('')||'<div>지금은 비어 있어요</div>';
  const roofable=['inn','inn3','tavern','tavern2','cottage','smith'].includes(o.sp);
  openWin(c.n+(o.lvl>1?' Lv.'+o.lvl:''),`<p class="sub">${c.desc}</p>${c.act&&!['train','farm','fire'].includes(c.act)?`<b class="g">안에 있는 손님</b><div class="inside">${inside}</div>`:''}${roofable&&!S.visiting?`<p class="sub" style="margin-top:10px">지붕 색</p><div class="roofs">${ROOFS.map(([n,h],i)=>`<button data-h="${h}" title="${n}" class="${o.hue===h?'on':''}" style="background:${h==null?'#8a8a96':`hsl(${h} 55% 45%)`}"></button>`).join('')}</div>`:''}${up&&!S.visiting?`<button class="bigbtn" id="upB">레벨업 · 더 큰 건물로 (${o.kind==='inn'?600:500} G)</button>`:''}`);
  $$('.roofs button').forEach(b=>b.onclick=()=>{o.hue=b.dataset.h==='null'?null:+b.dataset.h;$$('.roofs button').forEach(x=>x.classList.toggle('on',x===b));o.pop=.6;puffAt(o,'#fff3b0',8)});
  const ub=$('#upB');if(ub)ub.onclick=()=>{const cost=o.kind==='inn'?600:500;if(S.gold<cost){toastTxt('금화가 모자라요');return}if(upgradeObj(o)){addGold(-cost);closeWin();if(o.kind==='inn'){const d=doorOf(o);for(let i=0;i<2;i++){const k=pick(['knight','mage','dwarf','rogue','cleric']);actors.push(mkA(k,pick(NAMES[k]),d[0],d[1]))}}}}}
$('#bGuest').onclick=()=>{const g=actors.filter(a=>!a.role);if(g.length)showActor(pick(g))};
$('#bBook').onclick=()=>openWin('장부','<p class=sub>오늘의 수입</p>'+bar('숙박',72,'#e8a23a')+bar('주점',48,'#e8a23a')+bar('던전',63,'#9a7aff')+'<p class=note>숫자는 시안용이에요</p>');
$('#bZoom').onclick=()=>{S.zoom=S.zoom===2?3:S.zoom===3?1:2;$('#bZoom').textContent=S.zoom===1?'＋':S.zoom===3?'－':'＋';resize()};
/* neighbors */
const NB=[
  {name:'곰발바닥 여관',owner:'피핀아빠',land:3,like:128,layout:[['inn',6,4,1,8],['dungeon',10,1],['tavern',9,5,1,8],['garden',2,6],['tree',4,3],['tree',3,10],['fire',7,9],['well',5,8]]},
  {name:'달빛 쉼터',owner:'엘린느',land:5,like:902,layout:[['inn',6,4,2,265],['dungeon',10,1],['bath',0,0],['tavern',9,5,1,100],['garden',2,6],['training',2,9],['smith',9,9],['cottage',2,3,1,265],['fire',7,9],['well',5,8],['tree',12,12],['tree',0,12],['tree',13,7],['pine',1,12]]},
  {name:'망치와 맥주',owner:'두린7',land:4,like:341,layout:[['inn',6,4,1,null],['dungeon',10,1],['smith',2,6],['smith',9,9],['tavern',9,5,1,8],['training',2,9],['fire',7,9],['pine',1,1],['board',8,10],['pine',12,12]]}];
$('#bVillage').onclick=()=>{if(S.visiting){goHome();return}
  openWin('마을 · 이웃 여관',`<p class="sub">다른 여관주인의 마을을 구경하고 좋아요를 남겨요</p><div class="steps">`+NB.map((v,i)=>`<button class="stp" data-v="${i}"><span style="grid-column:1/3"><b>${v.name}</b><small>주인 ${v.owner} · 땅 ${v.land}단계</small></span><em>♥ ${v.like}</em></button>`).join('')+`</div>`);
  $$('.stp').forEach(b=>b.onclick=()=>visit(NB[+b.dataset.v]))};
let HOME=null;
function visit(v){closeWin();fade(()=>{if(!S.visiting)HOME={objs,actors};S.visiting=v;neighborTown(v);rebuildPaths();spawnActors();cam={x:0,y:0};$('#visitbar').hidden=false;$('#vName').textContent=`${v.name} · ${v.owner}`;$('#vLike').textContent=`♥ ${v.like}`;$('#bVillage .lbl').textContent='돌아가기'})}
function goHome(){fade(()=>{S.visiting=null;objs=HOME.objs;actors=HOME.actors;rebuildPaths();$('#visitbar').hidden=true;$('#bVillage .lbl').textContent='마을'})}
$('#vLike').onclick=()=>{const v=S.visiting;if(!v||v.liked)return;v.liked=1;v.like++;$('#vLike').textContent=`♥ ${v.like}`;floatW(7,6,60,'♥ 좋아요!','heart')};
$('#vHome').onclick=goHome;
function fade(fn){const f=$('#fade');f.classList.add('on');setTimeout(()=>{fn();f.classList.remove('on')},350)}

/* ---------- dungeon party: the farming loop ---------- */
const LOOT=[['r','바람의 단검','sword'],['e','심연의 반지','ring'],['r','은빛 흉갑','armor'],['n','낡은 지도 조각','map'],['l','별조각 투구','helm']];
function itemIcon(kind,rar){const c=canvas(16,16),p=P(c.getContext('2d'));const col={n:'#9a8a70',r:'#4f8fe0',e:'#a35bd6',l:'#f2a13a'}[rar];
  p.rect(0,0,16,16,'#1c1018');p.rect(1,1,14,14,dk(col,.45));p.rect(1,1,14,1,col);p.rect(1,14,14,1,col);p.rect(1,1,1,14,col);p.rect(14,1,1,14,col);
  if(kind==='sword'){for(let i=0;i<7;i++)p.px(4+i,11-i,'#e9eef7');p.rect(3,10,3,3,'#e8b94a')}if(kind==='ring'){p.ell(8,9,3.5,3.5,'#e8b94a');p.ell(8,9,2,2,dk(col,.45));p.rect(7,3,3,3,'#c98ae0')}
  if(kind==='armor'){p.rect(4,4,8,8,'#c9d1dc');p.rect(6,4,4,2,dk(col,.45))}if(kind==='map'){p.rect(3,4,10,8,'#e9dcc0');p.px(6,7,'#b0412f');p.px(9,9,'#b0412f')}if(kind==='helm'){p.ell(8,8,4,4,'#c9d1dc');p.rect(4,8,8,3,'#c9d1dc');p.rect(6,9,4,1,'#1c1018');p.px(8,3,'#6fd0ff')}return c.toDataURL()}
function party(){if(S.visiting||!S.started||PL)return;const dg=objs.find(o=>o.kind==='dungeon');if(!dg)return;
  const pool=actors.filter(a=>!a.role&&!a.hidden&&!a.party&&a.st!=='in');if(pool.length<2)return;const team=pool.sort(()=>Math.random()-.5).slice(0,Math.min(3,pool.length));
  const d=doorOf(dg);let n=0;say(team[0],'던전 가자!',1,'chem');
  team.forEach(a=>{a.party=true;a.at=null;const p=astar(a.x,a.y,d[0],d[1]);if(!p){a.party=false;return}a.path=p;a.st='walk';a.then=()=>{a.hidden=true;a.st='in';puffAt(dg,'#b07aff',6);if(++n===team.length)setTimeout(back,6000)}});
  function back(){const l=pick(LOOT);const t=$('#toast');t.innerHTML=`<img src="${itemIcon(l[2],l[0])}" alt=""><span>던전 귀환 · <b class="r-${l[0]}">${l[1]}</b> 획득</span>`;t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),2800);
    const g=40+(Math.random()*80|0);floatW(d[0],d[1],30,'+'+g);addGold(g);puffAt(dg,'#ffd36b',16);team.forEach(a=>{a.party=false;a.hidden=false;a.x=d[0];a.y=d[1];a.pop=.4;a.st='idle';a.t=.5})}}
setInterval(party,15000);

/* ---------- notices / chat / report / dialogue / title (carried over) ---------- */
const NOTICES=[
  {tag:'공지',t:'모험의 유산 마을 시안 v0.2',d:'2026. 10. 10.',b:'단면 탑 대신 쿼터뷰 마을로 바뀌었어요.\n· 건물을 원하는 자리에 짓기\n· 땅 넓히기 1~5단계\n· 건물 레벨업 · 지붕 색 바꾸기\n· 이웃 마을 구경'},
  {tag:'업데이트',t:'건물을 누르면 안에 누가 있는지 보여요',d:'2026. 10. 10.',b:'여관, 주점, 온천, 대장간 안에서 쉬고 있는 손님을 확인할 수 있어요. 지붕 위 숫자는 안에 있는 손님 수예요.'},
  {tag:'이벤트',t:'주말 던전 보상 2배 (예시)',d:'2026. 10. 11.',b:'시안용 예시 공지'},
  {tag:'제보',t:'버그 · 건의는 우체부 모모에게',d:'상시',b:'마을의 모모(머리 위 !)를 누르면 편지를 쓸 수 있어요.'}];
$('#bNotice').onclick=()=>{$('#bNotice .dot').hidden=true;
  openWin('새 소식',`<div class="tabs">${['전체','공지','업데이트','이벤트','제보'].map((t,i)=>`<button class="tab ${i?'':'on'}" data-t="${t}">${t}</button>`).join('')}</div><div class="nlist">${NOTICES.map((n,i)=>`<button class="nrow" data-i="${i}"><span class="tg"></span>[${n.tag}] ${n.t}</button>`).join('')}</div><div class="nbody" id="nbody"></div>`,'wide');
  const show=i=>{const n=NOTICES[i];$('#nbody').innerHTML=`<b>${n.t}</b><small>${n.tag} · ${n.d}</small><p>${n.b.replace(/\n/g,'<br>')}</p>`;$$('.nrow').forEach(r=>r.classList.toggle('on',+r.dataset.i===i))};show(0);
  $$('.nrow').forEach(r=>r.onclick=()=>show(+r.dataset.i));$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.toggle('on',x===t));$$('.nrow').forEach(r=>r.hidden=t.dataset.t!=='전체'&&NOTICES[+r.dataset.i].tag!==t.dataset.t)})};
const CHAT=[['세계','피핀아빠','온천 지었더니 기분 수치 미쳤음'],['세계','엘린느','달빛 쉼터 구경 오세요~ 지붕 보라색임'],['거래','두린7','심연의 반지 삽니다 귓주세요'],['세계','모험왕','드워프랑 도적 케미 대사 뭐임 ㅋㅋㅋ'],['길드','별빛','오늘 밤 던전 같이 가실 분']];
let ci=0;function chatTick(){const c=CHAT[ci++%CHAT.length];const el=$('#chatlog');const d=document.createElement('div');d.innerHTML=`<span class="ch ch-${c[0]}">[${c[0]}]</span> <b>${c[1]}</b>: ${c[2]}`;el.appendChild(d);while(el.children.length>2)el.firstChild.remove()}
setInterval(chatTick,5500);chatTick();chatTick();
$('#chatlog').onclick=()=>{openWin('채팅',`<div class="chatfull">${CHAT.map(c=>`<div><span class="ch ch-${c[0]}">[${c[0]}]</span> <b>${c[1]}</b>: ${c[2]}</div>`).join('')}</div><form class="chatin" id="chatf"><input id="chatv" maxlength="60" placeholder="메시지 입력 (시안)" autocomplete="off"><button>전송</button></form>`);
  $('#chatf').onsubmit=e=>{e.preventDefault();const v=$('#chatv').value.trim();if(!v)return;const d=document.createElement('div');d.innerHTML=`<span class="ch ch-세계">[세계]</span> <b>${S.name||'나'}</b>: ${v.replace(/</g,'&lt;')}`;$('.chatfull').appendChild(d);$('#chatv').value=''}};
$('#bDN').onclick=()=>setNight(!S.night);
function setNight(v){S.night=v;if(!v)S.day++;$('#dayv').textContent=`${S.day}일차 · ${v?'밤':'낮'}`;$('#bDN').textContent=v?'☀':'☾'}
setInterval(()=>{if(S.started&&!$('#win').classList.contains('on')&&!PL)setNight(!S.night)},45000);
function openReport(){talk([['post','안녕하세요! 우체부 모모예요.'],['post','버그나 아쉬운 점이 있으면 편지로 남겨 주세요. 개발자님께 꼭 전해 드릴게요!']],()=>{
  openWin('모모에게 편지 쓰기',`<form class="report" id="rep"><label>종류<select id="rk"><option>버그 제보</option><option>개선 건의</option><option>칭찬</option></select></label><label>내용<textarea id="rt" rows="4" maxlength="300" placeholder="예) 온천 옆에서 손님이 길을 잃었어요"></textarea></label><button>편지 보내기</button></form>`);
  $('#rep').onsubmit=e=>{e.preventDefault();closeWin();talk([['post','편지 잘 받았어요! 답장은 공지에서 확인해 주세요~']])}})}
let DQ=null;
function talk(lines,done){DQ={lines,i:0,done};$('#dlg').hidden=false;view.classList.add('talking');showLine()}
function showLine(){const [who,txt,opt]=DQ.lines[DQ.i];const d=$('#dlg');
  const nm=who==='narr'?'':who==='hero'?(S.name?S.name+' 주인':'나'):who==='keeper'?'노주인 버나드':who==='post'?'우체부 모모':CLASSES[who].name;
  d.classList.toggle('narr',who==='narr');$('#dPort').src=PORT[who]||'';$('#dPort').hidden=who==='narr';$('#dName').textContent=nm;$('#dName').hidden=who==='narr';
  const t=txt.replace('{name}',S.name);let k=0;const el=$('#dText');el.textContent='';clearInterval(DQ.iv);DQ.typing=true;
  DQ.iv=setInterval(()=>{el.textContent=t.slice(0,++k);if(k>=t.length){clearInterval(DQ.iv);DQ.typing=false;if(opt==='name')askName()}},32);DQ.full=t}
function endTalk(){const d=DQ.done;DQ=null;$('#dlg').hidden=true;view.classList.remove('talking');d&&d()}
function nextLine(){if(!DQ)return;if(DQ.typing){clearInterval(DQ.iv);$('#dText').textContent=DQ.full;DQ.typing=false;if(DQ.lines[DQ.i][2]==='name')askName();return}
  if(DQ.wait)return;DQ.i++;if(DQ.i>=DQ.lines.length){endTalk();return}showLine()}
function skipTalk(){if(!DQ||DQ.wait)return;clearInterval(DQ.iv);const nl=DQ.lines.findIndex(l=>l[2]==='name');if(nl>DQ.i&&!S.name){DQ.i=nl;showLine();return}endTalk()}
$('#dlg').onclick=e=>{if(e.target.closest('#dSkip'))return;nextLine()};$('#dSkip').onclick=e=>{e.stopPropagation();skipTalk()};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;if('zZ '.includes(e.key)||e.key==='Enter'){if(DQ){e.preventDefault();nextLine()}else if(!S.started&&!$('#title').hidden)startIntro()}if((e.key==='x'||e.key==='X')&&DQ)skipTalk()});
function askName(){DQ.wait=true;const nb=$('#namebox');nb.hidden=false;const inp=$('#nameIn');inp.value='';inp.focus();
  $('#nameOk').onclick=e=>{e.stopPropagation();let v=inp.value.trim()||'별빛';v=v.replace(/\s*여관$/,'');S.name=v+' 여관';nb.hidden=true;DQ.wait=false;$('#innv').textContent=S.name;nextLine()}}
function startIntro(){$('#title').classList.add('out');setTimeout(()=>{$('#title').hidden=true},600);
  S.land=1;defaultTown(1);rebuildPaths();spawnActors();cam={x:0,y:0};setNight(true);S.nightT=1;$('#hud').hidden=true;
  talk([['narr','골드는 늘 모자랐다.'],['narr','목숨 걸고 던전에서 번 돈은, 여관 숙박비로 고스란히 사라지곤 했다.'],
    ['keeper','자네, 셈이 꽤 빠르더군. 내 장부 정리를 그렇게 빨리 하는 사람은 처음 봤네.'],['hero','하하, 맨날 돈이 모자라서 계산만 늘었죠.'],
    ['keeper','나도 이제 허리가 예전 같지 않아. 이 여관… 자네가 맡아 주지 않겠나?'],['hero','제가요? 칼밖에 쥐어 본 적이 없는데요?'],
    ['keeper','칼 쥐는 손이나 장부 쥐는 손이나 매한가지일세. 손님 마음을 읽는 눈이 더 중요하지.'],
    ['keeper','자, 간판부터 새로 달아야겠지. 여관 이름을 지어 주게.','name'],['keeper','{name}이라… 좋은 이름이군. 손님들이 몰려올 걸세.'],
    ['keeper','지금은 여관 하나뿐이지만, 울타리를 밀고 땅을 넓혀 가게. 주점도, 온천도, 대장간도 자네 마음대로 지으면 되네.'],
    ['keeper','모르는 게 있으면 마을로 찾아오게. 난 이제 낚시나 하러 가겠네. 허허!'],['narr','그렇게, 전직 모험가의 여관 마을이 시작되었다.']],
    ()=>{S.started=true;$('#hud').hidden=false;setNight(false);actors.forEach(a=>{if(a.st==='in')leave(a)});S.day=1;$('#dayv').textContent='1일차 · 낮';setTimeout(()=>{$('#bNotice .dot').hidden=false},1500)})}
$('#tStart').onclick=startIntro;
$('#tCont').onclick=()=>{$('#title').classList.add('out');setTimeout(()=>{$('#title').hidden=true},600);S.name=S.name||'별빛 여관';$('#innv').textContent=S.name;S.land=3;defaultTown(3);rebuildPaths();spawnActors();setNight(false);cam={x:0,y:0};S.started=true;$('#hud').hidden=false};
$('#bMenu').onclick=()=>{openWin('메뉴',`<div class="menu"><button id="mIntro">오프닝 다시 보기</button><button id="mAcc">계정 · 클라우드 저장</button><button id="mTitle">타이틀로</button></div>`);
  $('#mIntro').onclick=()=>{closeWin();S.name='';startIntro()};$('#mTitle').onclick=()=>{closeWin();$('#title').hidden=false;$('#title').classList.remove('out');$('#hud').hidden=true;S.started=false};
  $('#mAcc').onclick=()=>openWin('계정 · 클라우드',`<p class="sub">아이디로 로그인하면 폰·PC 어디서든 이어서 해요. 마을은 1분마다, 그리고 앱을 닫을 때 자동으로 클라우드에 저장돼요.</p><div class="acc"><div>아이디<b>innkeeper01</b></div><div>마지막 저장<b>방금 전 · 클라우드</b></div><div>연결 기기<b>휴대폰 · PC</b></div></div><p class="note">시안 화면이에요 (실제 로그인은 개발 단계에서)</p>`)};

/* ---------- boot ---------- */
addEventListener('resize',()=>{clearTimeout(window.__r);window.__r=setTimeout(resize,150)});
loadSprites(()=>{S.land=4;defaultTown(4);rebuildPaths();spawnActors();resize();setNight(true);S.nightT=1;cam={x:0,y:20};
  requestAnimationFrame(t=>{last=t;requestAnimationFrame(frame)});
  (function loop(){upd(1/30);setTimeout(loop,33)})()});

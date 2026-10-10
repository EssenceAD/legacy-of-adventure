/* ===== core: palette, color utils, pixel grid, character sprites ===== */
const hex2rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const rgb2hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
function mix(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t)}
const SHADOW='#2a1630', LIGHT='#fff3d6', OUTL='#1c1018';
const dk=(c,t=.32)=>mix(c,SHADOW,t), lt=(c,t=.28)=>mix(c,LIGHT,t);
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)%100000)/100000}}
const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];

/* paint helpers on 2D ctx (1 unit = 1 pixel) */
function P(ctx){
  const o={ctx,
    px(x,y,c){ctx.fillStyle=c;ctx.fillRect(x|0,y|0,1,1)},
    rect(x,y,w,h,c){if(w<=0||h<=0)return;ctx.fillStyle=c;ctx.fillRect(x|0,y|0,w|0,h|0)},
    dither(x,y,w,h,c1,c2,t){ // t: 0..1 amount of c2
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){const X=x+i,Y=y+j;o.px(X,Y,(BAYER[Y&3][X&3]+.5)/16<t?c2:c1)}},
    hline(x,y,w,c){o.rect(x,y,w,1,c)}, vline(x,y,h,c){o.rect(x,y,1,h,c)},
    ell(cx,cy,rx,ry,c){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry;if(dx*dx+dy*dy<=1)o.px(x,y,c)}},
    tri(ax,ay,bx,by,cx_,cy_,c){const minx=Math.floor(Math.min(ax,bx,cx_)),maxx=Math.ceil(Math.max(ax,bx,cx_)),miny=Math.floor(Math.min(ay,by,cy_)),maxy=Math.ceil(Math.max(ay,by,cy_));
      const s=(px,py,qx,qy,rx,ry)=>(px-rx)*(qy-ry)-(qx-rx)*(py-ry);
      for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){const X=x+.5,Y=y+.5;const d1=s(X,Y,ax,ay,bx,by),d2=s(X,Y,bx,by,cx_,cy_),d3=s(X,Y,cx_,cy_,ax,ay);const n=(d1<0)||(d2<0)||(d3<0),p=(d1>0)||(d2>0)||(d3>0);if(!(n&&p))o.px(x,y,c)}}
  };return o}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return c}

/* ---------- character sprite builder (grid -> auto outline + rim shading) ---------- */
const GW=22, GH=30;
function Grid(w=GW,h=GH,ox=0,oy=0){
  const g=Array.from({length:h},()=>Array(w).fill(null));
  const set=(x,y,c,tag)=>{x=(Math.floor(x))+ox;y=(Math.floor(y))+oy;if(x>=0&&y>=0&&x<w&&y<h)g[y][x]={c,tag}};
  const o={g,w,h,set,
    rect(x,y,W,H,c,tag){for(let j=0;j<H;j++)for(let i=0;i<W;i++)set(x+i,y+j,c,tag)},
    ell(cx,cy,rx,ry,c,tag,clip){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry;if(dx*dx+dy*dy<=1&&(!clip||clip(x,y)))set(x,y,c,tag)}},
    line(x0,y0,x1,y1,c,tag){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(let i=0;i<=n;i++)set(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),c,tag)},
    tri(ax,ay,bx,by,cx_,cy_,c,tag){const s=(px,py,qx,qy,rx,ry)=>(px-rx)*(qy-ry)-(qx-rx)*(py-ry);
      for(let y=-oy;y<h-oy;y++)for(let x=-ox;x<w-ox;x++){const X=x+.5,Y=y+.5;const d1=s(X,Y,ax,ay,bx,by),d2=s(X,Y,bx,by,cx_,cy_),d3=s(X,Y,cx_,cy_,ax,ay);if(!(((d1<0)||(d2<0)||(d3<0))&&((d1>0)||(d2>0)||(d3>0))))set(x,y,c,tag)}},
    clear(x,y){if(x>=0&&y>=0&&x<w&&y<h)g[y][x]=null},
    render(opts={}){
      const cv=canvas(w,h),ctx=cv.getContext('2d');
      const filled=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&g[y][x]&&g[y][x].tag!=='ol';
      // rim shading (light from top-left)
      const out=g.map(r=>r.map(p=>p&&{...p}));
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=g[y][x];if(!p||p.tag==='flat'||p.tag==='eye')continue;
        const r=!filled(x+1,y), b=!filled(x,y+1);
        const l=!filled(x-1,y), t=!filled(x,y-1);
        if(r||b) out[y][x].c=dk(p.c,.3); else if(t||l&&!filled(x-1,y-1)) out[y][x].c=lt(p.c,.22);}
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=out[y][x];if(p){ctx.fillStyle=p.c;ctx.fillRect(x,y,1,1)}}
      // outline
      ctx.fillStyle=opts.outline||OUTL;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(filled(x,y))continue;if(filled(x+1,y)||filled(x-1,y)||filled(x,y+1)||filled(x,y-1))ctx.fillRect(x,y,1,1)}
      return cv}
  };return o}

/* palettes */
const SK={skin:'#f2c49b',skin2:'#d99a78',eye:'#2a1a2e',blush:'#ec8f86'};
const CLASSES={
  knight:{name:'기사',face:{eyes:'dot',brow:'angry',mouth:'flat',scar:true},hair:'#7a4a2c',style:'short',cloth:'#3f6fd1',arm:'#b9c3d6',pants:'#8e98ad',boots:'#6b4128',accent:'#e8b94a',weapon:'sword',shield:true},
  mage:{name:'마법사',face:{eyes:'calm',mouth:'tiny',blush:false},hair:'#dfe3f2',style:'long',cloth:'#7b4bb8',arm:'#7b4bb8',pants:'#5a3590',boots:'#5b3a26',accent:'#f2c447',weapon:'staff',robe:true,hat:'wizard',hatc:'#6a3ea6',elf:true},
  dwarf:{name:'전사',face:{eyes:'squint',brow:'bushy',nose:'big',mouth:'none',brow2:1},hair:'#e0702a',style:'none',cloth:'#8a5a34',arm:'#9aa3b5',pants:'#5d4030',boots:'#4a2f20',accent:'#c9a04a',weapon:'axe',dwarf:true,beard:'#e0702a',helm:'#a7afbf'},
  rogue:{name:'도적',face:{eyes:'sly',mouth:'smirk',freckle:true},hair:'#c98a4a',style:'short',cloth:'#7a4a2a',arm:'#e8d4b0',pants:'#3a3040',boots:'#5b3a26',accent:'#b8873e',weapon:'dagger',hood:'#4f8a3a',elf:true},
  cleric:{name:'사제',face:{eyes:'sparkle',mouth:'tiny',brow:'up'},hair:'#f3d36b',style:'braid',cloth:'#f4f0e6',arm:'#f4f0e6',pants:'#d8cdb4',boots:'#8a6040',accent:'#e0a93a',weapon:'book',robe:true},
  keeper:{name:'노주인',face:{eyes:'happy',mouth:'none',glasses:true,nose:'big',blush:true},hair:'#d8d8d8',style:'bald',cloth:'#7a4a2c',arm:'#f2ead8',pants:'#4a3a30',boots:'#3e2a1e',accent:'#efe6cf',weapon:null,apron:'#efe6cf',stache:'#f4f4f4'},
  post:{name:'우체부',face:{eyes:'round',mouth:'o',freckle:true},hair:'#d9542e',style:'short',cloth:'#3f6fd1',arm:'#3f6fd1',pants:'#2f3f6a',boots:'#5b3a26',accent:'#e8b94a',weapon:null,bandana:'#2f57b0'},
  hero:{name:'나',face:{eyes:'dot',brow:'angry',mouth:'grin',scar:true},hair:'#5a3424',style:'short',cloth:'#8a5a34',arm:'#efe0bf',pants:'#4a3f5a',boots:'#5b3a26',accent:'#4f9a4a',weapon:null,bandana:'#4f9a4a',apron:'#e9dcc0'}
};

/* pose: {lx,rx,bob,armF,armB,sit,atk,eye} */
function drawChar(def,pose={}){
  const G=Grid(24,33,1,3);
  const bob=pose.bob||0, dw=def.dwarf, sit=pose.sit;
  const headCY=(dw?12.5:10)+bob+(sit?3:0), bodyY=(dw?17:15)+bob+(sit?3:0), legY=dw?24:22;
  const cx=10.5;
  // shield (behind)
  if(def.shield&&!sit){G.ell(5.5,bodyY+4,3.2,4,'#9aa6be','base');G.ell(5.5,bodyY+4,1.6,2.2,def.cloth,'base');G.set(5,bodyY+4,def.accent)}
  // long hair back
  if(def.style==='long')G.rect(5,headCY,5,10,def.hair);
  if(def.style==='braid'){G.rect(5,headCY+2,3,6,def.hair);G.ell(6,headCY+9,1.6,1.6,def.hair)}
  // legs
  if(!sit){
    const lx=pose.lx||0, rx=pose.rx||0;
    if(!def.robe){
      G.rect(8+lx,legY,2,(dw?3:5)-0,dk(def.pants,.15));G.rect(8+lx,dw?26:25,3,dw?2:3,dk(def.boots,.1));
      G.rect(11+rx,legY,2,dw?3:5,def.pants);G.rect(11+rx,dw?26:25,3,dw?2:3,def.boots);
    }else{
      G.rect(8+lx,27,3,2,dk(def.boots,.1));G.rect(11+rx,27,3,2,def.boots);
    }
  }
  // back arm
  const aB=pose.armB||0;
  G.rect(6,bodyY+1+aB,2,5,dk(def.arm,.25));G.rect(6,bodyY+6+aB,2,1,SK.skin2);
  // body
  if(def.robe&&!sit){
    for(let j=0;j<29-bodyY;j++){const ww=8+Math.floor(j/3);G.rect(Math.round(cx-ww/2),bodyY+j,ww,1,def.cloth)}
    G.rect(10,bodyY,2,29-bodyY-2,def.accent,'flat'); // trim stripe
    G.rect(Math.round(cx-4),bodyY+5,8,1,def.accent);
  }else{
    const bw=dw?10:8;G.rect(Math.round(cx-bw/2),bodyY,bw,(dw?8:7)-(sit?1:0),def.cloth);
    if(def.apron)G.rect(Math.round(cx-2),bodyY+2,5,6,def.apron);
    if(!def.robe)G.rect(Math.round(cx-bw/2),bodyY+(dw?6:5),bw,1,def.accent);
    if(def.weapon==='sword'){G.rect(10,bodyY,3,6,'#2f57b0');G.set(11,bodyY+2,def.accent,'flat')}
  }
  // beard (dwarf) under head
  // head
  G.ell(cx+.6,headCY-.2,6.2,5.6,SK.skin);
  if(def.elf){G.tri(5,headCY-1,6.5,headCY+1.5,2.5,headCY-3,SK.skin)}
  // hair styles
  const top=(x,y)=>y<headCY-0.5||x<cx-2;
  if(def.style==='short'||def.style==='long'||def.style==='braid'){
    G.ell(cx+.3,headCY-1.9,6.7,4.9,def.hair,null,(x,y)=>y<headCY-1.6||x<cx-2.4&&y<headCY+3.5);
    G.rect(12,headCY-3.6,5,1,def.hair);G.set(16,headCY-2.6,def.hair);G.set(12,headCY-2.6,def.hair);
  }
  if(def.style==='bald'){G.rect(5,headCY-1,2,4,def.hair);G.ell(cx,headCY-4,3,1.2,lt(SK.skin,.15))}
  if(def.bandana){G.ell(cx+.3,headCY-2.8,6.7,3.6,def.bandana,null,(x,y)=>y<headCY-2);G.rect(4,headCY-1,2,2,def.bandana);G.set(3,headCY,def.bandana)}
  if(def.hood){G.ell(cx-.2,headCY-.6,7.1,6.6,def.hood,null,(x,y)=>!(x>=cx-0.6&&y>=headCY-3&&y<=headCY+4));G.rect(5,bodyY,5,4,def.hood)}
  if(def.helm){G.ell(cx+.5,headCY-2.6,6.8,4.2,def.helm,null,(x,y)=>y<headCY-2);G.rect(4,headCY-2.5,14,1,dk(def.helm,.2));
    G.set(4,headCY-4,'#f3ead3');G.set(3,headCY-5,'#f3ead3');G.set(3,headCY-6,'#f3ead3');G.set(17,headCY-4,'#f3ead3');G.set(18,headCY-5,'#f3ead3');G.set(18,headCY-6,'#f3ead3')}
  if(def.hat==='wizard'){G.rect(2,headCY-5,18,2,def.hatc);G.tri(6,headCY-4.5,16,headCY-4.5,7,headCY-13,def.hatc);G.rect(7,headCY-6,9,1,def.accent,'flat')}
  if(pose.back){ // back view: hair over the face area
    if(def.style!=='bald'){const hc=def.hood||def.hair;for(let y=0;y<G.h;y++)for(let x=0;x<G.w;x++){const p=G.g[y][x];if(p&&(p.c===SK.skin||(def.hood&&p.c===def.hair))&&y-3<headCY+4)G.g[y][x]={c:hc}}}
    if(def.dwarf&&def.beard){G.set(16,headCY+3,def.beard);G.set(16,headCY+4,def.beard)}
  }else{
  // face
  const ey=Math.round(headCY-.6);const F=def.face||{};const E=SK.eye,BR=dk(def.brow||def.hair||'#5a3424',.3),MO='#a8404a';
  const eyes=(fn)=>{for(const ex of [10,14])fn(ex)};
  if(pose.sleep){G.rect(10,ey+1,2,1,E,'eye');G.rect(14,ey+1,2,1,E,'eye')}
  else switch(F.eyes){
    case 'dot': eyes(ex=>G.rect(ex+(ex===10?1:0),ey+1,1,2,E,'eye'));break;                        // 작은 점눈
    case 'calm': eyes(ex=>{G.rect(ex,ey,2,1,BR,'eye');G.rect(ex+(ex===10?1:0),ey+1,1,1,E,'eye')});break; // 반쯤 감은 눈
    case 'squint': eyes(ex=>G.rect(ex,ey+1,2,1,E,'eye'));break;                                    // 실눈
    case 'sly': G.rect(11,ey+1,1,2,E,'eye');G.rect(14,ey+2,2,1,E,'eye');break;                      // 한쪽 윙크
    case 'happy': eyes(ex=>{G.set(ex,ey+1,E,'eye');G.set(ex+1,ey,E,'eye')});break; // ^^
    case 'round': eyes(ex=>{G.rect(ex,ey,2,2,E,'eye');G.set(ex+1,ey,'#ffffff','eye')});break;      // 동글눈
    default: eyes(ex=>{G.rect(ex,ey,2,3,E,'eye');G.set(ex+1,ey,'#ffffff','eye');G.set(ex,ey+2,'#5a3a6a','eye')}); // 초롱눈
  }
  // brows
  if(!pose.sleep&&F.brow==='angry'){G.set(10,ey-2,BR,'flat');G.set(11,ey-1,BR,'flat');G.set(15,ey-2,BR,'flat');G.set(14,ey-1,BR,'flat')}
  else if(!pose.sleep&&F.brow==='bushy'){G.rect(9,ey-1,3,1,BR,'flat');G.rect(13,ey-1,4,1,BR,'flat')}
  else if(!pose.sleep&&F.brow==='up'){G.set(10,ey-1,BR,'flat');G.set(11,ey-2,BR,'flat');G.set(14,ey-2,BR,'flat');G.set(15,ey-1,BR,'flat')}
  // nose
  if(F.nose==='big'){G.rect(12,ey+1,2,2,SK.skin2,'flat')}else G.set(13,ey+2,SK.skin2,'flat');
  // mouth
  switch(F.mouth){
    case 'grin': G.rect(11,ey+4,4,1,MO,'eye');G.rect(12,ey+4,2,1,'#ffffff','eye');G.set(11,ey+3,MO,'eye');G.set(14,ey+3,MO,'eye');break; // 이 보이는 웃음
    case 'smirk': G.rect(12,ey+4,2,1,MO,'eye');G.set(14,ey+3,MO,'eye');break;
    case 'o': G.rect(12,ey+3,2,2,'#7a2a3a','eye');break;
    case 'flat': G.rect(12,ey+4,2,1,dk(SK.skin2,.2),'eye');break;
    case 'tiny': G.set(12,ey+4,MO,'eye');break;
    case 'none': break;
    default: G.rect(12,ey+4,2,1,MO,'eye');
  }
  if(F.blush!==false){G.set(9,ey+3,SK.blush,'flat');G.set(16,ey+3,SK.blush,'flat')}
  if(F.freckle){G.set(9,ey+2,'#c27a5a','flat');G.set(10,ey+3,'#c27a5a','flat');G.set(16,ey+2,'#c27a5a','flat')}
  if(F.scar){G.set(15,ey+3,SK.skin2,'flat');G.set(16,ey+2,SK.skin2,'flat')}
  if(F.glasses){const gc='#b08850';for(const ex of [9,13]){G.rect(ex+1,ey-1,2,1,gc,'eye');G.rect(ex+1,ey+2,2,1,gc,'eye');G.set(ex,ey,gc,'eye');G.set(ex,ey+1,gc,'eye');G.set(ex+3,ey,gc,'eye');G.set(ex+3,ey+1,gc,'eye')}}
  if(def.stache){G.rect(12,headCY+2.5,6,2,def.stache);G.set(11,headCY+3.5,def.stache)}
  if(def.beard){G.ell(13.5,headCY+4.4,4.8,4,def.beard,null,(x,y)=>y>=headCY+2.6);G.set(12,headCY+2,dk(def.beard,.2),'flat');G.set(15,headCY+2,dk(def.beard,.2),'flat')}
  }
  // front arm + hand + weapon
  const aF=pose.armF||0;
  if(pose.atk===1){ // wind-up: arm raised
    G.rect(13,bodyY-1,2,4,def.arm);G.rect(13,bodyY-2,2,2,SK.skin);weapon(G,def,13,bodyY-2,'up');
  }else if(pose.atk===2){ // strike forward
    G.rect(13,bodyY+2,4,2,def.arm);G.rect(17,bodyY+2,2,2,SK.skin);weapon(G,def,18,bodyY+2,'fwd');
  }else if(pose.eat){
    G.rect(13,bodyY+1,2,3,def.arm);G.rect(14,bodyY-1-(pose.eat>1?1:0),2,2,SK.skin);
  }else if(pose.pray){
    G.rect(12,bodyY+1,3,3,def.arm);G.rect(14,bodyY+1,2,2,SK.skin);
  }else{
    G.rect(13,bodyY+1+aF,2,5,def.arm);G.rect(13,bodyY+6+aF,2,1,SK.skin);
    if(!sit)weapon(G,def,14,bodyY+6+aF,'rest');
  }
  return G;
}
function weapon(G,def,hx,hy,mode){
  const w=def.weapon;if(!w)return;
  if(w==='sword'){const bl='#e9eef7',hd=def.accent;
    if(mode==='rest'){G.rect(hx,hy+1,1,5,bl);G.rect(hx-1,hy,3,1,hd)}
    if(mode==='up'){G.line(hx-1,hy,hx-5,hy-6,bl);G.rect(hx-1,hy-1,2,2,hd)}
    if(mode==='fwd'){G.rect(hx+1,hy,6,1,bl);G.rect(hx+1,hy+1,6,1,dk(bl,.15));G.rect(hx,hy-1,1,3,hd)}}
  if(w==='axe'){const h='#7a5030',b='#c9d1dc';
    if(mode==='rest'){G.rect(hx,hy-2,1,7,h);G.rect(hx+1,hy-3,2,4,b)}
    if(mode==='up'){G.line(hx,hy,hx-4,hy-6,h);G.rect(hx-6,hy-8,3,4,b)}
    if(mode==='fwd'){G.rect(hx+1,hy,6,1,h);G.rect(hx+6,hy-2,3,5,b)}}
  if(w==='staff'){const h='#8a5a34',o='#7fe6ff';
    if(mode==='rest'){G.rect(hx,hy-14,1,19,h);G.rect(hx-1,hy-16,3,3,o,'flat')}
    if(mode==='up'){G.line(hx,hy+4,hx-2,hy-10,h);G.rect(hx-3,hy-12,3,3,o,'flat')}
    if(mode==='fwd'){G.rect(hx,hy,7,1,h);G.rect(hx+7,hy-1,3,3,o,'flat')}}
  if(w==='dagger'){const bl='#e9eef7';
    if(mode==='rest'){G.rect(hx,hy+1,1,3,bl)}
    if(mode==='up'){G.rect(hx-1,hy-3,1,3,bl)}
    if(mode==='fwd'){G.rect(hx+1,hy,4,1,bl)}}
  if(w==='book'){if(mode==='rest'){G.rect(hx-1,hy-2,3,4,'#b0412f');G.set(hx,hy-1,'#f2c447','flat')}
    if(mode!=='rest'){G.rect(hx-1,hy-3,4,4,'#b0412f')}}
}
/* sleeping: head on pillow + blanket (drawn over a bed) */
function drawSleep(def,breath){
  const G=Grid(26,12);
  G.ell(5.5,6,4.6,4.4,SK.skin);
  if(def.hair&&def.style!=='bald'&&!def.helm&&!def.hood)G.ell(4.4,5,4.4,3.8,def.hair,null,(x,y)=>x<6||y<3);
  if(def.hood)G.ell(4.4,5.5,4.8,4.4,def.hood,null,(x,y)=>x<5||y<3);
  if(def.helm||def.dwarf)G.ell(4.4,5,4.4,3.8,def.helm||def.hair,null,(x,y)=>x<5||y<3);
  if(def.beard)G.ell(8,8,3,2.8,def.beard,null,(x,y)=>y>=7);
  G.rect(6,6,2,1,SK.eye,'eye');
  const b=breath?0:1;
  G.rect(9,3+b,16,9-b,def.cloth);G.rect(9,3+b,16,1,lt(def.cloth,.35));G.rect(9,6+b,16,1,def.accent);
  return G;
}
function buildChar(key){
  const d=CLASSES[key];const R=g=>g.render();
  return {
    def:d,
    idle:[R(drawChar(d,{})),R(drawChar(d,{bob:1}))],
    walk:[R(drawChar(d,{lx:-1,rx:1,armF:1,armB:-1})),R(drawChar(d,{bob:-1})),R(drawChar(d,{lx:1,rx:-1,armF:-1,armB:1})),R(drawChar(d,{bob:-1}))],
    walkB:[R(drawChar(d,{back:1,lx:-1,rx:1,armF:1,armB:-1})),R(drawChar(d,{back:1,bob:-1})),R(drawChar(d,{back:1,lx:1,rx:-1,armF:-1,armB:1})),R(drawChar(d,{back:1,bob:-1}))],
    idleB:[R(drawChar(d,{back:1})),R(drawChar(d,{back:1,bob:1}))],
    sit:[R(drawChar(d,{sit:1,eat:1})),R(drawChar(d,{sit:1,eat:2}))],
    atk:[R(drawChar(d,{atk:1})),R(drawChar(d,{atk:2}))],
    pray:[R(drawChar(d,{pray:1})),R(drawChar(d,{pray:1,bob:1}))],
    sleep:[R(drawSleep(d,0)),R(drawSleep(d,1))]
  };
}

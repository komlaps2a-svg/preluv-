/* Bbubiie Grid Studio - bg-tools.js
   Menimpa fitur Hapus BG (berbasis tanda objek/latar + kuas) dan animasi unduh.
   Dipasang dengan: <script src="bg-tools.js"></script> tepat sebelum </body> */
(()=>{
'use strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));

/*CORE*/
const WMAX=720,BETA=1.6,MU=3,TOL=5,SPW=.35;

function blur3(d,w,h){
 const out=new Float32Array(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let r=0,g=0,b=0,n=0;
  for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
   for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const i=(yy*w+xx)*4;r+=d[i];g+=d[i+1];b+=d[i+2];n++}}
  const o=(y*w+x)*3;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n}
 return out}

function kmeans(px,K){
 const n=px.length/3;if(!n)return new Float32Array(0);
 K=Math.min(K,n);const c=new Float32Array(K*3);
 for(let k=0;k<K;k++){const i=Math.floor((k+.5)*n/K);c[k*3]=px[i*3];c[k*3+1]=px[i*3+1];c[k*3+2]=px[i*3+2]}
 for(let it=0;it<8;it++){
  const s=new Float32Array(K*3),cnt=new Float32Array(K);
  for(let i=0;i<n;i++){let b=0,bd=1e12;
   for(let k=0;k<K;k++){const a=px[i*3]-c[k*3],e=px[i*3+1]-c[k*3+1],f=px[i*3+2]-c[k*3+2],d=a*a+e*e+f*f;if(d<bd){bd=d;b=k}}
   s[b*3]+=px[i*3];s[b*3+1]+=px[i*3+1];s[b*3+2]+=px[i*3+2];cnt[b]++}
  for(let k=0;k<K;k++)if(cnt[k]){c[k*3]=s[k*3]/cnt[k];c[k*3+1]=s[k*3+1]/cnt[k];c[k*3+2]=s[k*3+2]/cnt[k]}}
 return c}

function geo(E,seed,val,pen){
 const {w,h,N,rgb}=E,D=new Float32Array(N),S2=1.4142;
 for(let i=0;i<N;i++)D[i]=seed[i]===val?0:1e9;
 const rel=(i,j,sp)=>{const dj=D[j];if(dj>=1e8)return;const a=i*3,b=j*3;
  const df=(Math.abs(rgb[a]-rgb[b])+Math.abs(rgb[a+1]-rgb[b+1])+Math.abs(rgb[a+2]-rgb[b+2]))/3,
   dc=df>TOL?(df-TOL)*BETA:0;
  const c=dj+sp*SPW+dc+pen[i];if(c<D[i])D[i]=c};
 for(let it=0;it<6;it++){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;
   if(x>0)rel(i,i-1,1);
   if(y>0){rel(i,i-w,1);if(x>0)rel(i,i-w-1,S2);if(x<w-1)rel(i,i-w+1,S2)}}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;
   if(x<w-1)rel(i,i+1,1);
   if(y<h-1){rel(i,i+w,1);if(x<w-1)rel(i,i+w+1,S2);if(x>0)rel(i,i+w-1,S2)}}}
 return D}

function flood(w,h,isRoot,canPass){
 const N=w*h,vis=new Uint8Array(N),st=new Int32Array(N);let sp=0;
 for(let i=0;i<N;i++)if(!vis[i]&&isRoot(i)&&canPass(i)){vis[i]=1;st[sp++]=i}
 while(sp){const i=st[--sp],x=i%w,y=(i/w)|0;
  if(x>0&&!vis[i-1]&&canPass(i-1)){vis[i-1]=1;st[sp++]=i-1}
  if(x<w-1&&!vis[i+1]&&canPass(i+1)){vis[i+1]=1;st[sp++]=i+1}
  if(y>0&&!vis[i-w]&&canPass(i-w)){vis[i-w]=1;st[sp++]=i-w}
  if(y<h-1&&!vis[i+w]&&canPass(i+w)){vis[i+w]=1;st[sp++]=i+w}}
 return vis}

function dilate(a,w,h,n){
 let c=a;
 for(let k=0;k<n;k++){const o=Uint8Array.from(c);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!c[i])continue;
   if(x>0)o[i-1]=1;if(x<w-1)o[i+1]=1;if(y>0)o[i-w]=1;if(y<h-1)o[i+w]=1}
  c=o}
 return c}

/* tebakan awal: pinggir foto = latar, tengah foto = objek */
function autoSeeds(E){
 const {w,h,rgb}=E,s=new Uint8Array(w*h),m=Math.min(w,h),bw=Math.max(3,Math.round(m*.03)),cb=Math.max(6,Math.round(m*.06));
 const blk=(x0,y0)=>{let r=0,g=0,b=0,n=0;
  for(let y=y0;y<Math.min(h,y0+cb);y++)for(let x=x0;x<Math.min(w,x0+cb);x++){const i=(y*w+x)*3;r+=rgb[i];g+=rgb[i+1];b+=rgb[i+2];n++}
  return[r/n,g/n,b/n]};
 const ym=Math.round(h*.45),cs=[blk(0,0),blk(w-cb,0),blk(0,ym),blk(w-cb,ym)];
 const near=i=>{let b=1e9;for(const c of cs){const a=rgb[i*3]-c[0],e=rgb[i*3+1]-c[1],f=rgb[i*3+2]-c[2],d=Math.sqrt(a*a+e*e+f*f);if(d<b)b=d}return b};
 let any=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const edge=x<bw||x>=w-bw||y<bw,bot=y>=h-bw;if(!edge&&!bot)continue;
  const i=y*w+x;if(near(i)<(bot?30:60)){s[i]=2;any++}}
 if(!any)for(let x=0;x<w;x++)for(let y=0;y<bw;y++)s[y*w+x]=2;
 const cx=w/2,cy=h*.52,rx=w*.1,ry=h*.16;let fg=0;
 for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(h-1,Math.ceil(cy+ry));y++)
  for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(w-1,Math.ceil(cx+rx));x++){
   if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1){const i=y*w+x;if(near(i)>28){s[i]=1;fg++}}}
 if(!fg)for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(h-1,Math.ceil(cy+ry));y++)
  for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(w-1,Math.ceil(cx+rx));x++)
   if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)s[y*w+x]=1;
 return s}

/* gambar coretan hijau/merah ke peta seed */
function stampStroke(s,E,k){
 const val=k.t==='fg'?1:2,{w,h}=E,rad=Math.max(1,k.r*w),p=k.p;
 const dot=(cx,cy)=>{
  const x0=Math.max(0,Math.floor(cx-rad)),x1=Math.min(w-1,Math.ceil(cx+rad)),y0=Math.max(0,Math.floor(cy-rad)),y1=Math.min(h-1,Math.ceil(cy+rad));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=rad*rad)s[y*w+x]=val};
 let px=p[0]*w,py=p[1]*h;dot(px,py);
 for(let i=2;i<p.length;i+=2){const nx=p[i]*w,ny=p[i+1]*h,d=Math.hypot(nx-px,ny-py),n=Math.max(1,Math.ceil(d/(rad*.5)));
  for(let j=1;j<=n;j++)dot(px+(nx-px)*j/n,py+(ny-py)*j/n);px=nx;py=ny}}

/* segmentasi: jarak geodesik dari tanda objek vs tanda latar + model warna */
function segment(E,seed){
 const {w,h,N,rgb}=E,out=new Uint8Array(N);
 const gather=v=>{const idx=[];for(let i=0;i<N;i++)if(seed[i]===v)idx.push(i);
  const st=Math.max(1,Math.floor(idx.length/3000)),o=[];
  for(let j=0;j<idx.length;j+=st){const i=idx[j];o.push(rgb[i*3],rgb[i*3+1],rgb[i*3+2])}
  return{n:idx.length,px:Float32Array.from(o)}};
 const F=gather(1),B=gather(2);
 if(!F.n)return out;
 if(!B.n){out.fill(255);return out}
 const cf=kmeans(F.px,5),cb=kmeans(B.px,5),nf=cf.length/3,nb=cb.length/3,pf=new Float32Array(N),pb=new Float32Array(N);
 for(let i=0;i<N;i++){const r=rgb[i*3],g=rgb[i*3+1],b=rgb[i*3+2];let df=1e12,db=1e12;
  for(let k=0;k<nf;k++){const a=r-cf[k*3],e=g-cf[k*3+1],f=b-cf[k*3+2],d=a*a+e*e+f*f;if(d<df)df=d}
  for(let k=0;k<nb;k++){const a=r-cb[k*3],e=g-cb[k*3+1],f=b-cb[k*3+2],d=a*a+e*e+f*f;if(d<db)db=d}
  df=Math.sqrt(df);db=Math.sqrt(db);const pc=db/(df+db+1e-3);pf[i]=MU*(1-pc);pb[i]=MU*pc}
 const DF=geo(E,seed,1,pf),DB=geo(E,seed,2,pb),p=new Float32Array(N),hard=new Uint8Array(N);
 for(let i=0;i<N;i++){p[i]=DB[i]/(DF[i]+DB[i]+1e-6);hard[i]=p[i]>.5?1:0}
 const hd=dilate(hard,w,h,3),kc=flood(w,h,i=>seed[i]===1,i=>hd[i]===1),keep=new Uint8Array(N);
 for(let i=0;i<N;i++)keep[i]=kc[i]&&hard[i]?1:0;
 const kd=dilate(keep,w,h,2);
 const isB=i=>{const x=i%w,y=(i/w)|0;return x===0||y===0||x===w-1||y===h-1};
 const k3=dilate(keep,w,h,4);
 const reach0=flood(w,h,i=>!k3[i]&&(seed[i]===2||isB(i)),i=>!k3[i]),
  reach=dilate(reach0,w,h,4);
 for(let i=0;i<N;i++){
  if(!keep[i]&&!reach[i]&&seed[i]!==2){out[i]=255;continue}
  if(!kd[i]){out[i]=0;continue}
  const a=(p[i]-.5)*6+.5;out[i]=Math.round(255*Math.max(0,Math.min(1,a)))}
 return out}
/*ENDCORE*/

if(typeof document==='undefined')return;

/* ================= CSS ================= */
const css=`
#cm{z-index:45}
#cwrap{display:flex;width:100%;height:min(46vh,520px);overflow:auto;border-radius:18px;background:#160710;box-shadow:inset 0 0 0 1px var(--line);overscroll-behavior:contain}
#cwrap canvas{margin:auto;display:block;flex:none;touch-action:none;border-radius:8px}
.tools{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.tb{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 2px 7px;border:1.5px solid var(--line);border-radius:16px;background:#0000002e;color:var(--mut);font-weight:700;font-size:12px;transition:.2s}
.tb .i{width:22px;height:22px}
.tb.on{color:#fff;border-color:var(--c,var(--p2));background:color-mix(in srgb,var(--c,var(--p2)) 22%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--c,var(--p2)) 28%,transparent)}
.tb.on .i{stroke:var(--c,#fff)}
.hint .mini{width:14px;height:14px;border-radius:50%;border:2.5px solid #ffffff40;border-top-color:var(--p2);animation:sp .8s linear infinite}
#dx{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:18px;background:radial-gradient(520px 420px at 85% 0,#f5189b55,transparent),radial-gradient(480px 420px at 0 100%,#ff7aa844,transparent),#1c0710f2;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
#dx.on{display:flex;animation:dxin .35s ease}
@keyframes dxin{from{opacity:0}}
#dxc{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
.dxb{position:relative;width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.dxi{width:58px;height:58px;position:relative;flex:none}
.dxi .ring{position:absolute;inset:0;border-radius:50%;border:5px solid #ffffff26;border-top-color:var(--p2);animation:sp .9s linear infinite}
.dxi.ok .ring{animation:dpop .7s ease-out 1;border-color:transparent;background:var(--grad);box-shadow:0 0 30px #f5189b99}
.dxi svg{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}
.dxi svg path{stroke-dasharray:40;stroke-dashoffset:40;transition:stroke-dashoffset .5s .2s}
.dxi.ok svg path{stroke-dashoffset:0}
@keyframes dpop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.dxt b{display:block;font-size:20px;font-weight:800}
.dxt small{display:block;color:var(--mut);font-size:13px;min-height:19px}
.dxg{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:7px;width:min(80vw,320px,calc((100vh - 330px)*.75));transition:transform .6s cubic-bezier(.5,0,.2,1)}
.dxg.pack{transform:scale(.9)}
.dxg.pack::after{content:"";position:absolute;left:-4%;right:-4%;top:0;height:4px;border-radius:9px;background:linear-gradient(90deg,transparent,#fff,transparent);box-shadow:0 0 14px #fff;animation:dzip 1s ease-in-out infinite alternate}
@keyframes dzip{to{top:calc(100% - 4px)}}
.dc{position:relative;aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:#ffffff0d;box-shadow:inset 0 0 0 1.5px #ffffff22;transition:box-shadow .3s,opacity .3s}
.dc .dn{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:26px;color:#ffffff40;transition:opacity .3s}
.dc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.3);filter:blur(8px);transition:opacity .45s,transform .55s cubic-bezier(.2,1.3,.4,1),filter .45s}
.dc.ok img{opacity:1;transform:none;filter:none}
.dc.ok .dn{opacity:0}
.dc.act{box-shadow:inset 0 0 0 2px var(--p2),0 0 24px #f5189b88;animation:dpulse 1s ease-in-out infinite}
.dc.act::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,#ffffff44 50%,transparent 70%);background-size:250% 100%;animation:dshim 1.1s linear infinite}
.dc.skip{opacity:.22}
.dc .dk{position:absolute;right:5px;bottom:5px;width:20px;height:20px;border-radius:50%;background:var(--grad);display:grid;place-items:center;transform:scale(0);transition:transform .4s .25s cubic-bezier(.2,1.6,.4,1)}
.dc.ok .dk{transform:scale(1)}
.dc .dk svg{width:12px;height:12px;stroke:#fff;fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.dc.flash::before{content:"";position:absolute;inset:0;background:#fff;z-index:2;animation:dflash .6s ease-out forwards}
@keyframes dflash{from{opacity:.85}to{opacity:0}}
@keyframes dshim{to{background-position:-150% 0}}
@keyframes dpulse{50%{transform:scale(1.05)}}
@keyframes dwave{50%{transform:translateY(-9px)}}
.dxp{width:min(80vw,320px);height:12px;border-radius:99px;background:#ffffff1c;overflow:hidden;box-shadow:inset 0 0 0 1px var(--line)}
.dxp i{display:block;height:100%;width:0;border-radius:99px;background:repeating-linear-gradient(45deg,#ffffff38 0 10px,transparent 10px 20px),linear-gradient(135deg,#FF5CB8,#F5189B);background-size:28px 28px,100% 100%;animation:dstripe .8s linear infinite;box-shadow:0 0 14px #f5189b}
@keyframes dstripe{to{background-position:28px 0,0 0}}
.dxl{display:flex;justify-content:space-between;width:min(80vw,320px);font-weight:700;font-size:13px;color:var(--mut)}
.dxl #dxm{color:#fff;font-size:15px}
.dxa{display:flex;gap:10px;width:min(80vw,320px)}
.dxa .btn{margin-top:4px;flex:1}
@media(prefers-reduced-motion:reduce){.dc.act,.dxg.pack::after{animation:none!important}}
`;
document.head.append(Object.assign(document.createElement('style'),{textContent:css}));

/* ================= mesin ================= */
const ENG=new WeakMap();
function makeEng(t){
 const o=t.orig,k=Math.min(1,WMAX/Math.max(o.width,o.height)),w=Math.max(8,Math.round(o.width*k)),h=Math.max(8,Math.round(o.height*k));
 const c=mk(w,h),g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(o,0,0,w,h);
 return{orig:o,w,h,N:w*h,rgb:blur3(g.getImageData(0,0,w,h).data,w,h),
  strokes:(t.sk||[]).map(s=>({t:s.t,r:s.r,p:s.p.slice()})),
  ai:t.ai&&t.ai.length===w*h?t.ai:null,auto:null,seg:null,mask:mk(o.width,o.height)}}
function getEng(t){let E=ENG.get(t.orig);if(!E){E=makeEng(t);ENG.set(t.orig,E)}return E}
function seedsOf(E){
 let s;
 if(E.ai)s=Uint8Array.from(E.ai);else{if(!E.auto)E.auto=autoSeeds(E);s=Uint8Array.from(E.auto)}
 for(const k of E.strokes)if(k.t==='fg'||k.t==='bg')stampStroke(s,E,k);
 return s}
function segCanvas(E,a){
 const sc=mk(E.w,E.h),g=sc.getContext('2d'),im=g.createImageData(E.w,E.h);
 for(let i=0;i<E.N;i++)im.data[i*4+3]=a[i];
 g.putImageData(im,0,0);
 const o=mk(E.orig.width,E.orig.height),og=o.getContext('2d');og.imageSmoothingEnabled=true;og.imageSmoothingQuality='high';og.drawImage(sc,0,0,o.width,o.height);return o}
function seg1(g,type,r,ax,ay,bx,by,W2,H2){
 g.save();g.globalCompositeOperation=type==='er'?'destination-out':'source-over';g.strokeStyle='#000';g.fillStyle='#000';g.lineCap=g.lineJoin='round';g.lineWidth=Math.max(1,2*r*W2);
 g.beginPath();g.moveTo(ax*W2,ay*H2);g.lineTo(bx*W2+.01,by*H2);g.stroke();g.restore()}
function applyManual(g,k,W2,H2){const p=k.p;
 if(p.length<4){seg1(g,k.t,k.r,p[0],p[1],p[0],p[1],W2,H2);return}
 for(let i=2;i<p.length;i+=2)seg1(g,k.t,k.r,p[i-2],p[i-1],p[i],p[i+1],W2,H2)}
function remask(E){
 const g=E.mask.getContext('2d');g.clearRect(0,0,E.mask.width,E.mask.height);g.drawImage(E.seg,0,0);
 for(const k of E.strokes)if(k.t==='er'||k.t==='rs')applyManual(g,k,E.mask.width,E.mask.height)}
function rebuild(E){E.seg=segCanvas(E,segment(E,seedsOf(E)));remask(E)}
function cutout(E){
 const c=mk(E.orig.width,E.orig.height),g=c.getContext('2d');g.drawImage(E.orig,0,0);
 g.globalCompositeOperation='destination-in';g.drawImage(E.mask,0,0);return c}
const copyStrokes=E=>E.strokes.map(k=>({t:k.t,r:k.r,p:k.p.slice()}));

function autoCore(t){
 const E=getEng(t);E.strokes=[];E.ai=null;rebuild(E);
 t.sk=[];t.ai=null;setCut(cutout(E))}

async function autoCut(){
 const t=cur();if(!t.orig)return toast('Upload foto dulu');
 await busy('Menghapus background…');
 try{autoCore(t)}catch(x){toast('Gagal: '+x.message)}
 await busy('')}

function aiSeeds(E,oc){
 const c=mk(E.w,E.h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(oc,0,0,E.w,E.h);
 const d=g.getImageData(0,0,E.w,E.h).data,s=new Uint8Array(E.N);let f=0;
 for(let i=0;i<E.N;i++){const a=d[i*4+3];if(a>215){s[i]=1;f++}else if(a<40)s[i]=2}
 return f>E.N*.01?s:null}

async function aiCut(inEditor){
 const t=cur();if(!t.orig)return toast('Upload foto dulu');
 await busy('Memuat model AI…');
 try{
  const {removeBackground}=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
  const out=await removeBackground(await blobOf(t.orig,'image/png'),{progress:(k,a,b)=>{$('#bmsg').textContent='AI '+Math.round(a/b*100)+'%'}});
  const oc=await toCv(out,4000),E=getEng(t),s=aiSeeds(E,oc);
  if(!s)throw new Error('objek tidak terdeteksi');
  E.ai=s;t.ai=s;$('#bmsg').textContent='Merapikan tepi…';await nextFrame();
  rebuild(E);t.sk=copyStrokes(E);
  if(inEditor){ED.E=E;fit();req()}else setCut(cutout(E));
 }catch(e){toast('AI gagal ('+e.message+'). Pakai BG otomatis atau cek internet.')}
 await busy('')}

async function loadPhoto(f){
 const t=cur();await busy('Memproses foto…');
 try{t.orig=await toCv(f,2200);t.ob=await blobOf(t.orig,'image/jpeg',.92);t.x=t.y=0;t.s=100;t.sk=[];t.ai=null;sync();
  await busy('Menghapus background…');autoCore(t);toast('Foto masuk ke kotak '+(S.sel+1)+'. Kurang pas? Ketuk "Arahkan area yang dihapus".')}
 catch(x){toast('Foto tidak bisa dibuka')}
 await busy('')}

/* ================= editor arahan ================= */
document.body.insertAdjacentHTML('beforeend',`
<div class="modal" id="cm"><div class="mc">
<div class="top">
 <div class="mh"><button class="pill" id="cx" aria-label="Batal"><svg class="i"><use href="#i-x"/></svg></button><div class="nv">Arahkan hapus BG</div><button class="pill pk" id="cok"><svg class="i"><use href="#i-ok"/></svg>Terapkan</button></div>
 <div id="cwrap"><canvas id="ccv"></canvas></div>
 <div class="hint" id="chn"></div>
</div>
<div class="card"><h2>Alat</h2><div class="tools" id="ctl"></div>
 <div class="fl"><span>Ukuran kuas</span><b id="cbv">36</b></div><input id="cbr" type="range" min="8" max="100" value="36">
 <div class="fl"><span>Perbesar</span><b id="czv">100%</b></div><input id="czm" type="range" min="100" max="400" step="10" value="100">
 <div class="row"><button class="btn ghost" id="cun"><svg class="i"><use href="#i-l"/></svg>Urungkan</button><button class="btn ghost" id="crs"><svg class="i"><use href="#i-ctr"/></svg>Ulangi otomatis</button></div>
 <button class="btn" id="cai"><svg class="i"><use href="#i-ai"/></svg>Pakai AI sebagai dasar</button>
 <div class="line" style="margin-top:16px"><span>Bayangan area terhapus</span><button class="sw on" id="cgh" aria-label="Bayangan"></button></div>
 <div class="line"><span>Tampilkan coretan</span><button class="sw on" id="cmk" aria-label="Coretan"></button></div>
</div>
<div class="card"><h2>Cara pakai</h2><p class="mut">1. Coret <b style="color:#3cff9e">Objek</b> di bagian baju yang harus tetap ada.<br>2. Coret <b style="color:#ff5c7a">Latar</b> di background yang harus hilang.<br>3. Hasil langsung diperbarui. Tambah coretan di area yang masih salah.<br>4. Untuk merapikan tepi, pakai <b>Hapus</b> atau <b>Pulihkan</b>.<br>5. Perbesar lalu pakai alat <b>Geser</b> untuk menggulir foto.</p></div>
</div></div>`);

const TOOLS=[
 ['fg','Objek','#3cff9e','<path d="M5 12.5l4.5 4.5L19 7"/>','Coret bagian yang HARUS TETAP ADA (baju/orang)'],
 ['bg','Latar','#ff5c7a','<path d="M6 6l12 12M18 6L6 18"/>','Coret background yang mau DIHAPUS'],
 ['er','Hapus','#ffb86b','<path d="M16 3l5 5-11 12H5l-2-2L16 3zM9 20h12"/>','Gosok untuk menghapus langsung bagian tertentu'],
 ['rs','Pulihkan','#6bd0ff','<path d="M18 3l3 3-10 10-4 1 1-4L18 3zM4 21c2.5 0 3.5-1 3.5-3"/>','Gosok untuk mengembalikan bagian yang ikut terhapus'],
 ['hand','Geser','#ffffff','<use href="#i-mv"/>','Geser foto saat diperbesar']];
const ED={tool:'fg',brush:36,zoom:1,ghost:true,marks:true,E:null,cur:null,ptr:null,hover:null,n0:0,busy:false};
$('#ctl').innerHTML=TOOLS.map(([k,l,c,p])=>`<button class="tb${k===ED.tool?' on':''}" data-k="${k}" style="--c:${c}"><svg class="i" viewBox="0 0 24 24">${p}</svg>${l}</button>`).join('');
const cv=$('#ccv'),tmp=mk(2,2);let chk=null,rq=0;

function setHint(){
 const h=$('#chn');
 if(ED.busy)h.innerHTML='<span class="mini"></span>Memproses…';
 else h.textContent=TOOLS.find(x=>x[0]===ED.tool)[4]}
function setTool(k){ED.tool=k;$$('#ctl .tb').forEach(b=>b.classList.toggle('on',b.dataset.k===k));cv.style.touchAction=k==='hand'?'auto':'none';setHint();req()}
$('#ctl').onclick=e=>{const b=e.target.closest('.tb');if(b)setTool(b.dataset.k)};

function fit(){
 const E=ED.E;if(!E)return;
 const wrap=$('#cwrap'),ow=E.orig.width,oh=E.orig.height,f=Math.min(wrap.clientWidth/ow,wrap.clientHeight/oh)*ED.zoom,dr=Math.min(1,1400/Math.max(ow,oh));
 cv.style.width=Math.round(ow*f)+'px';cv.style.height=Math.round(oh*f)+'px';
 const nw=Math.round(ow*dr),nh=Math.round(oh*dr);if(cv.width!==nw||cv.height!==nh){cv.width=nw;cv.height=nh}
 tmp.width=cv.width;tmp.height=cv.height;chk=null}
function pattern(g,s){
 if(chk)return chk;const t=Math.max(12,Math.round(s/36)),c=mk(t*2,t*2),x=c.getContext('2d');
 x.fillStyle='#f4f4f7';x.fillRect(0,0,t*2,t*2);x.fillStyle='#d9d9e2';x.fillRect(0,0,t,t);x.fillRect(t,t,t,t);
 return chk=g.createPattern(c,'repeat')}
function pathOf(g,p,sx,sy){g.beginPath();g.moveTo(p[0]*sx,p[1]*sy);if(p.length<4)g.lineTo(p[0]*sx+.01,p[1]*sy);for(let i=2;i<p.length;i+=2)g.lineTo(p[i]*sx,p[i+1]*sy)}
function render(){
 rq=0;const E=ED.E;if(!E||!$('#cm').classList.contains('on'))return;
 const g=cv.getContext('2d'),dw=cv.width,dh=cv.height;
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,dw,dh);g.fillStyle=pattern(g,dw);g.fillRect(0,0,dw,dh);
 if(ED.ghost){g.globalAlpha=.3;g.drawImage(E.orig,0,0,dw,dh);g.globalAlpha=1}
 const tg=tmp.getContext('2d');tg.globalCompositeOperation='source-over';tg.clearRect(0,0,dw,dh);
 tg.drawImage(E.orig,0,0,dw,dh);tg.globalCompositeOperation='destination-in';tg.drawImage(E.mask,0,0,dw,dh);tg.globalCompositeOperation='source-over';
 g.drawImage(tmp,0,0);
 const list=ED.marks?E.strokes.filter(k=>k.t==='fg'||k.t==='bg'):[];
 if(ED.cur&&(ED.cur.t==='fg'||ED.cur.t==='bg'))list.push(ED.cur);
 g.lineCap=g.lineJoin='round';
 for(const k of list){g.globalAlpha=.55;g.strokeStyle=k.t==='fg'?'#3cff9e':'#ff3d63';g.lineWidth=Math.max(2,2*k.r*dw);pathOf(g,k.p,dw,dh);g.stroke()}
 g.globalAlpha=1;
 if(ED.hover&&ED.tool!=='hand'){const R=ED.brush/2/cv.getBoundingClientRect().width*dw;g.beginPath();g.arc(ED.hover.x*dw,ED.hover.y*dh,R,0,7);g.lineWidth=3;g.strokeStyle='#000a';g.stroke();g.lineWidth=1.5;g.strokeStyle='#fff';g.stroke()}}
const req=()=>{if(!rq)rq=requestAnimationFrame(render)};

const pt=e=>{const r=cv.getBoundingClientRect();return{x:cl((e.clientX-r.left)/r.width,0,1),y:cl((e.clientY-r.top)/r.height,0,1),w:r.width}};
cv.addEventListener('pointerdown',e=>{
 if(ED.tool==='hand'||ED.ptr!==null||!ED.E)return;
 e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(x){}
 const q=pt(e),r=ED.brush/2/q.w;ED.ptr=e.pointerId;ED.hover=q;ED.cur={t:ED.tool,r,p:[q.x,q.y]};
 if(ED.tool==='er'||ED.tool==='rs'){const g=ED.E.mask.getContext('2d');seg1(g,ED.tool,r,q.x,q.y,q.x,q.y,ED.E.mask.width,ED.E.mask.height)}
 req()});
cv.addEventListener('pointermove',e=>{
 if(ED.tool==='hand')return;
 const q=pt(e);ED.hover=q;
 if(ED.ptr===e.pointerId&&ED.cur){const p=ED.cur.p,lx=p[p.length-2],ly=p[p.length-1];
  if(Math.hypot(q.x-lx,q.y-ly)>.0015){
   p.push(q.x,q.y);
   if(ED.tool==='er'||ED.tool==='rs'){const E=ED.E;seg1(E.mask.getContext('2d'),ED.tool,ED.cur.r,lx,ly,q.x,q.y,E.mask.width,E.mask.height)}}}
 req()});
async function endStroke(e){
 if(ED.ptr!==e.pointerId)return;
 const k=ED.cur,E=ED.E;ED.ptr=null;ED.cur=null;if(e.pointerType!=='mouse')ED.hover=null;
 if(!k||!E){req();return}
 E.strokes.push(k);
 if(k.t==='fg'||k.t==='bg')await reseg();else req()}
cv.addEventListener('pointerup',endStroke);cv.addEventListener('pointercancel',endStroke);
cv.addEventListener('pointerleave',e=>{if(ED.ptr===null){ED.hover=null;req()}});

async function reseg(){
 ED.busy=true;setHint();req();await nextFrame();
 try{rebuild(ED.E)}catch(x){toast('Gagal: '+x.message)}
 ED.busy=false;setHint();req()}
async function undo(){
 const E=ED.E,k=E.strokes.pop();if(!k)return toast('Belum ada yang bisa diurungkan');
 if(k.t==='fg'||k.t==='bg')await reseg();else{remask(E);req()}}

async function openCut(){
 const t=cur();if(!t.orig)return toast('Upload foto dulu');
 await busy('Menyiapkan editor…');
 try{const E=getEng(t);if(!E.seg)rebuild(E);ED.E=E;ED.n0=JSON.stringify(E.strokes).length+(E.ai?1:0);ED.cur=null;ED.ptr=null;ED.hover=null;ED.busy=false;
  ED.zoom=1;$('#czm').value=100;$('#czv').textContent='100%';$('#cbr').value=ED.brush;$('#cbv').textContent=ED.brush;
  $('#cm').classList.add('on');$('#cm').scrollTop=0;setTool(ED.tool);fit();$$('#cm input[type=range]').forEach(fill);render()}
 catch(x){toast('Gagal membuka editor: '+x.message)}
 await busy('')}
function closeCut(){$('#cm').classList.remove('on');ED.E=null}
$('#cok').onclick=()=>{const t=cur(),E=ED.E;if(!E)return closeCut();t.sk=copyStrokes(E);t.ai=E.ai;setCut(cutout(E));closeCut();toast('Hasil dipakai')};
$('#cx').onclick=async()=>{const E=ED.E;const changed=E&&JSON.stringify(E.strokes).length+(E.ai?1:0)!==ED.n0;
 if(changed&&!await ask('Buang perubahan?','Coretan yang belum diterapkan akan hilang.','Buang'))return;
 const t=cur();if(t.orig&&E){E.strokes=(t.sk||[]).map(s=>({t:s.t,r:s.r,p:s.p.slice()}));E.ai=t.ai&&t.ai.length===E.N?t.ai:null;E.seg=null}
 closeCut()};
$('#cun').onclick=undo;
$('#crs').onclick=async()=>{const E=ED.E;E.strokes=[];E.ai=null;await reseg()};
$('#cai').onclick=()=>aiCut(true);
$('#cbr').addEventListener('input',e=>{ED.brush=+e.target.value;$('#cbv').textContent=ED.brush});
$('#czm').addEventListener('input',e=>{ED.zoom=e.target.value/100;$('#czv').textContent=e.target.value+'%';fit();req()});
$('#cgh').onclick=e=>{ED.ghost=!ED.ghost;e.currentTarget.classList.toggle('on',ED.ghost);req()};
$('#cmk').onclick=e=>{ED.marks=!ED.marks;e.currentTarget.classList.toggle('on',ED.marks);req()};
addEventListener('resize',()=>{if(ED.E){fit();req()}});
addEventListener('keydown',e=>{if($('#cm').classList.contains('on')&&e.key==='Escape')$('#cx').click()});

/* ================= penyesuaian UI lama ================= */
(()=>{
 const bq=$('#bq'),ba=$('#ba');
 bq.innerHTML='<svg class="i"><use href="#i-cut"/></svg>BG otomatis';
 ba.innerHTML='<svg class="i"><use href="#i-ai"/></svg>BG AI';ba.classList.add('ghost');
 const b=document.createElement('button');b.className='btn';b.id='bm';
 b.innerHTML='<svg class="i"><use href="#i-mv"/></svg>Arahkan area yang dihapus';
 bq.parentElement.after(b);b.addEventListener('click',openCut);
 const tol=$('#tol');tol.previousElementSibling.style.display='none';tol.style.display='none';
 tol.nextElementSibling.textContent='Background dihapus otomatis saat upload. Kalau masih salah, ketuk "Arahkan area yang dihapus" lalu coret hijau di baju dan merah di background.'})();

document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('#bq,#ba,#dz,#d1,#sh');if(!b)return;
 e.stopImmediatePropagation();e.preventDefault();
 ({bq:()=>autoCut(),ba:()=>aiCut(false),dz:()=>runDl('zip'),d1:()=>runDl('one'),sh:()=>runDl('share')})[b.id]()},true);
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='f'){e.stopImmediatePropagation();const f=t.files[0];t.value='';if(f)loadPhoto(f)}
 else if(t.id==='tol')e.stopImmediatePropagation()},true);

/* ================= animasi unduh ================= */
document.body.insertAdjacentHTML('beforeend',`
<div id="dx" role="dialog" aria-live="polite"><canvas id="dxc"></canvas>
<div class="dxb">
 <div class="dxi"><div class="ring"></div><svg viewBox="0 0 52 52"><path d="M15 27l8 8 15-17"/></svg></div>
 <div class="dxt"><b id="dxh">Menyiapkan…</b><small id="dxs"></small></div>
 <div class="dxg" id="dxg">${Array.from({length:9},(_,i)=>`<div class="dc" data-i="${i}"><span class="dn">${i+1}</span><img alt=""><i class="dk"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></i></div>`).join('')}</div>
 <div class="dxp"><i id="dxf"></i></div>
 <div class="dxl"><span id="dxm">0%</span><span id="dxn"></span></div>
 <div class="dxa"><button class="btn ghost" id="dxx">Batal</button><button class="btn" id="dxd" style="display:none"></button></div>
</div></div>`);

let DX=null;
function confetti(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const c=$('#dxc'),g=c.getContext('2d'),dpr=Math.min(2,devicePixelRatio||1),Wd=innerWidth,Hd=innerHeight;
 c.width=Wd*dpr;c.height=Hd*dpr;
 const cols=[S.c2,'#FF8AC8','#E2BC6B','#ffffff',mix(S.c2,S.c3,.5)];
 const P=Array.from({length:120},()=>({x:Wd/2,y:Hd*.34,vx:(Math.random()-.5)*17,vy:-Math.random()*15-4,r:6+Math.random()*9,rot:Math.random()*6,vr:(Math.random()-.5)*.3,k:Math.random()*3|0,c:cols[Math.random()*cols.length|0]}));
 const t0=performance.now();
 const f=n=>{const el=n-t0;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,Wd,Hd);let alive=0;
  for(const p of P){p.vy+=.35;p.vx*=.992;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
   if(p.y<Hd+40){alive++;g.save();g.translate(p.x,p.y);g.rotate(p.rot);g.globalAlpha=Math.max(0,1-el/3400);
    if(p.k===0)heart(g,0,0,p.r*1.3,p.c);else if(p.k===1)spark(g,0,0,p.r,p.c);else{g.fillStyle=p.c;g.fillRect(-p.r/2,-p.r/4,p.r,p.r/2)}
    g.restore()}}
  if(alive&&el<3600)requestAnimationFrame(f);else g.clearRect(0,0,Wd,Hd)};
 requestAnimationFrame(f)}

function closeDx(){
 const D=DX;if(!D)return;cancelAnimationFrame(D.raf);DX=null;
 $('#dx').classList.remove('on');$('#dxc').getContext('2d').clearRect(0,0,9999,9999);
 setTimeout(()=>D.urls.forEach(u=>URL.revokeObjectURL(u)),1000)}
$('#dxx').onclick=()=>{if(!DX)return;if(DX.done)closeDx();else{DX.cancel=true;$('#dxs').textContent='Membatalkan…'}};
$('#dxd').onclick=()=>{if(DX&&DX.dl)DX.dl()};

async function runDl(mode){
 if(DX)return;
 const cells=[...document.querySelectorAll('#dxg .dc')],
  idx=mode==='one'?[S.sel]:[8,7,6,5,4,3,2,1,0],units=idx.length+(mode==='zip'?.8:0),
  D=DX={cancel:false,done:false,urls:[],p:0,target:0,raf:0,files:[],dl:null};
 cells.forEach((c,i)=>{c.className='dc'+(mode==='one'&&i!==S.sel?' skip':'');c.style.animation='';const im=c.querySelector('img');im.removeAttribute('src')});
 $('#dxg').classList.remove('pack');$('.dxi').classList.remove('ok');
 $('#dxh').textContent='Menyiapkan feed kamu';$('#dxs').textContent=mode==='one'?'Satu kotak, resolusi penuh':'Merender 9 kotak satu per satu';
 $('#dxn').textContent='';$('#dxx').textContent='Batal';$('#dxd').style.display='none';
 $('#dx').classList.add('on');
 const tick=()=>{D.p+=(D.target-D.p)*.1;if(Math.abs(D.target-D.p)<.002)D.p=D.target;
  $('#dxf').style.width=(D.p*100).toFixed(1)+'%';$('#dxm').textContent=Math.round(D.p*100)+'%';D.raf=requestAnimationFrame(tick)};
 tick();
 try{
  for(let n=0;n<idx.length;n++){
   if(D.cancel)break;
   const i=idx[n],c=cells[i];c.classList.add('act');
   $('#dxh').textContent='Merender kotak '+(i+1);
   $('#dxs').textContent=mode==='one'?'Mohon tunggu sebentar':'Urutan unggah #'+(9-i)+' dari 9';
   $('#dxn').textContent=(n+1)+' / '+idx.length;
   D.target=(n+.85)/units;await nextFrame();await sleep(60);
   const b=await tileBlob(i),url=URL.createObjectURL(b);D.urls.push(url);
   c.querySelector('img').src=url;c.classList.remove('act');c.classList.add('ok','flash');setTimeout(()=>c.classList.remove('flash'),700);
   D.files.push([i,b]);D.target=(n+1)/units;if(navigator.vibrate)navigator.vibrate(12);await sleep(240)}
  if(D.cancel){closeDx();return}
  if(mode==='zip'){
   $('#dxh').textContent='Mengemas ZIP';$('#dxs').textContent='Menyatukan 9 gambar jadi satu file';$('#dxg').classList.add('pack');
   D.target=(idx.length+.5)/units;await nextFrame();await sleep(500);
   const z=await zip(D.files.slice().sort((a,b)=>a[0]-b[0]).map(([i,b])=>[nm(i),b]));
   D.dl=()=>dl(z,'bbubiie-grid.zip');D.target=1;await sleep(550);D.dl()}
  else if(mode==='one'){D.dl=()=>dl(D.files[0][1],nm(idx[0]));D.target=1;await sleep(400);D.dl()}
  else{
   const files=D.files.map(([i,b])=>new File([b],nm(i),{type:b.type}));
   D.dl=async()=>{if(navigator.canShare&&navigator.canShare({files})){try{await navigator.share({files})}catch(e){}}else toast('Browser ini belum bisa membagikan file. Pakai tombol ZIP.')};
   D.target=1;await sleep(400)}
 }catch(x){toast('Gagal: '+x.message);closeDx();return}
 D.done=true;$('#dxg').classList.remove('pack');$('.dxi').classList.add('ok');
 $('#dxh').textContent=mode==='share'?'Siap dibagikan!':'Selesai!';
 $('#dxs').textContent=mode==='share'?'Ketuk tombol untuk memilih tujuan':(mode==='zip'?'ZIP tersimpan. Unggah dari kotak 9 ke kotak 1':'Gambar tersimpan');
 $('#dxn').textContent='Beres';$('#dxx').textContent='Tutup';
 const d=$('#dxd');d.textContent=mode==='share'?'Bagikan sekarang':'Unduh lagi';d.style.display='';
 cells.forEach((c,k)=>{if(c.classList.contains('ok'))c.style.animation='dwave .6s ease '+(k*55)+'ms'});
 confetti();if(navigator.vibrate)navigator.vibrate([20,40,30])}
})();

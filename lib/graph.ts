import { z } from 'zod';
const num = z.number().finite().min(-1000000).max(1000000);
const point = z.object({x:num,y:num});
const tick = z.object({value:num,label:z.string().max(80)});
export const graphSchema = z.object({
 title:z.string().max(120), xLabel:z.string().max(80), yLabel:z.string().max(80),
 xMin:num,xMax:num,yMin:num,yMax:num,
 xTicks:z.array(tick).max(30),yTicks:z.array(tick).max(30),
 curves:z.array(z.object({name:z.string().max(40),points:z.array(point).min(1).max(500),dashed:z.boolean(),smooth:z.boolean(),arrows:z.boolean(),dots:z.boolean()})).max(12),
 guides:z.array(z.object({x1:num,y1:num,x2:num,y2:num})).max(80),
 labels:z.array(z.object({x:num,y:num,text:z.string().max(120),dx:num,dy:num})).max(40),
 note:z.string().max(1000)
}).refine(g=>g.xMax>g.xMin&&g.yMax>g.yMin,{message:'축의 최댓값은 최솟값보다 커야 합니다.'});
export type Graph = z.infer<typeof graphSchema>;
export type Style = {lineWidth:number;fontSize:number;guides:boolean;arrows:boolean;transparent:boolean;width:number;height:number;font:'serif'|'sans'};
export const defaultStyle:Style={lineWidth:2.5,fontSize:23,guides:true,arrows:true,transparent:false,width:760,height:540,font:'serif'};
const curve=(name:string,pts:number[][],opts:Partial<Graph['curves'][number]>={}):Graph['curves'][number]=>({name,points:pts.map(([x,y])=>({x,y})),dashed:false,smooth:false,arrows:false,dots:false,...opts});
const ticks=(values:number[],labels?:string[])=>values.map((value,i)=>({value,label:labels?.[i]??String(value)}));
const guide=(x1:number,y1:number,x2:number,y2:number)=>({x1,y1,x2,y2});
const label=(x:number,y:number,text:string,dx=0,dy=-14)=>({x,y,text,dx,dy});
const base:Graph={title:'전류의 시간 변화',xLabel:'시간',yLabel:'I_1',xMin:0,xMax:5,yMin:0,yMax:4,xTicks:ticks([1,2,3,4],['t_0','2t_0','3t_0','4t_0']),yTicks:ticks([1,2,3],['I_0','2I_0','3I_0']),curves:[curve('전류',[[0,0],[2,3],[4,1]])],guides:[1,2,3].map(y=>guide(0,y,4,y)).concat([1,2,3,4].map(x=>guide(x,0,x,3))),labels:[],note:''};
const samples=(f:(x:number)=>number,a:number,b:number,n=100)=>Array.from({length:n+1},(_,i)=>[a+(b-a)*i/n,f(a+(b-a)*i/n)]);
// Sparse shape controls keep distribution edits broad; the renderer interpolates
// between them instead of moving one isolated sample in a dense polyline.
const distributionPoints=(xs:number[],peak:number,power:number,height=1)=>xs.map(x=>[x,height*Math.pow(x/peak,power)*Math.exp(power-power*x/peak)]);
export const presets:{id:string;subject:string;name:string;description:string;graph:Graph}[]=[
 {id:'current',subject:'물리학',name:'전류 · 시간',description:'시간에 따라 증가한 뒤 감소하는 전류',graph:base},
 {id:'pv',subject:'물리학',name:'기체의 순환 과정',description:'A → B → C → D → A의 P–V 그래프',graph:{...base,title:'기체의 순환 과정',xLabel:'V',yLabel:'P',xMax:3,yMax:2.7,xTicks:ticks([1,2],['V_0','2V_0']),yTicks:ticks([1,2],['P_0','2P_0']),curves:[curve('순환 과정',[[1,1],[1,2],[2,2],[2,1],[1,1]],{arrows:true,dots:true})],guides:[guide(0,1,2,1),guide(0,2,2,2),guide(1,0,1,1),guide(2,0,2,1)],labels:[label(1,1,'A',-22,26),label(1,2,'B',0,-20),label(2,2,'C',0,-20),label(2,1,'D',24,20)]}},
 {id:'wave',subject:'물리학',name:'두 매질의 파동',description:'경계 x = 6에서 파장이 달라지는 파동',graph:{...base,title:'두 매질에서의 파동',xLabel:'x (m)',yLabel:'변위',xMax:16,yMin:-1.5,yMax:1.7,xTicks:ticks([1,2,3,4,5,6,8,10,12,14]),yTicks:[],curves:[curve('파동',samples(x=>x<=6?-Math.cos(Math.PI*x/2):Math.cos(Math.PI*(x-6)/4),0,15.5,200))],guides:[guide(6,-1.3,6,1.4)],labels:[label(3,1.3,'매질 A'),label(10.5,1.3,'매질 B')]}},
 {id:'distance',subject:'물리학',name:'거리 · 시간',description:'두 물체 사이의 거리 변화',graph:{...base,title:'B와 C 사이의 거리',xLabel:'t (초)',yLabel:'거리\n(m)',xMax:8.5,yMax:17,xTicks:ticks([1,2,3,4,5,6,7]),yTicks:ticks([8,12,14]),curves:[curve('거리',[[0,12],[2,0],[4,8],[7.5,15]])],guides:[guide(0,8,4,8),guide(4,0,4,8),guide(0,14,7,14),guide(7,0,7,14)],labels:[]}},
 {id:'magnetic',subject:'물리학',name:'자기장 · 전류',description:'전류가 증가할수록 감소하는 자기장',graph:{...base,title:'자기장과 전류의 관계',xLabel:'I_P',yLabel:'B',xMax:2.1,yMax:3.7,xTicks:ticks([1,1.5],['I_0','1.5I_0']),yTicks:ticks([1],['B_1']),curves:[curve('자기장',[[0,3],[1.5,0]])],guides:[guide(0,1,1,1),guide(1,0,1,1)],labels:[]}},
 {id:'distribution',subject:'생명과학',name:'형질의 분포',description:'부리 크기에 따른 두 개체군의 분포',graph:{...base,title:'개체군의 형질 분포',xLabel:'부리 크기',yLabel:'개체 수',xMax:11,yMax:1.3,xTicks:[],yTicks:[],curves:[curve("P′",distributionPoints([0,.35,.7,1.1,1.5,2,2.7,3.5,4.6,6,8,10],2,3),{smooth:true}),curve('P',distributionPoints([0,.7,1.5,2.3,3.3,4.5,5.8,7.2,8.6,10],4.5,5,.6),{dashed:true,smooth:true})],guides:[],labels:[label(2.5,1,'P′',20,-5),label(6.3,.43,'P',12,-12)]}},
 {id:'chemistry',subject:'화학',name:'중화 반응의 온도',description:'혼합 용액의 최고 온도 비교',graph:{...base,title:'혼합 용액의 최고 온도',xLabel:'부피 (mL)',yLabel:'최고 온도\n(°C)',xMax:50,yMax:3.2,xTicks:ticks([20,30,40],['20\n40','30\n30','40\n20']),yTicks:ticks([1],['t_1']),curves:[curve('측정값',[[20,1]],{dots:true}),curve('측정값',[[30,2.7]],{dots:true}),curve('측정값',[[40,1]],{dots:true})],guides:[guide(0,1,45,1),...([20,30,40].map(x=>guide(x,0,x,3)))],labels:[label(7,0,'HCl\nNaOH',0,31),label(20,1,'(가)',24,-12),label(30,2.7,'(나)',24,-12),label(40,1,'(다)',24,-12)],note:'NaOH 부피는 HCl 부피와 합이 60 mL가 되도록 설정한 예시입니다.'}},
 {id:'spectrum',subject:'지구과학',name:'복사 에너지 분포',description:'연속 곡선과 흡수선이 있는 스펙트럼',graph:{...base,title:'파장에 따른 복사 에너지',xLabel:'파장',yLabel:'에너지의\n상대 세기',xMax:10.5,yMax:1.3,xTicks:[],yTicks:[],curves:[curve('ㄱ',samples(x=>Math.pow(x/1.5,2)*Math.exp(2-2*x/1.5),0,10,200)),curve('ㄴ',samples(x=>{const b=.65*Math.pow(x/1.6,2)*Math.exp(2-2*x/1.6);return b*(1-.65*Math.pow(Math.sin(x*9),18));},0,10,400))],guides:[],labels:[label(2.3,.85,'ㄱ',18,-15),label(2.4,.5,'ㄴ',18,-10)],note:'형태를 재현한 예시이며 실제 측정 스펙트럼은 아닙니다.'}}
];
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function rich(s:string){return s.split(/(_\{[^}]+\}|\^\{[^}]+\}|_[A-Za-z0-9]+|\^[A-Za-z0-9]+)/).map(t=>/^[_^]/.test(t)?`<tspan baseline-shift="${t[0]==='_'?'sub':'super'}" font-size="70%">${esc(t.slice(1).replace(/[{}]/g,''))}</tspan>`:esc(t).replace(/([A-Za-z]+)/g,word=>/^(m|s|kg|mol|mL|Pa|Hz|cm|HCl|NaOH)$/.test(word)?word:word.replace(/[A-Za-z]/g,'<tspan font-style="italic">$&</tspan>'))).join('');}
export function graphLayout(g:Graph,s:Style=defaultStyle){
 const w=s.width,h=s.height,L=Math.min(w*.34,Math.max(Math.min(112,w*.2),Math.max(...g.yLabel.split('\n').map(t=>t.replace(/\\[a-zA-Z]+/g,'').replace(/[_^{}]/g,'').length))*s.fontSize*.8+22)),R=w-Math.min(95,w*.14),T=Math.min(66,h*.14),B=h-Math.min(95,h*.2),dx=(R-L)/(g.xMax-g.xMin),dy=(B-T)/(g.yMax-g.yMin);
 const X=(x:number)=>L+(x-g.xMin)*dx,Y=(y:number)=>B-(y-g.yMin)*dy;
 const zx=Math.max(g.xMin,Math.min(0,g.xMax)),zy=Math.max(g.yMin,Math.min(0,g.yMax)),ox=X(zx),oy=Y(zy);
 return {w,h,L,R,T,B,dx,dy,X,Y,zx,zy,ox,oy,world:(x:number,y:number)=>({x:g.xMin+(x-L)/dx,y:g.yMin+(B-y)/dy})};
}
export function renderGraph(g:Graph,s:Style=defaultStyle,id='plot'){
 const {w,h,L,R,T,B,X,Y,zx,zy,ox,oy}=graphLayout(g,s);
 const n=(x:number)=>Math.round(x*100)/100;
 const text=(x:number,y:number,t:string,anchor='middle',size=s.fontSize,edit='')=>`<text ${edit?`data-edit="${edit}"`:''} data-label="${esc(t).replace(/\n/g,'&#10;')}" x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-size="${size}" fill="#151515">${t.split('\n').map((line,i)=>`<tspan x="${n(x)}" dy="${i?1.2:0}em">${rich(line)}</tspan>`).join('')}</text>`;
 const line=(x1:number,y1:number,x2:number,y2:number,extra='')=>`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${extra}/>`;
 const a=s.arrows?`marker-end="url(#${id}-arrow)"`:'';
 let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(g.title)}"><title>${esc(g.title)}</title><defs><marker id="${id}-arrow" viewBox="0 0 12 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L12 5 L0 10 L3 5Z" fill="#151515"/></marker><clipPath id="${id}-clip"><rect x="${L-12}" y="${T-12}" width="${R-L+24}" height="${B-T+24}"/></clipPath></defs>${s.transparent?'':`<rect width="${w}" height="${h}" fill="white"/>`}<g font-family="${s.font==='serif'?"'Times New Roman', 'Noto Serif KR', 'Batang', serif":"'Arial', 'Apple SD Gothic Neo', sans-serif"}" font-style="normal">`;
 if(s.guides)out+=`<g stroke="#666" stroke-width="${s.lineWidth*.6}" stroke-dasharray="5 4" clip-path="url(#${id}-clip)">${g.guides.map(p=>line(X(p.x1),Y(p.y1),X(p.x2),Y(p.y2))).join('')}</g>`;
 out+=`<g stroke="#151515" stroke-width="${s.lineWidth*.7}" fill="none">${line(L,oy,R+20,oy,a)}${line(ox,B,ox,T-22,a)}</g>`;
 out+=text(R+20,oy+43,g.xLabel,'end',s.fontSize,'axis:x')+text(ox-17,T-25,g.yLabel,'end',s.fontSize,'axis:y')+(g.xMin<=0&&g.xMax>=0&&g.yMin<=0&&g.yMax>=0?text(ox-15,oy+27,'0'):'');
 g.xTicks.forEach((t,i)=>{if(t.value<g.xMin||t.value>g.xMax||t.value===zx)return;out+=line(X(t.value),oy-4,X(t.value),oy+4,`stroke="#151515" stroke-width="1"`)+text(X(t.value),oy+31,t.label,'middle',s.fontSize,`tick:x:${i}`);});
 g.yTicks.forEach((t,i)=>{if(t.value<g.yMin||t.value>g.yMax||t.value===zy)return;out+=text(ox-12,Y(t.value)+s.fontSize*.33,t.label,'end',s.fontSize,`tick:y:${i}`);});
 for(const [ci,c] of g.curves.entries()){const pts=c.points.map(p=>[X(p.x),Y(p.y)]);let d=pts.length?`M${n(pts[0][0])},${n(pts[0][1])}`:'';
  for(let i=1;i<pts.length;i++){if(c.smooth&&pts.length>2){const p1=pts[i-1],p2=pts[i],h=p2[0]-p1[0];const slope=(j:number)=>(pts[j+1][1]-pts[j][1])/(pts[j+1][0]-pts[j][0]);const tangent=(j:number)=>{if(j===0)return slope(0);if(j===pts.length-1)return slope(j-1);const a=slope(j-1),b=slope(j);return a*b<=0?0:2*a*b/(a+b);};if(h>0&&pts.every((p,j)=>!j||p[0]>pts[j-1][0]))d+=` C${n(p1[0]+h/3)},${n(p1[1]+tangent(i-1)*h/3)} ${n(p2[0]-h/3)},${n(p2[1]-tangent(i)*h/3)} ${n(p2[0])},${n(p2[1])}`;else d+=` L${n(p2[0])},${n(p2[1])}`;}else d+=` L${n(pts[i][0])},${n(pts[i][1])}`;}
  out+=`<g clip-path="url(#${id}-clip)"><path data-edit="curve:${ci}" d="${d}" fill="none" stroke="#151515" stroke-width="${s.lineWidth}" stroke-linejoin="round" stroke-linecap="round" ${c.dashed?'stroke-dasharray="6 5"':''}/>`;
  if(c.dots)out+=pts.map(([x,y])=>`<circle cx="${n(x)}" cy="${n(y)}" r="${s.lineWidth*2}" fill="#151515"/>`).join('');
  if(c.arrows)for(let i=1;i<pts.length;i++){const [x,y]=pts[i-1],[xx,yy]=pts[i];out+=line(x+(xx-x)*.48,y+(yy-y)*.48,x+(xx-x)*.56,y+(yy-y)*.56,`stroke="#151515" stroke-width="${s.lineWidth}" marker-end="url(#${id}-arrow)"`);}
  out+='</g>';
 }
 out+=g.labels.map((l,i)=>(l.text==='0'&&l.x===0&&l.y===0&&g.xMin<=0&&g.xMax>=0&&g.yMin<=0&&g.yMax>=0)?'':text(X(l.x)+l.dx,Y(l.y)+l.dy,l.text,'middle',s.fontSize,`label:${i}`)).join('');return out+'</g></svg>';
}
export function parseCoordinates(input:string):{x:number;y:number}[]{
 const matches=[...input.matchAll(/\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g)];
 if(matches.length<2)throw Error('좌표를 두 개 이상 입력해 주세요. 예: (0,0), (2,3), (4,1)');
 if(matches.length>500)throw Error('좌표는 500개까지 입력할 수 있습니다.');
 const points=matches.map(m=>({x:Number(m[1]),y:Number(m[2])}));
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1000000||Math.abs(p.y)>1000000))throw Error('좌표는 -1,000,000부터 1,000,000까지 입력해 주세요.');
 return points;
}
export function fromCoordinates(input:string):Graph{
 const points=parseCoordinates(input),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.min(0,...xs),minY=Math.min(0,...ys),maxX=Math.max(0,...xs),maxY=Math.max(0,...ys),spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);
 const xt=[...new Set(xs)].sort((a,b)=>a-b).slice(0,20),yt=[...new Set(ys)].sort((a,b)=>a-b).slice(0,20);
 const xLabel=input.match(/(?:x축|가로축)\s*[:=은는]?\s*([^,;\n]+?)(?=\s*(?:y축|세로축|[.;\n]|$))/)?.[1]?.trim()||'x';
 const yLabel=input.match(/(?:y축|세로축)\s*[:=은는]?\s*([^,;\n.]+)/)?.[1]?.trim()||'y';
 return {...base,title:'좌표로 만든 그래프',xLabel,yLabel,xMin:minX,xMax:maxX+spanX*.2,yMin:minY,yMax:maxY+spanY*.2,xTicks:ticks(xt),yTicks:ticks(yt),curves:[curve('그래프',points.map(p=>[p.x,p.y]),{smooth:/곡선|부드럽/.test(input),dots:/점 표시/.test(input)})],guides:points.slice(0,40).flatMap(p=>[guide(zero(minX),p.y,p.x,p.y),guide(p.x,zero(minY),p.x,p.y)]),labels:[],note:'입력한 좌표를 연결했습니다. 추가 조건은 세부 편집에서 조절해 주세요.'};
}
const zero=(v:number)=>Math.max(v,0);

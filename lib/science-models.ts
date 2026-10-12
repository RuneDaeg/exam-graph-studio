import {z} from 'zod';
import type {Graph} from './graph';

const finite=z.number().finite();
const positive=finite.min(.001).max(10000);
const temperature=finite.min(50).max(3000);
const reactionSchema=z.object({kind:z.literal('reaction-energy'),reactant:finite.min(-10000).max(10000),product:finite.min(-10000).max(10000),activation:positive,catalyzedActivation:positive});
export const scienceModelSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('thermal-equilibrium'),temperature1:finite.min(-273.15).max(10000),temperature2:finite.min(-273.15).max(10000),capacity1:positive,capacity2:positive,timeConstant:positive}),
 reactionSchema,
 z.object({kind:z.literal('competitive-inhibition'),vmax:positive,km:positive,inhibition:finite.min(1).max(30)}),
 z.object({kind:z.literal('maxwell-energy'),temperature1:temperature,temperature2:temperature,threshold:finite.min(0).max(1000)}),
 z.object({kind:z.literal('maxwell-speed'),temperature1:temperature,temperature2:temperature,molarMass:finite.min(1).max(300),threshold:finite.min(0).max(20000)}),
 z.object({kind:z.literal('sine'),amplitude:positive,frequency:finite.min(.01).max(10),phase:finite.min(-360).max(360),offset:finite.min(-10000).max(10000),cycles:finite.int().min(1).max(5)}),
 z.object({kind:z.literal('rc'),voltage:positive,resistance:positive,capacitance:positive}),
 z.object({kind:z.literal('exponential-decay'),initial:positive,halfLife:positive,periods:finite.int().min(1).max(8)}),
 z.object({kind:z.literal('tangent-secant'),function:z.enum(['quadratic','sine','exponential']),at:finite.min(-4).max(4),other:finite.min(-4).max(4)}),
]).superRefine((model,ctx)=>{
 const issue=(path:string,message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,path:[path],message});
 if(model.kind==='reaction-energy'){
  if(model.catalyzedActivation<=Math.max(0,model.product-model.reactant))issue('catalyzedActivation','촉매 반응의 봉우리는 반응물과 생성물보다 높아야 합니다.');
  if(model.catalyzedActivation>=model.activation)issue('activation','촉매가 없을 때의 활성화 에너지가 더 커야 합니다.');
 }
 if(model.kind==='competitive-inhibition'&&model.km*model.inhibition*8>900000)issue('km','Km와 저해 계수의 곱을 줄여 주세요.');
 if(model.kind==='maxwell-energy'&&model.threshold>=16*GAS_CONSTANT_KJ*Math.max(model.temperature1,model.temperature2))issue('threshold','문턱 에너지는 표시 범위(높은 온도의 16RT)보다 작아야 합니다.');
 if(model.kind==='maxwell-speed'&&model.threshold>=6*Math.sqrt(GAS_CONSTANT*Math.max(model.temperature1,model.temperature2)/(model.molarMass/1000)))issue('threshold','문턱 속력은 표시 범위(높은 온도의 6√(RT/M))보다 작아야 합니다.');
 if(model.kind==='tangent-secant'&&Math.abs(model.at-model.other)<.001)issue('other','접점과 할선의 다른 점 사이를 0.001 이상 벌려 주세요.');
});
export type ScienceModel=z.infer<typeof scienceModelSchema>;
export type ScienceModelKind=ScienceModel['kind'];
type Curve=Graph['curves'][number];
type Point=Curve['points'][number];
type Field={key:string;label:string;min?:number;max?:number;step?:number};
type ModelInfo={title:string;formula:string;description:string;caution:string;fields:Field[]};
export const GAS_CONSTANT=8.31446261815324;
export const GAS_CONSTANT_KJ=GAS_CONSTANT/1000;

export const scienceModelDefaults:Record<ScienceModelKind,ScienceModel>={
 'thermal-equilibrium':{kind:'thermal-equilibrium',temperature1:80,temperature2:20,capacity1:1,capacity2:1,timeConstant:2},
 'reaction-energy':{kind:'reaction-energy',reactant:20,product:5,activation:55,catalyzedActivation:30},
 'competitive-inhibition':{kind:'competitive-inhibition',vmax:10,km:2,inhibition:3},
 'maxwell-energy':{kind:'maxwell-energy',temperature1:300,temperature2:600,threshold:10},
 'maxwell-speed':{kind:'maxwell-speed',temperature1:300,temperature2:600,molarMass:28,threshold:800},
 sine:{kind:'sine',amplitude:2,frequency:1,phase:0,offset:0,cycles:2},
 rc:{kind:'rc',voltage:5,resistance:10,capacitance:100},
 'exponential-decay':{kind:'exponential-decay',initial:100,halfLife:2,periods:4},
 'tangent-secant':{kind:'tangent-secant',function:'quadratic',at:1,other:3},
};
export const scienceModelInfo:Record<ScienceModelKind,ModelInfo>={
 'thermal-equilibrium':{title:'두 물체의 열평형',formula:String.raw`T_f=\frac{C_1T_{1,0}+C_2T_{2,0}}{C_1+C_2},\quad T_i=T_f+(T_{i,0}-T_f)e^{-t/\tau}`,description:'온도와 열용량을 바꾸면 두 곡선과 공통 평형 온도를 함께 계산합니다.',caution:'외부와 열교환이 없고 열용량과 열전달 계수가 일정한 두 물체의 모형입니다. 상변화는 포함하지 않습니다.',fields:[{key:'temperature1',label:'물체 1 처음 온도 (°C)',min:-273.15},{key:'temperature2',label:'물체 2 처음 온도 (°C)',min:-273.15},{key:'capacity1',label:'물체 1 열용량 C₁',min:.001},{key:'capacity2',label:'물체 2 열용량 C₂',min:.001},{key:'timeConstant',label:'시간 상수 τ (s)',min:.001}]},
 'reaction-energy':{title:'촉매와 활성화 에너지',formula:String.raw`E_{a}=E_{\mathrm{peak}}-E_{\mathrm{reactant}},\quad \Delta H=E_{\mathrm{product}}-E_{\mathrm{reactant}}`,description:'반응물·생성물 에너지를 공유하고, 촉매 유무에 따른 봉우리와 활성화 에너지를 연결합니다.',caution:'곡선 모양은 반응 경로를 설명하는 모식도입니다. 실제 반응의 전이 상태나 중간체 수를 예측한 곡선은 아닙니다.',fields:[{key:'reactant',label:'반응물 에너지'},{key:'product',label:'생성물 에너지'},{key:'activation',label:'촉매 없음 Eₐ',min:.001},{key:'catalyzedActivation',label:'촉매 있음 Eₐ',min:.001}]},
 'competitive-inhibition':{title:'효소의 경쟁적 저해',formula:String.raw`v=\frac{V_{\max}[S]}{\alpha K_m+[S]},\quad \alpha=1+\frac{[I]}{K_i}`,description:'최대 반응 속도는 같게 유지하며, 경쟁적 저해에 따른 겉보기 Km와 반최대 속도 보조선을 계산합니다.',caution:'미카엘리스·멘텐 조건의 가역적 경쟁적 저해 모형입니다. 모든 효소나 저해 작용에 적용되지는 않습니다.',fields:[{key:'vmax',label:'최대 속도 Vmax',min:.001},{key:'km',label:'저해 없음 Km',min:.001},{key:'inhibition',label:'저해 계수 α',min:1,max:30}]},
 'maxwell-energy':{title:'분자 운동 에너지 분포',formula:String.raw`f(E)=\frac{2\sqrt E}{\sqrt\pi(RT)^{3/2}}e^{-E/(RT)}`,description:'두 온도의 면적이 각각 1인 확률밀도입니다. 문턱 에너지 이상의 부분을 음영으로 표시합니다.',caution:'3차원 고전적 이상 기체의 병진 운동 에너지 분포입니다. E는 몰당 에너지(kJ/mol), R은 kJ/(mol·K) 단위입니다. 표시 범위 밖 꼬리는 생략합니다.',fields:[{key:'temperature1',label:'온도 T₁ (K)',min:50,max:3000},{key:'temperature2',label:'온도 T₂ (K)',min:50,max:3000},{key:'threshold',label:'문턱 에너지 (kJ/mol)',min:0}]},
 'maxwell-speed':{title:'분자 속력 분포',formula:String.raw`f(v)=\sqrt{\frac2\pi}\frac{v^2}{a^3}e^{-v^2/(2a^2)},\quad a=\sqrt{RT/M}`,description:'같은 기체의 두 온도를 비교합니다. 에너지 분포와 구분된 속력 확률밀도를 사용합니다.',caution:'3차원 고전적 이상 기체 모형입니다. 몰 질량은 내부 계산에서 kg/mol로 변환하며, 두 곡선의 전체 면적은 각각 1입니다.',fields:[{key:'temperature1',label:'온도 T₁ (K)',min:50,max:3000},{key:'temperature2',label:'온도 T₂ (K)',min:50,max:3000},{key:'molarMass',label:'몰 질량 (g/mol)',min:1,max:300},{key:'threshold',label:'문턱 속력 (m/s)',min:0}]},
 sine:{title:'진폭·주기·위상',formula:String.raw`y=b+A\sin(2\pi f t+\phi),\quad T=1/f`,description:'진폭·진동수·위상을 함께 반영하고 첫 번째 최댓값의 보조선을 계산합니다.',caution:'시간에 따른 단순 조화 운동 모형입니다. 공간의 파동 그래프가 필요하면 가로축과 단위를 별도로 바꿔 주세요.',fields:[{key:'amplitude',label:'진폭 A',min:.001},{key:'frequency',label:'진동수 f (Hz)',min:.01,max:10},{key:'phase',label:'위상 φ (°)',min:-360,max:360},{key:'offset',label:'평형 위치 b'},{key:'cycles',label:'표시할 주기 수',min:1,max:5,step:1}]},
 rc:{title:'RC 회로의 충전·방전',formula:String.raw`V_{\mathrm{ch}}=V_0(1-e^{-t/RC}),\quad V_{\mathrm{dis}}=V_0e^{-t/RC}`,description:'저항·전기 용량으로 시간 상수를 계산하며 충전·방전 곡선을 함께 바꿉니다.',caution:'이상적인 직류 전원·저항·축전기 모형입니다. 충전과 방전은 서로 다른 실험의 곡선을 비교한 것입니다.',fields:[{key:'voltage',label:'전압 V₀ (V)',min:.001},{key:'resistance',label:'저항 R (kΩ)',min:.001},{key:'capacitance',label:'전기 용량 C (μF)',min:.001}]},
 'exponential-decay':{title:'반감기와 지수 감소',formula:String.raw`N(t)=N_0\,2^{-t/t_{1/2}}`,description:'처음 양과 반감기로 감소 곡선과 매 반감기의 좌표·보조선을 계산합니다.',caution:'감소 확률이 일정한 집단의 기대값 모형입니다. 개별 원자의 붕괴 시각을 뜻하지 않습니다.',fields:[{key:'initial',label:'처음 양 N₀',min:.001},{key:'halfLife',label:'반감기 t½',min:.001},{key:'periods',label:'표시할 반감기 수',min:1,max:8,step:1}]},
 'tangent-secant':{title:'함수와 접선·할선',formula:String.raw`y_{\mathrm{tan}}=f(a)+f'(a)(x-a),\quad m_{\mathrm{sec}}=\frac{f(b)-f(a)}{b-a}`,description:'접점과 다른 점의 x 좌표를 바꾸면 접선·할선·점·보조선을 함께 계산합니다.',caution:'함수의 정확한 도함수로 접선을 계산합니다. 자유 편집에서 점을 따로 이동하면 이 관계를 유지할 수 없습니다.',fields:[{key:'at',label:'접점 a',min:-4,max:4},{key:'other',label:'할선의 다른 점 b',min:-4,max:4}]},
};

const format=(n:number)=>Number(n.toPrecision(4)).toString();
const ticks=(values:number[])=>[...new Set(values)].map(value=>({value,label:format(value)}));
const sample=(fn:(x:number)=>number,start:number,end:number,count=241,extra:number[]=[],squared=false):Point[]=>{
 const xs=Array.from({length:count},(_,i)=>start+(end-start)*(squared?(i/(count-1))**2:i/(count-1)));
 return [...new Set([...xs,...extra.filter(x=>x>=start&&x<=end)])].sort((a,b)=>a-b).map(x=>({x,y:fn(x)}));
};
const curve=(name:string,points:Point[],dashed=false):Curve=>({name,points,dashed,lineStyle:dashed?'dashed':'solid',smooth:points.length>2,arrows:false,dots:false});
const guide=(x1:number,y1:number,x2:number,y2:number)=>({x1,y1,x2,y2});
const label=(x:number,y:number,text:string,dx=0,dy=-14)=>({x,y,text,dx,dy});
const smoothStep=(x:number)=>x*x*(3-2*x);
export function maxwellEnergyDensity(energy:number,temperatureKelvin:number):number{
 if(energy<=0)return 0;
 const thermal=GAS_CONSTANT_KJ*temperatureKelvin;
 return 2/Math.sqrt(Math.PI)*Math.sqrt(energy/thermal)/thermal*Math.exp(-energy/thermal);
}
export function maxwellSpeedDensity(speed:number,temperatureKelvin:number,molarMassGram:number):number{
 if(speed<=0)return 0;
 const a=Math.sqrt(GAS_CONSTANT*temperatureKelvin/(molarMassGram/1000)),u=speed/a;
 return Math.sqrt(2/Math.PI)/a*u*u*Math.exp(-u*u/2);
}
export function scienceFunction(kind:'quadratic'|'sine'|'exponential',x:number):number{
 return kind==='quadratic'?x*x:kind==='sine'?Math.sin(x):Math.exp(x);
}
export function scienceDerivative(kind:'quadratic'|'sine'|'exponential',x:number):number{
 return kind==='quadratic'?2*x:kind==='sine'?Math.cos(x):Math.exp(x);
}

/** Parameters regenerate every dependent curve and guide as one graph edit. */
export function createScienceGraph(input:ScienceModel):Graph & {scienceModel:ScienceModel}{
 const model=scienceModelSchema.parse(input),info=scienceModelInfo[model.kind];
 const graph:Graph={title:info.title,xLabel:'x',yLabel:'y',xMin:0,xMax:1,yMin:0,yMax:1,xTicks:[],yTicks:[],curves:[],guides:[],labels:[],shadings:[],note:info.caution};
 if(model.kind==='thermal-equilibrium'){
  const {temperature1:t1,temperature2:t2,capacity1:c1,capacity2:c2,timeConstant:tau}=model;
  const final=(c1*t1+c2*t2)/(c1+c2),end=5*tau,span=Math.max(1,Math.abs(t1-t2));
  Object.assign(graph,{xLabel:'t (s)',yLabel:'온도 (°C)',xMax:end*1.05,yMin:Math.min(0,t1,t2)-span*.05,yMax:Math.max(t1,t2)+span*.15,xTicks:ticks([tau,3*tau,5*tau]),yTicks:ticks([t1,final,t2])});
  graph.curves=[curve('물체 1',sample(t=>final+(t1-final)*Math.exp(-t/tau),0,end)),curve('물체 2',sample(t=>final+(t2-final)*Math.exp(-t/tau),0,end),true)];
  graph.guides=[guide(0,final,end,final)];graph.labels=[label(end*.82,final,`T_f=${format(final)}`)];
 }
 if(model.kind==='reaction-energy'){
  const {reactant,product,activation,catalyzedActivation}=model;
  const profile=(ea:number)=>(x:number)=>x<=.5?reactant+ea*smoothStep(2*x):reactant+ea+(product-reactant-ea)*smoothStep(2*x-1);
  const high=reactant+activation,low=Math.min(0,reactant,product),span=high-low;
  Object.assign(graph,{xLabel:'반응 진행',yLabel:'에너지',xMax:1.12,yMin:low-span*.06,yMax:high+span*.2,yTicks:ticks([reactant,product])});
  graph.curves=[curve('촉매 없음',sample(profile(activation),0,1)),curve('촉매 있음',sample(profile(catalyzedActivation),0,1),true)];
  graph.guides=[guide(0,reactant,1,reactant),guide(0,product,1,product),guide(.5,reactant,.5,high),guide(.5,high,.78,high),guide(.5,reactant+catalyzedActivation,.26,reactant+catalyzedActivation)];
  graph.labels=[label(.76,high,`E_a=${format(activation)}`),label(.23,reactant+catalyzedActivation,`E'_a=${format(catalyzedActivation)}`),label(1,product,`\\Delta H=${format(product-reactant)}`,0,23)];
 }
 if(model.kind==='competitive-inhibition'){
  const {vmax,km,inhibition:alpha}=model,end=8*km*alpha;
  Object.assign(graph,{xLabel:'[S]',yLabel:'v',xMax:end*1.04,yMax:vmax*1.18,xTicks:[{value:km,label:'K_m'},{value:km*alpha,label:'\\alpha K_m'}],yTicks:[{value:vmax/2,label:'V_{\\max}/2'},{value:vmax,label:'V_{\\max}'}]});
  graph.curves=[curve('저해 없음',sample(s=>vmax*s/(km+s),0,end,241,[km])),curve('경쟁적 저해',sample(s=>vmax*s/(alpha*km+s),0,end,241,[alpha*km]),true)];
  graph.guides=[guide(0,vmax,end,vmax),guide(0,vmax/2,alpha*km,vmax/2),guide(km,0,km,vmax/2),guide(alpha*km,0,alpha*km,vmax/2)];
 }
 if(model.kind==='maxwell-energy'||model.kind==='maxwell-speed'){
  const energy=model.kind==='maxwell-energy',maxTemperature=Math.max(model.temperature1,model.temperature2);
  const end=energy?16*GAS_CONSTANT_KJ*maxTemperature:6*Math.sqrt(GAS_CONSTANT*maxTemperature/(model.molarMass/1000));
  const values=(temperature:number)=>(x:number)=>energy?maxwellEnergyDensity(x,temperature):maxwellSpeedDensity(x,temperature,model.molarMass);
  const peaks=[model.temperature1,model.temperature2].map(t=>energy?GAS_CONSTANT_KJ*t/2:Math.sqrt(2*GAS_CONSTANT*t/(model.molarMass/1000)));
  graph.curves=[model.temperature1,model.temperature2].map((t,i)=>curve(`T_${i+1}=${format(t)} K`,sample(values(t),0,end,361,[peaks[i],model.threshold],energy),i===1));
  const high=Math.max(...graph.curves.flatMap(c=>c.points.map(p=>p.y)));
  Object.assign(graph,{xLabel:energy?'E (kJ/mol)':'v (m/s)',yLabel:energy?'f(E)':'f(v)',xMax:end*1.04,yMax:high*1.22,xTicks:ticks([...peaks,model.threshold]),yTicks:ticks([high/2,high])});
  graph.guides=[guide(model.threshold,0,model.threshold,high*1.08)];
  graph.shadings=[0,1].map(index=>({curve:index,mode:'baseline',baseline:0,xStart:model.threshold,xEnd:end,pattern:index===0?'solid':'hatch',opacity:.15}));
  graph.labels=peaks.map((x,i)=>label(x,values(i===0?model.temperature1:model.temperature2)(x),`T_${i+1}`));
 }
 if(model.kind==='sine'){
  const {amplitude:a,frequency:f,phase,offset:b,cycles}=model,phi=phase*Math.PI/180,end=cycles/f;
  const extrema=Array.from({length:cycles*2+5},(_,i)=>(Math.PI/2+(i-2)*Math.PI-phi)/(2*Math.PI*f));
  const top=(Math.PI/2-phi)/(2*Math.PI*f),peak=((top%(1/f))+1/f)%(1/f);
  Object.assign(graph,{xLabel:'t (s)',yLabel:'변위',xMax:end*1.04,yMin:Math.min(0,b-a*1.3),yMax:Math.max(0,b+a*1.3),xTicks:ticks(Array.from({length:cycles*2},(_,i)=>(i+1)/2/f)),yTicks:ticks([b-a,b,b+a])});
  graph.curves=[curve('조화 운동',sample(t=>b+a*Math.sin(2*Math.PI*f*t+phi),0,end,361,extrema))];
  graph.guides=[guide(0,b,end,b),guide(peak,b,peak,b+a),guide(0,b+a,peak,b+a)];graph.labels=[label(peak,b+a,'b+A')];
 }
 if(model.kind==='rc'){
  const {voltage:v,resistance,capacitance}=model,tau=resistance*capacitance*.001,end=5*tau;
  Object.assign(graph,{xLabel:'t (s)',yLabel:'V_C (V)',xMax:end*1.05,yMax:v*1.2,xTicks:[{value:tau,label:'\\tau'},{value:3*tau,label:'3\\tau'},{value:5*tau,label:'5\\tau'}],yTicks:ticks([v/Math.E,v*(1-1/Math.E),v])});
  graph.curves=[curve('충전',sample(t=>v*(-Math.expm1(-t/tau)),0,end,241,[tau])),curve('방전',sample(t=>v*Math.exp(-t/tau),0,end,241,[tau]),true)];
  graph.guides=[guide(0,v,end,v),guide(tau,0,tau,v*(1-1/Math.E)),guide(0,v/Math.E,tau,v/Math.E),guide(0,v*(1-1/Math.E),tau,v*(1-1/Math.E))];graph.labels=[label(end*.78,v,`\\tau=${format(tau)}\\,\\mathrm{s}`)];
 }
 if(model.kind==='exponential-decay'){
  const {initial,halfLife,periods}=model,end=halfLife*periods,xs=Array.from({length:periods},(_,i)=>(i+1)*halfLife);
  Object.assign(graph,{xLabel:'시간',yLabel:'N',xMax:end*1.08,yMax:initial*1.16,xTicks:ticks(xs),yTicks:ticks([initial,initial/2,initial/4])});
  graph.curves=[curve('지수 감소',sample(t=>initial*2**(-t/halfLife),0,end,241,xs))];
  graph.guides=xs.flatMap(x=>{const y=initial*2**(-x/halfLife);return [guide(x,0,x,y),guide(0,y,x,y)];});graph.labels=[label(halfLife,initial/2,'t_{1/2}',0,-16)];
 }
 if(model.kind==='tangent-secant'){
  const {at,other,function:kind}=model,fn=(x:number)=>scienceFunction(kind,x),y=fn(at),otherY=fn(other),slope=scienceDerivative(kind,at);
  const left=Math.max(-5,at-1.2),right=Math.min(5,at+1.2);
  const dot=(name:string,x:number):Curve=>({...curve(name,[{x,y:fn(x)}]),dots:true});
  graph.curves=[curve('함수',sample(fn,-5,5,321,[at,other])),curve('접선',[{x:left,y:y+slope*(left-at)},{x:right,y:y+slope*(right-at)}]),curve('할선',[{x:at,y},{x:other,y:otherY}],true),dot('접점',at),dot('다른 점',other)];
  const ys=graph.curves.flatMap(c=>c.points.map(p=>p.y)),low=Math.min(0,...ys),high=Math.max(0,...ys),span=high-low;
  Object.assign(graph,{xLabel:'x',yLabel:'y',xMin:-5,xMax:5,yMin:low-span*.08,yMax:high+span*.12,xTicks:ticks([-4,-2,at,other,2,4].sort((a,b)=>a-b)),yTicks:ticks([y,otherY])});
  graph.guides=[guide(at,0,at,y),guide(0,y,at,y),guide(other,0,other,otherY)];graph.labels=[label(at,y,'A',-12,-16),label(other,otherY,'B',10,-16)];
 }
 const coordinates=[graph.xMin,graph.xMax,graph.yMin,graph.yMax,...graph.curves.flatMap(c=>c.points.flatMap(p=>[p.x,p.y]))];
 if(coordinates.some(value=>!Number.isFinite(value)||Math.abs(value)>1000000))throw Error('계산한 그래프가 좌표 범위를 벗어납니다. 매개변수를 줄여 주세요.');
 return {...graph,scienceModel:model};
}

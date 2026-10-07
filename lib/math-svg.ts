import katex from 'katex';
import {parse, type Font} from 'opentype.js';
const NS='http://www.w3.org/2000/svg';
const fonts=new Map<string,Promise<Font>>();
const labels=new Map<string,Promise<{content:string;width:number}>>();
const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const round=(n:number)=>Math.round(n*1000)/1000;
export function toTex(value:string){
 let text=value.trim().replace(/^\$+|\$+$/g,'').replace(/^\\\(|\\\)$/g,'');
 if(text.includes('\\'))return text;
 text=text.replace(/′/g,"'").replace(/°\s*C/g,'{}^{\\circ}\\mathrm{C}').replace(/°/g,'{}^{\\circ}');
 text=text.replace(/([가-힣ㄱ-ㅎㅏ-ㅣ]+(?:\s+[가-힣ㄱ-ㅎㅏ-ㅣ]+)*)/g,'\\text{$1}');
 text=text.replace(/\(([^()]*)\)/g,(_,units:string)=>'('+units.replace(/\b(m|s|A|V|K|N|J|W|C|Pa|Hz|kg|g|cm|mm|mL|L|mol)\b/g,'\\mathrm{$1}')+')');
 text=text.replace(/\b(HCl|NaOH)\b/g,'\\mathrm{$1}');
 return text;
}
function fontFile(style:CSSStyleDeclaration){
 const family=style.fontFamily.split(',')[0].trim().replace(/["']/g,'');
 if(!family.startsWith('KaTeX_'))return null;
 const bold=Number(style.fontWeight)>=600||style.fontWeight==='bold',italic=style.fontStyle==='italic';
 return `${family}-${bold?(italic?'BoldItalic':'Bold'):(italic?'Italic':'Regular')}.ttf`;
}
async function loadFont(file:string){
 let promise=fonts.get(file);if(!promise){promise=fetch(new URL('fonts/katex/'+file,document.baseURI)).then(r=>{if(!r.ok)throw Error('수식 글꼴을 불러오지 못했습니다.');return r.arrayBuffer();}).then(b=>parse(b));fonts.set(file,promise);}return promise;
}
function serializePath(font:Font,char:string,x:number,y:number,size:number){
 const path=font.getPath(char,x,y,size,{kerning:false});
 return path.commands.map(c=>{
  if(c.type==='Z')return 'Z';
  if(c.type==='M'||c.type==='L')return `${c.type}${round(c.x)} ${round(c.y)}`;
  if(c.type==='Q')return `Q${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`;
  return `C${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`;
 }).join('');
}
async function shapeLabel(tex:string,size:number){
 const key=tex+'|'+size;const cached=labels.get(key);if(cached)return cached;
 const promise=(async()=>{
  const host=document.createElement('span');host.setAttribute('aria-hidden','true');host.style.cssText=`position:fixed;left:-10000px;top:0;display:inline-block;visibility:hidden;white-space:nowrap;line-height:normal;font-variant-ligatures:none;font-size:${size}px;pointer-events:none;`;
  const math=document.createElement('span');
  katex.render(tex,math,{output:'html',throwOnError:true,trust:false,strict:'ignore',maxSize:5,maxExpand:100});
  const katexRoot=math.querySelector<HTMLElement>('.katex');if(katexRoot)katexRoot.style.fontSize=size+'px';
  const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;';host.appendChild(math);host.appendChild(marker);document.body.appendChild(host);
  try{
   const fontLoads=Array.from(math.querySelectorAll<HTMLElement>('span')).map(el=>{const s=getComputedStyle(el);return document.fonts.load(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`);});
   await Promise.all(fontLoads);await document.fonts.ready;
   const root=host.getBoundingClientRect(),baseline=marker.getBoundingClientRect().top;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('수식 조판을 시작하지 못했습니다.');
   const walker=document.createTreeWalker(math,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
   const fontNames=new Set(nodes.map(node=>fontFile(getComputedStyle(node.parentElement!))).filter((v):v is string=>!!v));await Promise.all([...fontNames].map(loadFont));
   let content='';
   for(const node of nodes){
    if(node.parentElement?.closest('svg'))continue;
    const s=getComputedStyle(node.parentElement!),fs=parseFloat(s.fontSize),file=fontFile(s);const font=file?await loadFont(file):null;
    ctx.font=`${s.fontStyle} ${s.fontWeight} ${fs}px ${s.fontFamily}`;
    let offset=0;for(const char of node.data){const start=offset;offset+=char.length;if(/\s|\u200b|\u200c|\u200d/.test(char))continue;
     const range=document.createRange();range.setStart(node,start);range.setEnd(node,offset);const rect=range.getBoundingClientRect();if(!rect.width&&!rect.height)continue;
     const localMarker=document.createElement('span');localMarker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;';node.parentNode!.insertBefore(localMarker,node.nextSibling);const localBaseline=localMarker.getBoundingClientRect().top;localMarker.remove();
     const x=rect.left-root.left,y=localBaseline-baseline;
     if(font&&font.hasChar(char)){content+=`<path d="${serializePath(font,char,x,y,fs)}"/>`;}
     else{content+=`<text x="${round(x)}" y="${round(y)}" font-size="${fs}" font-family="'AppleMyungjo', 'Batang', serif" font-style="normal">${xml(char)}</text>`;}
    }
   }
   // Fractions, overlines and vincula are CSS borders in KaTeX's layout.
   for(const el of Array.from(math.querySelectorAll<HTMLElement>('span'))){const s=getComputedStyle(el),r=el.getBoundingClientRect();for(const side of ['Top','Bottom','Left','Right'] as const){const width=parseFloat(s[`border${side}Width`]);if(!width||s[`border${side}Style`]==='none')continue;const horizontal=side==='Top'||side==='Bottom';const x=r.left-root.left+(side==='Right'?r.width-width:0),y=r.top-baseline+(side==='Bottom'?r.height-width:0);content+=`<rect x="${round(x)}" y="${round(y)}" width="${round(horizontal?r.width:width)}" height="${round(horizontal?width:r.height)}"/>`;}}
   // KaTeX uses nested SVG for stretchy radicals and wide accents.
   for(const el of Array.from(math.querySelectorAll<SVGSVGElement>('svg'))){if(el.parentElement?.closest('svg'))continue;const r=el.getBoundingClientRect();const clone=el.cloneNode(true) as SVGSVGElement;clone.setAttribute('x',String(round(r.left-root.left)));clone.setAttribute('y',String(round(r.top-baseline)));clone.setAttribute('width',String(round(r.width)));clone.setAttribute('height',String(round(r.height)));clone.removeAttribute('style');content+=new XMLSerializer().serializeToString(clone);}
   return {content,width:math.getBoundingClientRect().width};
  }finally{host.remove();}
 })();labels.set(key,promise);promise.catch(()=>labels.delete(key));if(labels.size>400)labels.delete(labels.keys().next().value!);return promise;
}
export async function typesetSvg(source:string):Promise<{svg:string;errors:string[]}>{
 const doc=new DOMParser().parseFromString(source,'image/svg+xml');const errors:string[]=[];
 await Promise.all(Array.from(doc.querySelectorAll<SVGTextElement>('text[data-label]')).map(async el=>{
  const raw=el.getAttribute('data-label')||'',x=Number(el.getAttribute('x')),y=Number(el.getAttribute('y')),size=Number(el.getAttribute('font-size')),anchor=el.getAttribute('text-anchor');
  const group=doc.createElementNS(NS,'g');group.setAttribute('fill','#151515');group.setAttribute('aria-label',raw);group.setAttribute('data-typeset','katex');
  try{for(const [index,line] of raw.split('\n').entries()){
    if(!/[A-Za-z0-9\\πθλμΩαβγδω°′_^]/.test(line)){const text=doc.createElementNS(NS,'text');text.setAttribute('x',String(x));text.setAttribute('y',String(y+index*size*1.2));text.setAttribute('font-size',String(size));text.setAttribute('text-anchor',anchor||'middle');text.textContent=line;group.appendChild(text);continue;}
    const shaped=await shapeLabel(toTex(line),size);const inner=doc.createElementNS(NS,'g');const offset=anchor==='end'?-shaped.width:anchor==='middle'?-shaped.width/2:0;inner.setAttribute('transform',`translate(${round(x+offset)} ${round(y+index*size*1.2)})`);inner.innerHTML=shaped.content;group.appendChild(inner);
   }el.replaceWith(group);
  }catch{errors.push(raw);el.setAttribute('fill','#ad3939');}
 }));
 doc.documentElement.setAttribute('data-typesetter','KaTeX');return {svg:new XMLSerializer().serializeToString(doc),errors};
}

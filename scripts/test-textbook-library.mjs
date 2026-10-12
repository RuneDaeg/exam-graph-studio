import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import katex from 'katex';
import { compileTestModules } from './test-module-loader.mjs';

await mkdir('outputs',{recursive:true});
const temp=await mkdtemp(path.join(process.cwd(),'outputs','textbook-test-'));
try{
 await compileTestModules(temp,['textbook-presets','graph','math-svg']);
 const mathPath=path.join(temp,'math-svg.mjs');
 await writeFile(mathPath,(await readFile(mathPath,'utf8')).replace("import { parse } from 'opentype.js';","import opentype from 'opentype.js'; const {parse}=opentype;"));
 const {textbookTemplates,filterTextbookTemplates,textbookBooks,textbookCourses}=await import(pathToFileURL(path.join(temp,'textbook-presets.mjs')));
 const {graphSchema,renderGraph,xAxisRange,yAxisRange}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {toTex}=await import(pathToFileURL(path.join(temp,'math-svg.mjs')));
 assert.equal(textbookTemplates.length,88);
 assert.equal(textbookBooks.length,19);
 assert.equal(textbookCourses.length,7);
 assert.equal(new Set(textbookTemplates.map(t=>t.id)).size,88);
 assert.deepEqual(textbookTemplates.map(t=>t.caseId),Array.from({length:88},(_,i)=>`G${String(i+1).padStart(3,'0')}`));
 let panels=0,labels=0;
 for(const template of textbookTemplates){
  assert.ok(template.source.pdfPage>0&&template.source.printedPage&&template.caution.length>25,template.id);
  assert.ok(template.graphs.length>0,template.id);
  assert.ok(!/\/Users\/|\.pdf\b|data:image|source_pdf|review_image|file:\/\//.test(JSON.stringify(template)),`${template.id}: no private source content`);
  for(const [index,graph] of template.graphs.entries()){
   const id=`${template.caseId}/${index}`;panels++;
   graphSchema.parse(graph);
   const svg=renderGraph(graph,undefined,`test-${id.replace('/','-')}`);
   assert.ok(!/NaN|Infinity/.test(svg),`${id}: finite SVG`);
   assert.match(graph.note,/원본 실측값을 추출한 자료가 아닙니다/);
   for(const curve of graph.curves){
    const xr=xAxisRange(graph,curve.xAxis),yr=yAxisRange(graph,curve.yAxis);
    for(const p of curve.points){assert.ok(p.x>=xr.min-1e-8&&p.x<=xr.max+1e-8,`${id}: x bounds`);assert.ok(p.y>=yr.min-1e-8&&p.y<=yr.max+1e-8,`${id}: y bounds ${p.y}`);}
    if(curve.plot==='scatter')assert.match(svg,/data-marker=/);
    if(curve.plot==='bar'||curve.plot==='histogram')assert.ok(svg.includes(`data-plot="${curve.plot}"`));
   }
   const texts=[graph.xLabel,graph.yLabel,...graph.xTicks.map(t=>t.label),...graph.yTicks.map(t=>t.label),...graph.labels.map(l=>l.text),...(graph.topXAxis?[graph.topXAxis.label,...graph.topXAxis.ticks.map(t=>t.label)]:[]),...(graph.rightYAxis?[graph.rightYAxis.label,...graph.rightYAxis.ticks.map(t=>t.label)]:[])];
   for(const text of texts){labels++;assert.ok(!/[\x00-\x09\x0b-\x1f]/.test(text),id);katex.renderToString(toTex(text),{throwOnError:true,strict:'ignore'});}
   const copy=structuredClone(graph);copy.title='edited';assert.notEqual(graph.title,copy.title,`${id}: editable independent copy`);
  }
 }
 const g=(id,panel=0)=>textbookTemplates.find(t=>t.caseId===id).graphs[panel];
 assert.ok(Math.abs(g('G022').curves[0].points.reduce((sum,p)=>sum+p.y,0)-1)<1e-12,'binomial frequencies sum to one');
 for(const panel of [0,1])g('G067',panel).curves[0].points.forEach((p,i)=>assert.ok(Math.abs(p.y+g('G067',panel).curves[1].points[i].y-8)<1e-10,'equilibrium amount conserved'));
 const perturbed=g('G068'),reactant=perturbed.curves[0].points,product=perturbed.curves[1].points;
 assert.equal(product[0].y/reactant[0].y,.5,'initial equilibrium ratio');
 assert.equal(product.at(-1).y/reactant.at(-1).y,.5,'same-temperature final equilibrium must retain K');
 reactant.forEach((p,i)=>{const b=product.find(q=>q.x===p.x);assert.ok(b);assert.ok(Math.abs(p.y+b.y-(i<2?6:9))<1e-10,'total concentration changes only at the addition');});
 const after=reactant.slice(2).map(p=>product.find(q=>q.x===p.x).y/p.y);
 after.forEach((ratio,i)=>{assert.ok(ratio<=.5);if(i)assert.ok(ratio>after[i-1],'reaction quotient approaches unchanged K after adding A');});
 for(const id of ['G013','G014'])assert.match(textbookTemplates.find(t=>t.caseId===id).caution,/v²exp\(−a·v²\)/,'speed distribution must have a squared speed in the exponent');
 g('G025').curves[0].points.forEach((p,i)=>assert.ok(Math.abs(p.y-g('G025').curves[1].points[i].y-g('G025').curves[2].points[i].y)<1e-10,'osmotic pressure relation'));
 g('G074').curves[0].points.forEach((p,i)=>assert.ok(Math.abs(p.y+2*g('G074').curves[1].points[i].y-120)<1e-10,'thermal energy balance'));
 g('G035',0).curves[0].points.forEach((p,i)=>assert.ok(Math.abs(g('G035',1).curves[0].points[i].y-p.y*p.y/8)<1e-10,'inductor energy proportional to squared current'));
 for(const id of ['G015','G026'])for(const curve of g(id).curves){assert.deepEqual(curve.points[0],{x:0,y:2});assert.ok(Math.abs(curve.points.at(-1).y-3)<1e-10,'catalyst does not alter endpoint energy');}
 assert.equal(g('G016').yScale,'log');assert.equal(g('G046').xReversed,true);assert.equal(g('G060').xScale,'log');assert.equal(g('G060').yScale,'log');assert.equal(g('G055').yReversed,true);assert.equal(g('G055').xAxisPosition,'top');
 assert.equal(g('G042').curves[1].xAxis,'top');assert.equal(g('G018').curves[1].yAxis,'right');
 assert.equal(g('G084',1).curves.length,0,'blank activity panel not represented as a measured zero curve');
 assert.match(textbookTemplates.find(t=>t.caseId==='G066').caution,/3차원 배치는 지원하지 않습니다/);
 assert.equal(filterTextbookTemplates('전체','전체','존재하지않는교과서').length,0);
 for(const course of textbookCourses)assert.ok(filterTextbookTemplates(course,'전체','').every(t=>t.course===course));
 for(const book of textbookBooks)assert.ok(filterTextbookTemplates('전체',book,'').every(t=>t.book===book));
 assert.equal(filterTextbookTemplates('전체','전체','G042').length,1);
 for(const file of ['lib/textbook-data.ts','lib/textbook-presets.ts','components/textbook-library.tsx'])assert.ok(!/\/Users\/|source_pdf|review_image|data:image/.test(await readFile(file,'utf8')),`${file}: private source exclusion`);
 console.log(`PASS: 88 cases, 19 books, ${panels} editable panels; schema, bounds, SVG, ${labels} LaTeX labels, source privacy, filters and scientific invariants.`);
}finally{await rm(temp,{recursive:true,force:true});}

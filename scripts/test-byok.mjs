import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
await mkdir(path.join(root,'outputs'),{recursive:true});
const temp=await mkdtemp(path.join(root,'outputs','byok-test-'));
const originalFetch=globalThis.fetch;
try{
 for(const name of ['graph','openai-graph']){
  const source=(await readFile(path.join(root,'lib',name+'.ts'),'utf8')).replace("from './graph'","from './graph.mjs'");
  await writeFile(path.join(temp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const {generateOpenAIGraph}=await import(pathToFileURL(path.join(temp,'openai-graph.mjs')));
 const {presets}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const legacyFixture=presets[0].graph;
 const lineStyles=['solid','dashed','dotted','dash-dot','dash-dot-dot'];
 const fixture={...legacyFixture,equalAxes:false,curves:lineStyles.map((lineStyle,i)=>({...legacyFixture.curves[0],name:`선 ${i+1}`,lineStyle,distribution:null,conic:null,dashed:lineStyle!=='solid'})),shadings:[{curve:0,mode:'baseline',otherCurve:0,baseline:0,xStart:1,xEnd:3,pattern:'hatch',opacity:.2}]};
 let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'error');
  assert.equal(options.referrerPolicy,'no-referrer');
  assert.equal(options.cache,'no-store');
  assert.equal(options.headers.Authorization,'Bearer TEST_ONLY_NOT_A_KEY');
  assert.ok(!options.body.includes('TEST_ONLY_NOT_A_KEY'));
  const body=JSON.parse(options.body);
  assert.equal(body.store,false);
  assert.equal(body.text.format.strict,true);
  const schema=body.text.format.schema;
  assert.ok(schema.required.includes('rightYAxis'));
  const [rightAxis,noRightAxis]=schema.properties.rightYAxis.anyOf;
  assert.deepEqual(noRightAxis,{type:'null'});
  assert.deepEqual(rightAxis.required,['label','min','max','ticks']);
  assert.equal(rightAxis.additionalProperties,false);
  for(const element of ['curves','guides','labels','shadings']){
   assert.ok(schema.properties[element].items.required.includes('yAxis'));
   assert.deepEqual(schema.properties[element].items.properties.yAxis.enum,['left','right']);
  }
  assert.ok(body.instructions.includes('do not manually normalize them into left-axis coordinates'));
  const curve=schema.properties.curves.items;
  assert.equal(curve.additionalProperties,false);
  assert.deepEqual(curve.required,Object.keys(curve.properties));
  assert.ok(curve.required.includes('lineStyle'));
  assert.deepEqual(curve.properties.lineStyle,{type:'string',enum:lineStyles});
  assert.ok(curve.required.includes('distribution'));
  const [gamma,normal,ordinary]=curve.properties.distribution.anyOf;
  assert.deepEqual(ordinary,{type:'null'});
  assert.equal(gamma.additionalProperties,false);
  assert.deepEqual(gamma.required,['kind','origin','peak','height','power','baseline','end']);
  assert.deepEqual(gamma.properties.kind,{type:'string',enum:['gamma']});
  assert.deepEqual(gamma.properties.power,{type:'number',minimum:2,maximum:80});
  assert.equal(normal.additionalProperties,false);
  assert.deepEqual(normal.required,['kind','origin','peak','sigma','height','baseline','end']);
  assert.deepEqual(normal.properties.kind,{type:'string',enum:['normal']});
  assert.deepEqual(normal.properties.sigma,{type:'number'});
  assert.ok(body.instructions.includes('For a normal distribution (정규분포, Gaussian)'));
  assert.ok(body.instructions.includes('height=0.3989422804014327'));
  assert.ok(body.instructions.includes('exact peak (peak,baseline+height)'));
  assert.ok(curve.required.includes('conic'));
  const [conic,noConic]=curve.properties.conic.anyOf;
  assert.deepEqual(noConic,{type:'null'});
  assert.equal(conic.additionalProperties,false);
  assert.deepEqual(conic.required,['kind','cx','cy','rx','ry']);
  assert.deepEqual(conic.properties.kind,{type:'string',enum:['circle','ellipse']});
  assert.ok(schema.required.includes('equalAxes'));
  assert.deepEqual(schema.properties.equalAxes,{type:'boolean'});
  assert.ok(body.instructions.includes('conic:{kind:"circle",cx:0,cy:0,rx:2,ry:2}'));
  assert.ok(body.instructions.includes('parametric paths'));
  assert.ok(!body.instructions.includes('smooth is true only for sparse'));
  assert.ok(schema.required.includes('shadings'));
  assert.equal(schema.properties.shadings.maxItems,20);
  const shading=schema.properties.shadings.items;
  assert.equal(shading.additionalProperties,false);
  assert.deepEqual(shading.required,Object.keys(shading.properties));
  assert.deepEqual(shading.properties.mode.enum,['baseline','between','closed','rectangle']);
  assert.deepEqual(shading.properties.yStart,{type:'number'});
  assert.deepEqual(shading.properties.yEnd,{type:'number'});
  assert.ok(shading.required.includes('yStart')&&shading.required.includes('yEnd'));
  assert.deepEqual(shading.properties.pattern.enum,['solid','hatch']);
  assert.deepEqual(shading.properties.opacity,{type:'number',minimum:.05,maximum:.6});
  assert.equal(body.input[0].content[1].type,'input_text');
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current.curves,fixture.curves);
  assert.deepEqual(current.shadings,fixture.shadings);
  assert.equal(current.equalAxes,false);
  assert.equal(body.input[0].content[2].type,'input_image');
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});
 };
 const input={prompt:'그래프',current:fixture,image:'data:image/png;base64,AAAA'};
 assert.deepEqual(await generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),fixture);
 await assert.rejects(()=>generateOpenAIGraph({prompt:''},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/설명/);
 assert.equal(calls,1);
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current.curves,legacyFixture.curves);
  assert.ok(current.curves.every(curve=>!Object.hasOwn(curve,'lineStyle')));
  assert.ok(current.curves.every(curve=>!Object.hasOwn(curve,'distribution')));
  assert.ok(current.curves.every(curve=>!Object.hasOwn(curve,'conic')));
  assert.ok(!Object.hasOwn(current,'equalAxes'));
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(legacyFixture)}]}]});
 };
 assert.deepEqual(await generateOpenAIGraph({prompt:'그래프',current:legacyFixture},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),legacyFixture);
 // Separate y units survive an AI response and a subsequent refinement.
 const dualFixture={...legacyFixture,equalAxes:false,rightYAxis:{label:'상대 습도 (%)',min:20,max:100,ticks:[{value:40,label:'40'},{value:80,label:'80'}]},
  curves:[legacyFixture.curves[0],{...legacyFixture.curves[0],name:'상대 습도',yAxis:'right',points:[{x:0,y:40},{x:2,y:80},{x:4,y:60}]}],
  guides:[{x1:2,y1:80,x2:legacyFixture.xMax,y2:80,yAxis:'right'}],labels:[{x:2,y:80,text:'H',dx:0,dy:-20,yAxis:'right'}],
  shadings:[{curve:0,otherCurve:0,baseline:0,mode:'rectangle',xStart:1,xEnd:3,yStart:40,yEnd:60,yAxis:'right',pattern:'hatch',opacity:.15}]};
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(dualFixture)}]}]});
 const dualResult=await generateOpenAIGraph({prompt:'기온과 상대 습도를 왼쪽 오른쪽 축으로 그려 줘'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal);
 assert.deepEqual(dualResult,dualFixture);
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current,dualFixture);
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(current)}]}]});
 };
 assert.deepEqual(await generateOpenAIGraph({prompt:'두 축의 범위와 곡선을 유지해 줘',current:dualFixture},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),dualFixture);
 for(const invalid of [
  {...dualFixture,rightYAxis:null},
  {...dualFixture,rightYAxis:{...dualFixture.rightYAxis,min:100}},
  {...dualFixture,equalAxes:true},
  {...dualFixture,shadings:[{...dualFixture.shadings[0],mode:'between',curve:0,otherCurve:1}]},
 ]){
  globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(invalid)}]}]});
  await assert.rejects(()=>generateOpenAIGraph({prompt:'이중 축 그래프'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 }
 const gamma={kind:'gamma',origin:1,peak:3,height:2,power:4,baseline:.5,end:9};
 const gammaCurve={...fixture.curves[0],distribution:gamma,smooth:false,dots:false,arrows:false,points:[{x:1,y:.5},{x:3,y:2.5},{x:9,y:.5}]};
 const gammaFixture={...legacyFixture,xMax:10,yMax:3,curves:[gammaCurve]};
 let normalizedCurrent;
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  normalizedCurrent=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(normalizedCurrent.curves[0].distribution,gamma);
  assert.ok(normalizedCurrent.curves[0].points.length>3);
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(gammaFixture)}]}]});
 };
 const gammaResult=await generateOpenAIGraph({prompt:'분포 모양을 유지해 줘',current:gammaFixture},'TEST_ONLY_NOT_A_KEY',new AbortController().signal);
 assert.deepEqual(gammaResult,normalizedCurrent);
 assert.deepEqual(gammaResult.curves[0].distribution,gamma);
 const samples=gammaResult.curves[0].points;
 assert.ok(samples.length>3&&samples.length<=500);
 assert.equal(samples[0].x,gamma.origin);
 assert.equal(samples.at(-1).x,gamma.end);
 for(const [index,point] of samples.entries()){
  const z=(point.x-gamma.origin)/(gamma.peak-gamma.origin);
  const expected=gamma.baseline+(z>0?gamma.height*Math.exp(gamma.power*(Math.log(z)+1-z)):0);
  assert.ok(Math.abs(point.y-expected)<1e-8);
  if(index)assert.ok(point.x>samples[index-1].x);
 }
 assert.notDeepEqual(samples,gammaCurve.points);
 for(const invalid of [{kind:'normal'},{origin:3},{peak:9},{height:0},{power:1},{power:81},{baseline:999999,height:2}]){
  const value={...gammaFixture,curves:[{...gammaCurve,distribution:{...gamma,...invalid}}]};
  globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  await assert.rejects(()=>generateOpenAIGraph({prompt:'감마 모양 분포'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 }
 // AI metadata, rather than its sparse points, defines an exact symmetric
 // Gaussian. Peak-aligned guides and labels survive normalization/refinement.
 const normal={kind:'normal',origin:-4,peak:0,sigma:1,height:1/Math.sqrt(2*Math.PI),baseline:0,end:4};
 const normalCurve={...fixture.curves[0],distribution:normal,smooth:false,dots:false,arrows:false,points:[{x:-4,y:0},{x:0,y:.4},{x:4,y:0}]};
 const normalShade={curve:0,mode:'baseline',otherCurve:0,baseline:0,xStart:-1,xEnd:1,pattern:'solid',opacity:.15};
 const normalFixture={...legacyFixture,equalAxes:false,xMin:-5,xMax:5,yMin:0,yMax:.5,curves:[normalCurve],guides:[{x1:-1,y1:0,x2:-1,y2:normal.height*Math.exp(-.5)},{x1:1,y1:0,x2:1,y2:normal.height*Math.exp(-.5)}],labels:[],shadings:[normalShade]};
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(normalFixture)}]}]});
 const normalResult=await generateOpenAIGraph({prompt:'표준정규분포를 그리고 -1부터 1까지 음영을 넣어 줘'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal);
 assert.deepEqual(normalResult.curves[0].distribution,normal);
 assert.equal(normalResult.curves[0].smooth,true);
 assert.deepEqual(normalResult.shadings,[normalShade]);
 assert.deepEqual(normalResult.guides,normalFixture.guides);
 const normalSamples=normalResult.curves[0].points;
 assert.ok(normalSamples.length>3&&normalSamples.length<=500);
 assert.notDeepEqual(normalSamples,normalCurve.points);
 assert.equal(normalSamples[0].x,normal.origin);
 assert.equal(normalSamples.at(-1).x,normal.end);
 assert.ok(normalSamples[0].y>0); // Gaussian tails must not be forced to zero.
 assert.ok(normalSamples.some(point=>point.x===normal.peak&&point.y===normal.height));
 for(const [index,point] of normalSamples.entries()){
  assert.ok(Math.abs(point.y-normal.height*Math.exp(-.5*((point.x-normal.peak)/normal.sigma)**2))<1e-10);
  if(index)assert.ok(point.x>normalSamples[index-1].x);
 }
 const shiftedNormal={kind:'normal',origin:-3,peak:2,sigma:1.25,height:8,baseline:1,end:7};
 const shiftedGuides=[{x1:2,y1:0,x2:2,y2:9},{x1:0,y1:9,x2:2,y2:9}];
 const shiftedLabels=[{x:2,y:9,text:'F_{\\max}',dx:0,dy:-20}];
 const shiftedFixture={...normalFixture,xMin:-4,xMax:8,yMax:11,curves:[{...normalCurve,distribution:shiftedNormal}],guides:shiftedGuides,labels:shiftedLabels,shadings:[]};
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current.curves[0].distribution,shiftedNormal);
  assert.deepEqual(current.guides,shiftedGuides);
  assert.deepEqual(current.labels,shiftedLabels);
  assert.ok(current.curves[0].points.length>3);
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(current)}]}]});
 };
 const shiftedResult=await generateOpenAIGraph({prompt:'정규분포와 봉우리 보조선을 유지해 줘',current:shiftedFixture},'TEST_ONLY_NOT_A_KEY',new AbortController().signal);
 assert.deepEqual(shiftedResult.curves[0].distribution,shiftedNormal);
 assert.deepEqual(shiftedResult.guides,shiftedGuides);
 assert.deepEqual(shiftedResult.labels,shiftedLabels);
 for(const invalid of [{kind:'lognormal'},{sigma:0},{sigma:-1},{sigma:1000001},{sigma:undefined},{origin:0},{end:0},{height:0},{baseline:999999,height:2}]){
  const value={...normalFixture,curves:[{...normalCurve,distribution:{...normal,...invalid}}]};
  globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  await assert.rejects(()=>generateOpenAIGraph({prompt:'정규분포'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 }
 // Formula metadata from an AI response must generate a true closed circle;
 // retaining a few inaccurate AI-supplied points would reproduce the original bug.
 const circle={kind:'circle',cx:0,cy:0,rx:2,ry:2};
 const conicCurve={...fixture.curves[0],conic:circle,distribution:null,smooth:false,dots:false,arrows:false,points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]};
 const circleShade={curve:0,otherCurve:0,baseline:0,mode:'closed',xStart:-2,xEnd:2,yStart:0,yEnd:0,pattern:'solid',opacity:.15};
 const circleFixture={...legacyFixture,equalAxes:true,xMin:-2.5,xMax:2.5,yMin:-2.5,yMax:2.5,curves:[conicCurve],shadings:[circleShade]};
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(circleFixture)}]}]});
 const circleResult=await generateOpenAIGraph({prompt:'x^2+y^2=4 원과 내부 15% 음영'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal);
 assert.equal(circleResult.equalAxes,true);
 assert.deepEqual(circleResult.curves[0].conic,circle);
 assert.deepEqual(circleResult.shadings,[circleShade]);
 assert.equal(circleResult.curves[0].smooth,true);
 const circlePoints=circleResult.curves[0].points;
 assert.ok(circlePoints.length>=5&&circlePoints.length<=500);
 assert.deepEqual(circlePoints[0],circlePoints.at(-1));
 assert.notDeepEqual(circlePoints,conicCurve.points);
 for(const point of circlePoints)assert.ok(Math.abs(Math.hypot(point.x,point.y)-2)<1e-10);
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current,circleResult);
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(current)}]}]});
 };
 assert.deepEqual(await generateOpenAIGraph({prompt:'원의 모양과 음영을 유지해 줘',current:circleResult},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),circleResult);
 const ellipse={kind:'ellipse',cx:1,cy:-1,rx:3,ry:1};
 const ellipseFixture={...circleFixture,xMin:-3,xMax:5,yMin:-3,yMax:2,curves:[{...conicCurve,conic:ellipse}],shadings:[]};
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(ellipseFixture)}]}]});
 const ellipseResult=await generateOpenAIGraph({prompt:'중심 (1,-1), 반지름 3,1인 타원'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal);
 assert.equal(ellipseResult.equalAxes,true);
 assert.deepEqual(ellipseResult.curves[0].conic,ellipse);
 for(const point of ellipseResult.curves[0].points)assert.ok(Math.abs(((point.x-ellipse.cx)/ellipse.rx)**2+((point.y-ellipse.cy)/ellipse.ry)**2-1)<1e-10);
 for(const invalid of [{kind:'parabola'},{rx:0},{ry:-1},{ry:3},{cx:999999},{cy:-999999},{rx:1000001,ry:1000001}]){
  const value={...circleFixture,curves:[{...conicCurve,conic:{...circle,...invalid}}]};
  globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  await assert.rejects(()=>generateOpenAIGraph({prompt:'원'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 }
 for(const value of [
  {...circleFixture,equalAxes:'true'},
  {...circleFixture,curves:[{...conicCurve,distribution:gamma}]},
 ]){
  globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  await assert.rejects(()=>generateOpenAIGraph({prompt:'원'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 }
 const rectangleFixture={...legacyFixture,curves:[],shadings:[{curve:0,otherCurve:0,baseline:0,mode:'rectangle',xStart:.5,xEnd:1.5,yStart:.25,yEnd:1.75,pattern:'solid',opacity:.3}]};
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current.curves,[]);
  assert.deepEqual(current.shadings,rectangleFixture.shadings);
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(rectangleFixture)}]}]});
 };
 assert.deepEqual(await generateOpenAIGraph({prompt:'사각형 음영을 유지해 줘',current:rectangleFixture},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),rectangleFixture);
 for(const bounds of [{yStart:2,yEnd:1},{yStart:undefined},{xStart:2,xEnd:1}]){
  const invalidRectangle={...rectangleFixture,shadings:[{...rectangleFixture.shadings[0],...bounds}]};
  globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(invalidRectangle)}]}]});
  await assert.rejects(()=>generateOpenAIGraph({prompt:'사각형 음영'},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 }
 globalThis.fetch=async()=>Response.json({error:{code:'invalid_api_key'}},{status:401});
 await assert.rejects(()=>generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/API 키/);
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:'{"unexpected":true}'}]}]});
 await assert.rejects(()=>generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({...fixture,curves:[{...fixture.curves[0],lineStyle:'unsupported'}]})}]}]});
 await assert.rejects(()=>generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 console.log('PASS: independent dual-axis response/refinement, missing-axis/range/scaling/shading validation, BYOK request isolation, input validation, image/refine shading and five line styles, strict schemas, circle/ellipse metadata and canonical closed samples, equal-axis refinement, conic bounds and family exclusion, gamma/normal metadata and canonical samples, Gaussian shading and peak-guide refinement, independent rectangle bounds and validation, legacy graph request/response, 401 handling, graph validation');
}finally{globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true});}

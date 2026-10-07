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
 const fixture={...legacyFixture,shadings:[{curve:0,mode:'baseline',otherCurve:0,baseline:0,xStart:1,xEnd:3,pattern:'hatch',opacity:.2}]};
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
  assert.ok(schema.required.includes('shadings'));
  assert.equal(schema.properties.shadings.maxItems,20);
  const shading=schema.properties.shadings.items;
  assert.equal(shading.additionalProperties,false);
  assert.deepEqual(shading.required,Object.keys(shading.properties));
  assert.deepEqual(shading.properties.mode.enum,['baseline','between','closed']);
  assert.deepEqual(shading.properties.pattern.enum,['solid','hatch']);
  assert.deepEqual(shading.properties.opacity,{type:'number',minimum:.05,maximum:.6});
  assert.equal(body.input[0].content[1].type,'input_text');
  const current=JSON.parse(body.input[0].content[1].text.replace(/^Current graph data: /,''));
  assert.deepEqual(current.shadings,fixture.shadings);
  assert.equal(body.input[0].content[2].type,'input_image');
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});
 };
 const input={prompt:'그래프',current:fixture,image:'data:image/png;base64,AAAA'};
 assert.deepEqual(await generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),fixture);
 await assert.rejects(()=>generateOpenAIGraph({prompt:''},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/설명/);
 assert.equal(calls,1);
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(legacyFixture)}]}]});
 assert.deepEqual(await generateOpenAIGraph({prompt:'그래프',current:legacyFixture},'TEST_ONLY_NOT_A_KEY',new AbortController().signal),legacyFixture);
 globalThis.fetch=async()=>Response.json({error:{code:'invalid_api_key'}},{status:401});
 await assert.rejects(()=>generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/API 키/);
 globalThis.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:'{"unexpected":true}'}]}]});
 await assert.rejects(()=>generateOpenAIGraph(input,'TEST_ONLY_NOT_A_KEY',new AbortController().signal),/구조/);
 console.log('PASS: BYOK request isolation, input validation, image/refine shading payload, strict shading schema, legacy graph response, 401 handling, graph validation');
}finally{globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true});}

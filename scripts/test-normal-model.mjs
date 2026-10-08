import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
await mkdir(path.join(root,'outputs'),{recursive:true});
const temp=await mkdtemp(path.join(root,'outputs','normal-model-test-'));
try{
 const source=await readFile(path.join(root,'lib/graph.ts'),'utf8');
 await writeFile(path.join(temp,'graph.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 const {presets,graphSchema,distributionValue,withDistribution,freeDistribution,distributionPeakIndex,pointOnCurve,withConic,renderGraph}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const preset=presets.find(p=>p.id==='normal');
 assert.ok(preset,'normal distribution has a selectable preset');
 const graph=graphSchema.parse(preset.graph),curve=graph.curves[0],model=curve.distribution;
 assert.equal(model.kind,'normal');
 assert.equal(model.sigma,1);
 assert.equal(distributionValue(model,model.peak),model.baseline+model.height);
 assert.equal(distributionValue(model,model.origin),Math.exp(-8),'normal plot bounds truncate the bell rather than forcing its endpoints to zero');
 assert.equal(curve.points[distributionPeakIndex(curve)].x,model.peak);
 assert.deepEqual(graph.guides,[{x1:0,y1:1,x2:4,y2:1},{x1:4,y1:0,x2:4,y2:1}]);
 assert.ok(graph.xTicks.some(t=>t.label==='\\mu'));
 assert.ok(graph.xTicks.some(t=>t.label==='\\mu+\\sigma'));
 for(const z of [.25,.5,1,2,3,4]){
  const left=distributionValue(model,model.peak-z*model.sigma),right=distributionValue(model,model.peak+z*model.sigma);
  assert.equal(left,right,'equal distances from the mean have equal heights');
  assert.ok(Math.abs(left-Math.exp(-z*z/2))<1e-15);
 }
 // The same exported Béziers are used by visible curves and shading. Check
 // their shape against the Gaussian, including narrow peaks in long domains.
 for(const params of [
  model,
  {...model,origin:-1000000,peak:0,end:1000000,sigma:.0001,height:7,baseline:-2},
  {...model,origin:9999,peak:10000,end:10001,sigma:.00004,height:2,baseline:.5},
  {...model,origin:3.8,end:4.4,sigma:20},
  {...model,origin:-100,peak:0,end:100,sigma:3,height:1/(3*Math.sqrt(2*Math.PI))},
 ]){
  const sampled=withDistribution(curve,params);
  assert.ok(sampled.points.length>=3&&sampled.points.length<=500);
  assert.equal(sampled.smooth,true);
  assert.equal(sampled.points[0].x,params.origin);
  assert.equal(sampled.points.at(-1).x,params.end);
  assert.ok(sampled.points.every((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!i||p.x>sampled.points[i-1].x)));
  let maxError=0;
  for(let i=0;i<sampled.points.length-1;i++)for(const t of [.1,.25,.5,.75,.9]){
   const point=pointOnCurve(sampled,i,t);
   maxError=Math.max(maxError,Math.abs(point.y-distributionValue(params,point.x))/params.height);
   assert.ok(point.y>=params.baseline-params.height*1.1e-6&&point.y<=params.baseline+params.height*(1+1.1e-6),`interpolation extrema ${JSON.stringify({params,i,t,point})}`);
  }
  assert.ok(maxError<1.1e-6,`Gaussian Bézier error ${maxError} exceeds tolerance`);
  const reparsed=graphSchema.parse({...graph,curves:[sampled]});
  assert.deepEqual(reparsed.curves[0],sampled,'saved normal metadata regenerates the same shape');
  const svg=renderGraph(reparsed);
  assert.ok(svg.includes(' C')&&!svg.includes('NaN')&&!svg.includes('Infinity'));
 }
 for(const invalid of [0,-1,Infinity,NaN,1000001])assert.throws(()=>withDistribution(curve,{...model,sigma:invalid}));
 assert.throws(()=>withDistribution(curve,{...model,sigma:Number.MIN_VALUE}),'standard deviation must be distinguishable at the mean coordinate');
 assert.throws(()=>withDistribution(curve,{...model,origin:model.peak}));
 assert.throws(()=>withDistribution(curve,{...model,end:model.peak}));
 assert.throws(()=>withDistribution(curve,{...model,height:0}));
 assert.throws(()=>withDistribution(curve,{...model,baseline:1000000}));
 const gamma=presets.find(p=>p.id==='distribution').graph.curves[0];
 assert.equal(gamma.distribution.kind,'gamma');
 assert.equal(distributionValue(gamma.distribution,gamma.distribution.origin),gamma.distribution.baseline);
 assert.equal(graphSchema.parse(presets.find(p=>p.id==='distribution').graph).curves[0].distribution.power,3);
 const freed=freeDistribution(curve);
 assert.equal(freed.distribution,undefined);
 assert.deepEqual(freed.points,curve.points);
 const conic=withConic(curve,{kind:'circle',cx:0,cy:0,rx:2,ry:2});
 assert.equal(conic.distribution,null);
 const normal=withDistribution(conic,model);
 assert.equal(normal.conic,null);
 assert.equal(normal.distribution.kind,'normal');
 console.log('Normal distribution model and adaptive curve tests passed.');
}finally{
 await rm(temp,{recursive:true,force:true});
}

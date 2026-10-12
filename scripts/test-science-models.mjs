import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileTestModules} from './test-module-loader.mjs';

await mkdir('outputs',{recursive:true});
const temp=await mkdtemp(path.join(process.cwd(),'outputs','science-model-test-'));
try{
 await compileTestModules(temp,['graph','science-models']);
 const {createScienceGraph,scienceModelDefaults,scienceModelSchema,maxwellEnergyDensity,maxwellSpeedDensity,scienceFunction,scienceDerivative,GAS_CONSTANT,GAS_CONSTANT_KJ}=await import(pathToFileURL(path.join(temp,'science-models.mjs')));
 const {graphSchema,renderGraph}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} ≠ ${expected}`);
 const point=(curve,x)=>curve.points.find(p=>Math.abs(p.x-x)<1e-10);
 const integral=(points,weight=(x,y)=>y)=>points.slice(1).reduce((sum,b,i)=>{const a=points[i];return sum+(b.x-a.x)*(weight(a.x,a.y)+weight(b.x,b.y))/2;},0);
 let models=0;
 const check=(model)=>{
  const graph=createScienceGraph(model),parsed=graphSchema.parse(graph);
  assert.ok(parsed.curves.length<=12&&parsed.guides.length<=80&&parsed.labels.length<=40);
  assert.ok(parsed.curves.every(c=>c.points.length<=500));
  const svg=renderGraph(parsed);
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.deepEqual(graph.scienceModel,model);
  models++;return graph;
 };
 for(const model of Object.values(scienceModelDefaults))check(model);

 // The isolated two-body model conserves total thermal energy at every time.
 for(const params of [{temperature1:80,temperature2:20,capacity1:1,capacity2:1},{temperature1:-20,temperature2:150,capacity1:3,capacity2:7},{temperature1:30,temperature2:30,capacity1:2,capacity2:9}]){
  const model={...scienceModelDefaults['thermal-equilibrium'],...params},graph=check(model);
  const total=model.capacity1*model.temperature1+model.capacity2*model.temperature2;
  const final=total/(model.capacity1+model.capacity2);
  near(graph.guides[0].y1,final);
  graph.curves[0].points.forEach((p,i)=>near(model.capacity1*p.y+model.capacity2*graph.curves[1].points[i].y,total));
  near(graph.curves[0].points[0].y,model.temperature1);near(graph.curves[1].points[0].y,model.temperature2);
 }

 // Catalysts change activation barriers but not initial/final energy or ΔH.
 for(const delta of [-30,0,20]){
  const model={...scienceModelDefaults['reaction-energy'],product:20+delta},graph=check(model);
  for(const [i,curve] of graph.curves.entries()){
   near(curve.points[0].y,model.reactant);near(curve.points.at(-1).y,model.product);
   near(point(curve,.5).y-model.reactant,i===0?model.activation:model.catalyzedActivation);
   near(Math.max(...curve.points.map(p=>p.y)),point(curve,.5).y);
  }
 }

 for(const inhibition of [1,2,8]){
  const model={...scienceModelDefaults['competitive-inhibition'],inhibition},graph=check(model);
  near(point(graph.curves[0],model.km).y,model.vmax/2);
  near(point(graph.curves[1],model.km*inhibition).y,model.vmax/2);
  near(graph.guides[0].y1,model.vmax);
  assert.ok(graph.curves.every(c=>c.points.every(p=>p.y>=0&&p.y<model.vmax)));
 }

 // The horizontal variables and normalizing factors differ for E and v.
 for(const kind of ['maxwell-energy','maxwell-speed'])for(const temperatures of [[300,600],[50,3000],[700,700]]){
  const model={...scienceModelDefaults[kind],temperature1:temperatures[0],temperature2:temperatures[1],threshold:0},graph=check(model);
  for(const [i,curve] of graph.curves.entries()){
   const temperature=temperatures[i],area=integral(curve.points);
   near(area,1,7e-4);
   const mean=kind==='maxwell-energy'?1.5*GAS_CONSTANT_KJ*temperature:Math.sqrt(8*GAS_CONSTANT*temperature/(Math.PI*model.molarMass/1000));
   near(integral(curve.points,(x,y)=>x*y),mean,7e-4);
   assert.ok(curve.points.every(p=>p.y>=0));
   assert.equal(graph.shadings[i].xStart,0);
  }
  near(integral(graph.curves[0].points),integral(graph.curves[1].points),7e-4);
 }
 near(maxwellEnergyDensity(0,300),0);near(maxwellSpeedDensity(0,300,28),0);

 for(const phase of [-360,-90,0,30,360]){
  const model={...scienceModelDefaults.sine,phase,frequency:2},graph=check(model),peak=graph.guides[1].x1;
  near(point(graph.curves[0],peak)?.y??model.offset+model.amplitude*Math.sin(2*Math.PI*model.frequency*peak+phase*Math.PI/180),model.offset+model.amplitude);
  const fn=x=>model.offset+model.amplitude*Math.sin(2*Math.PI*model.frequency*x+phase*Math.PI/180);
  near(fn(.13),fn(.13+1/model.frequency));
  assert.ok(graph.curves[0].points.every(p=>Math.abs(p.y-model.offset)<=model.amplitude+1e-10));
 }

 for(const resistance of [.001,10,10000]){
  const model={...scienceModelDefaults.rc,resistance},graph=check(model),tau=model.resistance*model.capacitance*.001;
  near(point(graph.curves[0],tau).y,model.voltage*(1-1/Math.E));
  near(point(graph.curves[1],tau).y,model.voltage/Math.E);
  graph.curves[0].points.forEach((p,i)=>near(p.y+graph.curves[1].points[i].y,model.voltage));
 }
 for(const halfLife of [.001,2,10000]){
  const model={...scienceModelDefaults['exponential-decay'],halfLife},graph=check(model);
  for(let n=1;n<=model.periods;n++)near(point(graph.curves[0],n*halfLife).y,model.initial/2**n);
 }
 for(const fn of ['quadratic','sine','exponential'])for(const positions of [[1,3],[-2,-1],[2,-3]]){
  const model={...scienceModelDefaults['tangent-secant'],function:fn,at:positions[0],other:positions[1]},graph=check(model),tangent=graph.curves[1].points;
  near((tangent[1].y-tangent[0].y)/(tangent[1].x-tangent[0].x),scienceDerivative(fn,model.at));
  near(tangent[0].y+scienceDerivative(fn,model.at)*(model.at-tangent[0].x),scienceFunction(fn,model.at));
  near(graph.curves[2].points[0].y,scienceFunction(fn,model.at));near(graph.curves[2].points[1].y,scienceFunction(fn,model.other));
  near(graph.guides[0].y2,scienceFunction(fn,model.at));
 }
 for(const bad of [
  {...scienceModelDefaults.rc,resistance:0},
  {...scienceModelDefaults.rc,capacitance:Infinity},
  {...scienceModelDefaults.sine,amplitude:-1},
  {...scienceModelDefaults.sine,cycles:1.5},
  {...scienceModelDefaults['thermal-equilibrium'],capacity1:-1},
  {...scienceModelDefaults['thermal-equilibrium'],temperature1:-300},
  {...scienceModelDefaults['reaction-energy'],catalyzedActivation:100},
  {...scienceModelDefaults['reaction-energy'],product:1000},
  {...scienceModelDefaults['competitive-inhibition'],inhibition:.5},
  {...scienceModelDefaults['competitive-inhibition'],km:10000,inhibition:30},
  {...scienceModelDefaults['maxwell-energy'],temperature1:0},
  {...scienceModelDefaults['maxwell-energy'],threshold:1000},
  {...scienceModelDefaults['maxwell-speed'],molarMass:0},
  {...scienceModelDefaults['maxwell-speed'],threshold:20000},
  {...scienceModelDefaults['tangent-secant'],at:1,other:1.00001},
 ]){
  assert.equal(scienceModelSchema.safeParse(bad).success,false);assert.throws(()=>createScienceGraph(bad));
 }
 console.log(`Science model tests passed: ${models} generated graphs; heat conservation, catalyst endpoints, enzyme Km/Vmax, normalized energy/speed densities and means, wave period, RC complement, half-life, tangent/secant dependence, 15 invalid inputs.`);
}finally{await rm(temp,{recursive:true,force:true});}

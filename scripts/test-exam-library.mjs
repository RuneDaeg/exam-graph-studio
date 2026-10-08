import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import katex from 'katex';

const root = process.cwd();
await mkdir(path.join(root, 'outputs'), { recursive: true });
const temp = await mkdtemp(path.join(root, 'outputs', 'exam-library-test-'));
try {
  for (const name of ['graph', 'graph-edit', 'exam-presets', 'exam-physics', 'exam-chemistry', 'exam-biology', 'exam-earth', 'exam-integrated']) {
    const source = (await readFile(path.join(root, 'lib', name + '.ts'), 'utf8')).replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
    await writeFile(path.join(temp, name + '.mjs'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
  }
  const { examTemplates, scienceCourses, filterExamTemplates } = await import(pathToFileURL(path.join(temp, 'exam-presets.mjs')));
  const { graphSchema, renderGraph, yAxisRange, distributionPeakIndex, distributionValue, pointOnCurve } = await import(pathToFileURL(path.join(temp, 'graph.mjs')));
  const { movePoint } = await import(pathToFileURL(path.join(temp, 'graph-edit.mjs')));
  assert.equal(examTemplates.filter(t => t.course !== '통합과학').length, 20);
  assert.ok(examTemplates.filter(t => t.course === '통합과학').length >= 8);
  assert.equal(new Set(examTemplates.map(t => t.id)).size, examTemplates.length);
  assert.deepEqual(new Set(examTemplates.map(t => t.course)), new Set(scienceCourses));
  assert.deepEqual(new Set(examTemplates.map(t => t.source.conductedOn.slice(0, 4))), new Set(['2022', '2023', '2024', '2025', '2026']));
  const manifest = [];
  for (const template of examTemplates) {
    const { graph, source, id } = template;
    graphSchema.parse(graph);
    assert.equal(source.academicYear, Number(source.conductedOn.slice(0, 4)) + (source.grade === '고1' ? 0 : 1), id);
    assert.ok(source.question >= 1 && source.question <= 20 && source.pdfPage >= 1 && source.pdfPage <= (source.grade === '고1' ? 6 : 4), id);
    assert.equal(new URL(source.pdfUrl).hostname, 'wdown.ebsi.co.kr', id);
    assert.equal(new URL(source.landingUrl).hostname, 'www.ebsi.co.kr', id);
    assert.ok(['/ebs/xip/xipa/retrieveSCVMainInfo.ebs','/ebs/xip/xipa/retrieveSCVPreparation.ebs'].includes(new URL(source.landingUrl).pathname), id);
    assert.ok(template.adaptation.note.length > 20 && graph.note.length > 20, id);
    for (const [ci, curve] of graph.curves.entries()) {
      const range = yAxisRange(graph, curve.yAxis);
      for (const [pi, point] of curve.points.entries()) {
        assert.ok(point.x >= graph.xMin && point.x <= graph.xMax && point.y >= range.min && point.y <= range.max, `${id}: point ${pi} bounds`);
        if (curve.smooth && pi) assert.ok(point.x > curve.points[pi - 1].x, `${id}: smooth knots ordered`);
      }
      if (curve.smooth) {
        assert.ok(curve.points.length <= (curve.distribution ? 500 : 80), `${id}: bounded samples`);
        if (curve.distribution) for (const p of curve.points) assert.ok(Math.abs(p.y - distributionValue(curve.distribution, p.x)) < 1e-10, `${id}: formula samples`);
        const original = structuredClone(graph);
        const moved = movePoint(graph, ci, curve.distribution ? distributionPeakIndex(curve) : Math.floor(curve.points.length / 2), graph.xMax, range.max);
        assert.deepEqual(graph, original, `${id}: immutable template`);
        assert.ok(moved.curves[ci].points.every((p, i, pts) => !i || p.x > pts[i-1].x), `${id}: extreme drag preserves order`);
      }
    }
    const labels = [graph.xLabel, graph.yLabel, ...graph.xTicks.map(t => t.label), ...graph.yTicks.map(t => t.label), ...graph.labels.map(l => l.text), ...(graph.rightYAxis ? [graph.rightYAxis.label, ...graph.rightYAxis.ticks.map(t => t.label)] : [])];
    for (const label of labels) {
      assert.ok(!/[\x00-\x09\x0b-\x1f]/.test(label), `${id}: broken JS escape`);
      for (const line of label.split('\n')) if (!/[가-힣]/.test(line)) katex.renderToString(line, { throwOnError: true });
    }
    assert.ok(!/NaN|Infinity/.test(renderGraph(graph)), id);
    manifest.push({ id, name: template.name, course: template.course, source, adaptation: template.adaptation });
  }
  assert.equal(filterExamTemplates('전체', '존재하지않는유형').length, 0);
  for (const course of scienceCourses) assert.ok(filterExamTemplates(course, '').every(t => t.course === course));
  assert.equal(filterExamTemplates('지구과학Ⅰ', '식 밝기').length, 1);
  assert.ok(filterExamTemplates('전체', '2024').length > 0);
  const decay = examTemplates.find(t => t.id === 'earth1-radioactive-decay').graph;
  assert.equal(decay.curves[0].points.find(p => p.x === 2).y, 25);
  const galaxy = examTemplates.find(t => t.id === 'earth2-galaxy-rotation').graph;
  galaxy.curves[0].points.forEach((p, i) => assert.ok(Math.abs(p.y ** 2 - galaxy.curves[1].points[i].y ** 2 - galaxy.curves[2].points[i].y ** 2) < 1e-10));
  const reaction = examTemplates.find(t => t.id === 'chemistry-first-order').graph;
  reaction.curves[0].points.forEach((p, i) => { assert.ok(Math.abs(p.y + reaction.curves[1].points[i].y - 4) < 1e-10); assert.equal(reaction.curves[1].points[i].y, 2 * reaction.curves[2].points[i].y); });
  const impulse = examTemplates.find(t => t.id === 'exam-integrated-equal-impulse').graph;
  // Simpson integration is exact for these cubic intervals with linear x(t).
  const areas = impulse.curves.map(curve => curve.points.slice(1).reduce((sum, to, i) => { const from = curve.points[i]; return sum + (to.x - from.x) * (from.y + 4 * pointOnCurve(curve, i, .5).y + to.y) / 6; }, 0));
  assert.ok(Math.abs(areas[0] - areas[1]) < 1e-10, 'equal impulse despite different collision duration');
  assert.ok(Math.abs(areas[0] - 8) < .001, 'displayed interpolation stays close to the formula integral');
  const projectile = examTemplates.find(t => t.id === 'exam-integrated-horizontal-projectile').graph;
  projectile.curves.forEach((c, i) => c.points.forEach(p => assert.ok(Math.abs(p.y - (5 - 5 * (p.x / [3, 6][i]) ** 2)) < 1e-10, 'equal drop time with independent horizontal speeds')));
  const catalyst = examTemplates.find(t => t.id === 'exam-integrated-catalyst-energy').graph;
  assert.deepEqual(catalyst.curves[0].points[0], catalyst.curves[1].points[0]);
  assert.deepEqual(catalyst.curves[0].points.at(-1), catalyst.curves[1].points.at(-1));
  await writeFile(path.join(root, 'outputs', 'exam-library-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`PASS: ${examTemplates.length} source-backed representative templates, ${scienceCourses.length} courses; schema, LaTeX, axis-specific bounds, immutable smooth edits, filters and scientific invariants.`);
} finally { await rm(temp, { recursive: true, force: true }); }

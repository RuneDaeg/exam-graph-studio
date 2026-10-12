import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

// Compile local dependencies too, so every suite exercises the same modules.
export async function compileTestModules(temp, names) {
  const seen = new Set();
  async function compile(name) {
    if (seen.has(name)) return;
    seen.add(name);
    const source = await readFile(path.join(process.cwd(), 'lib', `${name}.ts`), 'utf8');
    let output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const dependencies = [...output.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map(match => match[1]);
    output = output.replace(/from\s+(['"])\.\/([^'"]+)\1/g, "from './$2.mjs'");
    await writeFile(path.join(temp, `${name}.mjs`), output);
    await Promise.all(dependencies.map(compile));
  }
  await Promise.all(names.map(compile));
}

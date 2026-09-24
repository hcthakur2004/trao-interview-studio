import ts from 'typescript';
import fs from 'node:fs';
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const host = {
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => '0',
  getScriptSnapshot: (f) =>
    fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host);
for (const file of parsed.fileNames.filter((f) => !f.includes('.next') && !f.endsWith('.d.ts'))) {
  for (const edit of service.organizeImports({ type: 'file', fileName: file }, {}, {})) {
    let text = fs.readFileSync(edit.fileName, 'utf8');
    for (const change of [...edit.textChanges].sort((a, b) => b.span.start - a.span.start))
      text =
        text.slice(0, change.span.start) +
        change.newText +
        text.slice(change.span.start + change.span.length);
    fs.writeFileSync(edit.fileName, text);
  }
}
console.log('Organized imports');

const { dirname, isAbsolute, join } = require('path');
const createTransformModules = require('./transformModules');
const createGenerate = require('./createGenerate');
const createParse = require('./createParse');

module.exports = function transpiler(content, opts) {
  const { templatePath, mpType } = opts;
  let dependencies = [];
  const modules = createTransformModules(mpType);
  const parse = createParse(modules);
  const generate = createGenerate(modules);
  const templateAST = parse(content.trim(), opts);


  if (Array.isArray(templateAST.templates)) {
    templateAST.templates
      .map(resolveImportTemplate)
      .forEach((tplPath) => {
        dependencies.push(tplPath);
      });
  }

  const { render, ast } = generate(templateAST, opts);

  return {
    renderFn: render,
    ast,
    dependencies,
    tplAlias: ast.tplAlias || null,
    tplASTs: ast.tplASTs || null
  };

  function resolveImportTemplate(importPath) {
    if (!isAbsolute(importPath)) {
      importPath = join(dirname(templatePath), importPath);
    }
    return importPath;
  }
};

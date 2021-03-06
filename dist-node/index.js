'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var util = require('util');
var fs = require('fs');
var fs__default = _interopDefault(fs);
var _glob = _interopDefault(require('glob'));
var parser = require('@babel/parser');
var traverse = _interopDefault(require('@babel/traverse'));
var chalk = _interopDefault(require('chalk'));
var path = require('path');
var minimist = _interopDefault(require('minimist'));
var mkdirp = _interopDefault(require('mkdirp'));
var babel = _interopDefault(require('@babel/core'));
var babelPluginDynamicImportSyntax = _interopDefault(require('@babel/plugin-syntax-dynamic-import'));
var babelPluginImportMetaSyntax = _interopDefault(require('@babel/plugin-syntax-import-meta'));
var babelPresetTypeScript = _interopDefault(require('@babel/preset-typescript'));
var babelPluginImportRewrite = _interopDefault(require('@pika/babel-plugin-esm-import-rewrite'));

const glob = util.promisify(_glob); // export const open = util.promisify(fs.open);
// export const writeFile = util.promisify(fs.writeFile);
// export const readlink = util.promisify(fs.readlink);
// export const realpath = util.promisify(fs.realpath);
// export const readdir = util.promisify(fs.readdir);
// export const rename = util.promisify(fs.rename);
// export const access = util.promisify(fs.access);
// export const stat = util.promisify(fs.stat);
// export const exists = util.promisify(fs.exists);
// export const lstat = util.promisify(fs.lstat);
// export const chmod = util.promisify(fs.chmod);
// export const link = util.promisify(fs.link);
// export const existsSync = fs.existsSync;
// const readFileBuffer = util.promisify(fs.readFile);

const readFile = path => {
  return util.promisify(fs.readFile)(path, {
    encoding: 'utf-8'
  });
}; // import stripBOM from 'strip-bom';
// export async function readJson(loc: string): Promise<Object> {
//   return (await readJsonAndFile(loc)).object;
// }
// export async function readJsonAndFile(
//   loc: string,
// ): Promise<{
//   object: Object,
//   content: string,
// }> {
//   const file = await readFile(loc);
//   try {
//     return {
//       object: map(JSON.parse(stripBOM(file))),
//       content: file,
//     };
//   } catch (err) {
//     err.message = `${loc}: ${err.message}`;
//     throw err;
//   }
// }
// const cr = '\r'.charCodeAt(0);
// const lf = '\n'.charCodeAt(0);
// async function getEolFromFile(path: string): Promise<string | void> {
//   if (!await exists(path)) {
//     return undefined;
//   }
//   const buffer = await readFileBuffer(path);
//   for (let i = 0; i < buffer.length; ++i) {
//     if (buffer[i] === cr) {
//       return '\r\n';
//     }
//     if (buffer[i] === lf) {
//       return '\n';
//     }
//   }
//   return undefined;
// }
// export async function writeFilePreservingEol(path: string, data: string): Promise<void> {
//   const eol = (await getEolFromFile(path)) || os.EOL;
//   if (eol !== '\n') {
//     data = data.replace(/\n/g, eol);
//   }
//   await writeFile(path, data);
// }

// @flow

function getLineCol(node) {
  const loc = node.loc.start;
  return chalk.dim(`[${loc.line}:${loc.column}]`);
}

function validateDynamicImportArguments(path) {
  if (path.parent.arguments.length !== 1) {
    return new Set([`${getLineCol(path.node)} "\`import()\` only accepts 1 argument, but got ${path.parent.arguments.length}`]);
  }

  const [argNode] = path.parent.arguments;

  if (argNode.type !== 'StringLiteral') {
    return new Set([`${getLineCol(path.node)} Pika expects strings as \`import()\` arguments. Treating this as an absolute file path.`]);
  }

  return new Set();
}

// @flow

function getLineCol$1(node) {
  const loc = node.loc.start;
  return chalk.dim(`[${loc.line}:${loc.column}]`);
}

function validate(code, fileLoc, cwd, dist, ignoreExtensions) {
  const ast = parser.parse(code, {
    plugins: ['dynamicImport', 'importMeta'],
    sourceType: 'module'
  });
  const errors = new Set();

  function validateSpecifier(specifier, path$1) {
    const errors = new Set();

    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      if (!ignoreExtensions && !specifier.endsWith('.js')) {
        errors.add(`${getLineCol$1(path$1.node)} "${specifier}": Valid relative imports must include the ".js" file extension.`);
      }

      const absPathToImport = path.resolve(path.dirname(fileLoc), specifier);
      const assetsPath = path.join(cwd, 'assets');

      if (!absPathToImport.startsWith(cwd)) {
        errors.add(`${getLineCol$1(path$1.node)} "${specifier}": Valid imports cannot reach outside of the current package.`);
      } else if (!absPathToImport.startsWith(assetsPath) && !absPathToImport.startsWith(dist)) {
        errors.add(`${getLineCol$1(path$1.node)} "${specifier}": Valid imports can only import from the dist directory or the sibling \`assets/\` directory.`);
      }

      return errors;
    } // NOTE(fks): Removed as "too opinionated" (rightfully!).
    // const parts = specifier.split('/').length;
    // if ((specifier.startsWith('@') && parts > 2) || (!specifier.startsWith('@') && parts > 1)) {
    //   errors.add(
    //     `${getLineCol(path.node)} "${specifier}": Avoid directly importing private files inside external packages.`,
    //   );
    //   return errors;
    // }


    return errors;
  }

  traverse(ast, {
    Identifier(path) {
      if (path.node.name === '__dirname') {
        errors.add(`${getLineCol$1(path.node)} \`__dirname\` is not a valid ESM global. Use \`import.meta.url\` instead.`);
      }

      if (path.node.name === '__filename') {
        errors.add(`${getLineCol$1(path.node)} \`__filename\` is not a valid ESM global. Use \`import.meta.url\` instead.`);
      }

      if (path.node.name === 'require' && path.parent.type !== 'CallExpression') {
        errors.add(`${getLineCol$1(path.node)} \`require()\` is not a valid ESM global. Use \`import()\` instead.`);
      }

      if (path.node.name === 'module' && path.parent.type !== 'MemberExpression' && path.parent.type !== 'ObjectProperty') {
        errors.add(`${getLineCol$1(path.node)} \`module\` is not a valid ESM global. Use \`export\` instead.`);
      } // TODO: Lint against other node concepts?

    },

    ImportDeclaration(path) {
      validateSpecifier(path.node.source.value, path).forEach(e => errors.add(e));
    },

    Import(path) {
      if (path.parent.type !== 'CallExpression') {
        errors.add(`${getLineCol$1(path.node)} \`import()\` should only be used/called directly.`);
        return;
      }

      const results = validateDynamicImportArguments(path);

      if (results.size > 0) {
        results.forEach(e => errors.add(e));
        return;
      }

      validateSpecifier(path.parent.arguments[0].value, path).forEach(e => errors.add(e));
    },

    MetaProperty(path) {
      if (!path.parent.property || path.parent.property.name !== 'url') {
        errors.add(`${getLineCol$1(path.node)} \`url\` is the only \`import.meta\` property currently supported in spec.`);
      }
    }

  });
  return errors;
}

/*

$ standard-pkg [--src src/] [--dist dist-src/]
- builds `src/` -> `dist-src/`
- writes `src/` -> `dist-src/`
- lints `dist-src/`

$ standard-pkg [--src src/]
- builds `src/` -> `dist-src/`
- lints `dist-src/`
- (does not write to disk)

$ standard-pkg [--dist dist-src/]
$ standard-pkg lint dist-src/
- lints `dist-src/`

*/
// const argv = yargs.command({
//   command: 'build',
//   describe: 'describe',
//   builder: (yargs) => yargs.option('src', {
//         default: 'src/',
//         describe: 'x marks the spot',
//         type: 'string'
//     }).option('dist', {
//       default: 'dist/',
//       describe: 'x marks the spot',
//       type: 'string'
//   }),
//   handler: (argv) => undefined,
// }).command({
//   command: 'lint [dist]',
//   aliases: ['$0'],
//   describe: 'describe',
//   builder: (yargs) => yargs.option('src', {
//         default: 'src/',
//         describe: 'x marks the spot',
//         type: 'string'
//     }),
//   handler: (argv) => undefined
// }).help();
// console.log(argv);

function log(fileName, errors) {
  console.log(chalk.bold(fileName));

  for (const error of errors) {
    console.log(' ', error.level === 2 ? '⚠️ ' : '   ', error.msg);
  }
}

class Lint {
  constructor(dist, {
    ignoreExtensions
  } = {}) {
    this.dist = dist;
    this.errors = new Map();
    this.totalNum = 0;
    this.ignoreExtensions = ignoreExtensions || false;
  }

  addError(filename, msg, level = 2) {
    const errors = this.errors.get(filename) || [];
    errors.push({
      msg,
      level
    });
    this.errors.set(filename, errors);
  }

  async init() {
    const {
      dist
    } = this;
    const dir = path.join(dist, '..');
    const files = await glob(`**/*`, {
      cwd: dist,
      absolute: true,
      nodir: true
    });

    for (const fileLoc of files) {
      const relativePath = path.relative(path.join(dist, '..'), fileLoc);
      const extName = path.extname(fileLoc);

      if (extName === '.map') {
        continue;
      }

      if (fileLoc.includes('README')) {
        continue;
      }

      if (extName !== '.js') {
        this.addError(relativePath, 'Only JavaScript files are expected in your dist-src/ distribution.');
        this.totalNum++;
        continue;
      }

      const fileContents = await readFile(fileLoc);
      const validateErrors = validate(fileContents, fileLoc, dir, dist, this.ignoreExtensions);

      for (const errMsg of validateErrors) {
        this.addError(relativePath, errMsg);
      }

      this.totalNum += validateErrors.size;
    }
  }

  summary() {
    if (this.totalNum === 0) {
      return;
    }

    console.log(``);

    for (const [filename, errors] of this.errors.entries()) {
      log(filename, errors);
    }

    console.log(``);
    console.log(chalk.red('✘'), `${this.totalNum} issues found.`);
  }

  exitCode() {
    return this.totalNum === 0 ? 0 : 1;
  }

}
class Build {
  constructor(dir, options = {}) {
    this.dir = dir;
    this.options = options;
    this.result = new Map();
  }

  async init() {
    const {
      dir,
      options
    } = this;
    const files = (await glob(`**/*`, {
      cwd: dir,
      nodir: true,
      absolute: false,
      ignore: options.exclude || []
    })).filter(filepath => !filepath.endsWith('.d.ts') && !filepath.includes('README'));

    for (const sourcePath of files) {
      const sourcePathAbs = path.join(dir, sourcePath);
      const transformedPath = sourcePath // .replace(path.join(dir, 'src/'), path.join(out, 'dist-src/'))
      .replace('.ts', '.js').replace('.tsx', '.js').replace('.jsx', '.js').replace('.mjs', '.js');
      const resultSrc = await babel.transformFileAsync(sourcePathAbs, {
        presets: [[babelPresetTypeScript]],
        plugins: [[babelPluginImportRewrite, {
          addExtensions: true
        }], babelPluginDynamicImportSyntax, babelPluginImportMetaSyntax]
      });
      this.result.set(transformedPath, resultSrc.code);
    }

    return this.result;
  }

  async write(out, result = this.result) {
    for (const [filepath, contents] of result.entries()) {
      const transformedPathAbs = path.join(out, filepath);
      mkdirp.sync(path.dirname(transformedPathAbs));
      fs__default.writeFileSync(transformedPathAbs, contents);
    }
  }

} // export async function runBuild(args: Arguments): Promise<void> {
// }

async function run(argv) {
  var args = minimist(argv.slice(2));
  const srcDir = path.resolve(process.cwd(), typeof args.src === 'string' ? args.src : 'src');
  const distDir = path.resolve(process.cwd(), typeof args.dist === 'string' ? args.dist : 'lib');

  if (args.src) {
    console.log(chalk.bold.dim(`»`), chalk(`Building ${path.relative(process.cwd(), srcDir)}${path.sep} → ${path.relative(process.cwd(), distDir)}${path.sep}...`));
    const builder = new Build(srcDir);
    await builder.init();
    await builder.write(distDir);
  }

  console.log(chalk.bold.dim(`»`), chalk(`Linting ${path.relative(process.cwd(), distDir)}${path.sep}...`));
  const linter = new Lint(distDir);
  await linter.init();

  if (linter.totalNum === 0) {
    // console.log(``);
    console.log(chalk.bold.green(`✓`), '0 issues found.');
  } else {
    linter.summary();
  }

  process.exit(linter.exitCode());
}

exports.Build = Build;
exports.Lint = Lint;
exports.run = run;
//# sourceMappingURL=index.js.map

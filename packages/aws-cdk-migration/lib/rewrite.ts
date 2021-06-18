import * as ts from 'typescript';

interface Import {
  location: ts.StringLiteral;
  value?: ts.Identifier | ts.NodeArray<ts.ImportSpecifier>;
}

interface Replacement {
  original: ts.Node;
  updated: string;
}

/**
 * Re-writes "hyper-modular" CDK imports (most packages in `@aws-cdk/*`) to the
 * relevant "mono" CDK import path. The re-writing will only modify the imported
 * library path, preserving the existing quote style, etc...
 *
 * Syntax errors in the source file being processed may cause some import
 * statements to not be re-written.
 *
 * Supported import statement forms are:
 * - `import * as lib from '@aws-cdk/lib';`
 * - `import { Type } from '@aws-cdk/lib';`
 * - `import '@aws-cdk/lib';`
 * - `import lib = require('@aws-cdk/lib');`
 * - `require('@aws-cdk/lib');
 *
 * @param sourceText the source code where imports should be re-written.
 * @param fileName   a customized file name to provide the TypeScript processor.
 *
 * @returns the updated source code.
 */
export function rewriteImports(sourceText: string, fileName: string = 'index.ts'): string {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2018);

  const replacements = new Array<Replacement>();

  let lookForConstruct: {
    searchName: string,
    replacementName: string,
  } | undefined;

  const visitor = <T extends ts.Node>(node: T): ts.VisitResult<T> => {
    const { location: moduleSpecifier, value: importedValue } = getModuleSpecifier(node) ?? {};
    if (moduleSpecifier) {
      lookForConstruct = extractConstructImport(moduleSpecifier, importedValue, node, sourceFile, replacements);
      replaceModuleLocation(moduleSpecifier, sourceFile, replacements);
    }

    if (lookForConstruct) {
      replaceConstruct(lookForConstruct, node, sourceFile, replacements);
    }

    node.forEachChild(visitor);

    return undefined;
  };

  sourceFile.forEachChild(visitor);

  return executeReplacements(sourceFile, replacements);
}

function getModuleSpecifier(node: ts.Node): Import | undefined {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    // import { Type } from 'location';
    // import * as name from 'location';
    const location = node.moduleSpecifier;
    if (node.importClause && node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        return {
          location: location,
          value: node.importClause.namedBindings.name,
        };
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        return {
          location: location,
          value: node.importClause.namedBindings.elements,
        };
      }
    } else {
      return {
        location: location,
      };
    }
  } else if (
    ts.isImportEqualsDeclaration(node)
    && ts.isExternalModuleReference(node.moduleReference)
    && ts.isStringLiteral(node.moduleReference.expression)
  ) {
    // import name = require('location');
    return {
      location: node.moduleReference.expression,
      value: node.name,
    };
  } else if (
    (ts.isCallExpression(node))
    && ts.isIdentifier(node.expression)
    && node.expression.escapedText === 'require'
    && node.arguments.length === 1
  ) {
    // require('location');
    const argument = node.arguments[0];
    if (ts.isStringLiteral(argument)) {
      return {
        location: argument,
      };
    }
  }
  return undefined;
}

function extractConstructImport(
    moduleSpecifier: ts.StringLiteral,
    importedValue: ts.Identifier | ts.NodeArray<ts.ImportSpecifier> | undefined,
    node: ts.Node,
    sourceFile: ts.SourceFile,
    replacements: Replacement[],
): { searchName: string, replacementName: string } | undefined {
  if (moduleSpecifier.text === '@aws-cdk/core' && importedValue) {
    let constructImport: { searchName: string, replacementName: string, newImport: string } | undefined;
    if (Array.isArray(importedValue)) {
      // import { ..., Construct, ... } from '@aws-cdk/core';
      constructImport = extractBarrelConstructImport(importedValue, sourceFile, replacements);
    } else if (ts.isIdentifier(importedValue as ts.Node)) {
      // import * as cdk from '@aws-cdk/core';
      constructImport = extractNamespaceConstructImport(importedValue as ts.Identifier, node);
    }
    if (constructImport) {
      addNewConstructImport(constructImport.newImport, node, sourceFile, replacements);
      return {
        searchName: constructImport.searchName,
        replacementName: constructImport.replacementName,
      };
    }
  }
  return undefined;
}

function extractBarrelConstructImport(
    importedNames: ts.NodeArray<ts.ImportSpecifier>,
    sourceFile: ts.SourceFile,
    replacements: Replacement[],
): { searchName: string, replacementName: string, newImport: string } | undefined {
  // if the imported name is an alias (`{ Construct as CoreConstruct }`), then `name` holds the alias and `propertyName` holds the original name
  // if the imported name is not an alias (`{ Construct }`), then `name` holds the original name and `propertyName` is `undefined`
  const constructName = importedNames.find((name) => (name.propertyName ?? name.name).text === 'Construct');
  if (constructName) {
    // remove the old import to avoid a name conflict
    const constructIndex = importedNames.indexOf(constructName);
    let importSpecifierStart = constructName.getStart(sourceFile);
    let importSpecifierEnd = constructName.getEnd();
    // remove a leading or trailing comma, if they exist
    if (constructIndex > 0) {
      importSpecifierStart = importedNames[constructIndex - 1].getEnd();
    } else if (constructIndex < importedNames.length - 1) {
      importSpecifierEnd = importedNames[constructIndex + 1].getStart(sourceFile);
    }
    replacements.push({
      original: {
        getStart() {
          return importSpecifierStart;
        },
        getEnd() {
          return importSpecifierEnd;
        },
      } as ts.Node,
      updated: '',
    });

    const aliasStatement = constructName.propertyName ? ` as ${constructName.name.text}` : '';
    return {
      searchName: constructName.name.text,
      replacementName: constructName.name.text,
      newImport: `import { Construct${aliasStatement} } from 'constructs';`,
    };
  }
  return undefined;
}

function extractNamespaceConstructImport(
    constructNamespace: ts.Identifier,
    node: ts.Node,
): { searchName: string, replacementName: string, newImport: string } | undefined {
  const searchName = `${(constructNamespace as ts.Identifier).text}.Construct`;
  const replacementName = 'constructs.Construct';
  if (ts.isImportDeclaration(node)) {
    return {
      searchName,
      replacementName,
      newImport: 'import * as constructs from \'constructs\';',
    };
  } else if (ts.isImportEqualsDeclaration(node)) {
    return {
      searchName,
      replacementName,
      newImport: 'import constructs = require(\'constructs\');',
    };
  } else {
    return undefined;
  }
}

function addNewConstructImport(newImport: string, node: ts.Node, sourceFile: ts.SourceFile, replacements: Replacement[]) {
  // insert a new line and indent
  const beginningLinePos = Array.from(sourceFile.getLineStarts())
    .reverse()
    .find((start) => start <= node.getStart(sourceFile))
    ?? node.getStart(sourceFile);
  const leadingSpaces = node.getStart(sourceFile) - beginningLinePos;
  const newImportPrefix = `\n${' '.repeat(leadingSpaces)}`;

  replacements.push({
    original: {
      getStart() {
        return node.getEnd();
      },
      getEnd() {
        return node.getEnd();
      },
    } as ts.Node,
    updated: `${newImportPrefix}${newImport}`,
  });
}

function replaceModuleLocation(moduleSpecifier: ts.StringLiteral, sourceFile: ts.SourceFile, replacements: Replacement[]) {
  const newModuleLocation = updatedLocationOf(moduleSpecifier.text);
  if (newModuleLocation) {
    replacements.push({
      // keep the original quotation marks
      original: {
        getStart() {
          return moduleSpecifier.getStart(sourceFile) + 1;
        },
        getEnd() {
          return moduleSpecifier.getEnd() - 1;
        },
      } as ts.Node,
      updated: newModuleLocation,
    });
  }
}

const MODULE_EXEMPTIONS = new Set([
  '@aws-cdk/cloudformation-diff',
  '@aws-cdk/assert',
  '@aws-cdk/assert/jest',
]);

function updatedLocationOf(modulePath: string): string | undefined {
  if (!modulePath.startsWith('@aws-cdk/') || MODULE_EXEMPTIONS.has(modulePath)) {
    return undefined;
  } else if (modulePath === '@aws-cdk/core') {
    return 'aws-cdk-lib';
  } else {
    return `aws-cdk-lib/${modulePath.substring(9)}`;
  }
}

function replaceConstruct(
    { searchName, replacementName }: { searchName: string, replacementName: string },
    node: ts.Node,
    sourceFile: ts.SourceFile,
    replacements: Replacement[],
) {
  if ((ts.isTypeReferenceNode(node) || ts.isPropertyAccessExpression(node)) && node.getText(sourceFile) === searchName) {
    replacements.push({ original: node, updated: replacementName });
  }
}

function executeReplacements(sourceFile: ts.SourceFile, replacements: Replacement[]): string {
  let updatedSourceText = sourceFile.getFullText();
  // Applying replacements in reverse order, so node positions remain valid.
  for (const replacement of replacements.sort(({ original: l }, { original: r }) => r.getStart(sourceFile) - l.getStart(sourceFile))) {
    const prefix = updatedSourceText.substring(0, replacement.original.getStart(sourceFile));
    const suffix = updatedSourceText.substring(replacement.original.getEnd());
    updatedSourceText = prefix + replacement.updated + suffix;
  }
  return updatedSourceText;
}

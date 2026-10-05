import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

const ADAPTER = "src/core-adapter.ts";
const TWIN = "src/core-adapter-api2.ts";
const CORE = "@rpgm-tools/neo-angband-core";
const CONTEXT_MEMBERS = new Set([
  "id", "api", "engine", "flags", "settings", "core", "authoring", "state", "assetUrl", "data",
  "prefs", "display", "subwindows", "snapshot", "driver", "controller", "mods", "events",
  "knownLevel", "inspect", "intent", "prompt", "tiles", "keyRepeat", "options", "knowledge",
  "saves", "session", "shared", "title", "profiles", "controllerArmed", "character", "keymaps",
  "characterStore", "newCharacter", "log", "net", "backupFolder", "ui", "installMod", "reloadGame",
  "loadModForSession", "readMod", "debug", "wizard", "registries", "composedRecords",
]);

function sources(): string[] {
  const files = ["plugin.ts"];
  for (const entry of readdirSync(new URL("./src/", import.meta.url), { recursive: true, encoding: "utf8" })) {
    const path = `src/${entry.replace(/\\/g, "/")}`;
    if (path.endsWith(".ts") && !path.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

function unwrap(node: ts.Node): ts.Node {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return unwrap(node.expression);
  return node;
}

function violations(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = new Set<string>();
  const adapterTypes = new Set<string>();
  const aliases = new Map<string, ts.TypeNode>();
  const safeEngines = new Map<ts.Node, Set<string>>();
  const report = (what: string): void => { found.add(`${path}: ${what}`); };

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) &&
        /(?:^|\/)core-adapter\.js$/.test(statement.moduleSpecifier.text)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const entry of bindings.elements) {
          if (entry.isTypeOnly || statement.importClause?.isTypeOnly) adapterTypes.add(entry.name.text);
        }
      }
    }
    if (ts.isTypeAliasDeclaration(statement)) aliases.set(statement.name.text, statement.type);
  }

  const adapterType = (node: ts.TypeNode, seen = new Set<string>()): boolean => {
    if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName)) return false;
    const name = node.typeName.text;
    if (adapterTypes.has(name)) return true;
    if (name === "Pick" && node.typeArguments?.[0]) return adapterType(node.typeArguments[0], seen);
    if (seen.has(name)) return false;
    seen.add(name);
    const alias = aliases.get(name);
    return alias !== undefined && adapterType(alias, seen);
  };

  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer &&
        ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === "createAdapter") {
      for (const entry of node.name.elements) {
        if ((entry.propertyName ?? entry.name).getText(source) === "engine" && ts.isIdentifier(entry.name)) {
          let scope: ts.Node = node.parent;
          while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
          const names = safeEngines.get(scope) ?? new Set<string>();
          names.add(entry.name.text);
          safeEngines.set(scope, names);
        }
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);

  const adaptedEngine = (identifier: ts.Identifier): boolean => {
    let scope: ts.Node | undefined = identifier.parent;
    while (scope) {
      if (ts.isFunctionLike(scope)) {
        const parameter = scope.parameters.find((entry) => ts.isIdentifier(entry.name) && entry.name.text === identifier.text);
        if (parameter) return parameter.type !== undefined && adapterType(parameter.type);
      }
      if (safeEngines.get(scope)?.has(identifier.text)) return true;
      scope = scope.parent;
    }
    return false;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      if (node.text === "registries") report("the registries");
      if (path === TWIN && node.text === "ctx") report("ctx in the API 2 twin");
      if (/^kindIgnoreWhen(Aware|Unaware)$/.test(node.text)) report("the newCharacter hook's live state");
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === CORE) {
      const clause = node.importClause;
      const names = clause?.namedBindings;
      const typeOnly = clause?.isTypeOnly || (clause?.name === undefined && names && ts.isNamedImports(names) &&
        names.elements.length > 0 && names.elements.every((entry) => entry.isTypeOnly));
      if (!typeOnly) report("a runtime import of core");
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === CORE) report("a re-export of core");
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal) && node.argument.literal.text === CORE) report("the core namespace type");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.some((arg) => ts.isStringLiteralLike(arg) && arg.text === CORE)) report("a dynamic import of core");
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const object = unwrap(node.expression);
      const member = ts.isPropertyAccessExpression(node) ? node.name.text :
        ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
      if (ts.isIdentifier(object)) {
        if (object.text === "ctx" && (member === null || CONTEXT_MEMBERS.has(member))) report("a raw plugin context member");
        if (object.text === "core") report("a local core namespace");
        if (object.text === "host") report("the registry host");
        if (/engine$/i.test(object.text) && !adaptedEngine(object)) report("an unadapted engine namespace");
        if (object.text === "objects" && member === "kinds") report("the newCharacter hook's live state");
      }
      if (member === "kinds" && ts.isPropertyAccessExpression(object) && object.name.text === "objects") {
        report("the newCharacter hook's live state");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found];
}

describe("the engine adapter boundary", () => {
  it("scans plugin.ts, both adapters and the other src files", () => {
    const files = sources();
    expect(files).toContain("plugin.ts");
    expect(files).toContain(ADAPTER);
    expect(files).toContain(TWIN);
    expect(files.length).toBeGreaterThan(3);
  });

  it("keeps every internal read inside the API 1 adapter", () => {
    const found = sources()
      .filter((path) => path !== ADAPTER)
      .flatMap((path) => violations(path, readFileSync(new URL(`./${path}`, import.meta.url), "utf8")));
    expect(found).toEqual([]);
  });

  it.each([
    "const x = ctx.core.TMD;",
    "ctx.keymaps?.bind(a, b);",
    "registries.objects.kinds.find(f);",
    'type C = typeof import("@rpgm-tools/neo-angband-core");',
    'import { TMD } from "@rpgm-tools/neo-angband-core";',
    'import "@rpgm-tools/neo-angband-core";',
    "const n = core.EF.ENCHANT;",
    "host.effects.register(a, b);",
    "state.ignore.kindIgnoreWhenAware(1);",
    "state.objects.kinds;",
    "ctx!.core;",
    "(ctx as any).state;",
    "ctx . flags;",
    'ctx["registries"];',
    'export { TMD } from "@rpgm-tools/neo-angband-core";',
    'export * from "@rpgm-tools/neo-angband-core";',
    'const c = await import("@rpgm-tools/neo-angband-core");',
    "rawEngine.EF;",
    "someengine . TMD;",
    "(rawEngine as any)!.EF;",
    'import type { EngineCore } from "./core-adapter.js"; function a(engine: EngineCore) { engine.EF; } function b(engine: any) { engine.EF; }',
  ])("rejects the injected read: %s", (sample) => {
    expect(violations("sample.ts", sample), sample).not.toEqual([]);
  });

  it.each(["ctx.env;", "const ctx = mod;", "ctx!.flags;", "(ctx as any).ui;", 'ctx["meta"];'])
    ("rejects ctx in the API 2 twin: %s", (sample) => {
      expect(violations(TWIN, sample), sample).toContain(`${TWIN}: ctx in the API 2 twin`);
    });

  it("allows type imports, adapted engine parameters and effect context fields", () => {
    const sample = 'import type { GameState } from "@rpgm-tools/neo-angband-core";\n' +
      'import type { EngineCore } from "./src/core-adapter.js";\n' +
      'type LocalEngine = Pick<EngineCore, "EF">;\n' +
      'function run(engine: LocalEngine) { engine.EF; ctx.env.messages?.msg(t); }';
    expect(violations("sample.ts", sample)).toEqual([]);
    expect(violations("sample.ts", '// ctx!.core;\nconst text = "rawEngine.EF";')).toEqual([]);
  });
});

/**
 * Reads the CloudWatch alarms straight out of the CDK constructs that create them, so the
 * alarm table in the explorer is checked against the code rather than kept in step by hand.
 *
 * Parsed from the TypeScript AST, not matched with a regex: these constructions wrap across
 * lines and are built three different ways — `new Alarm(...)`, `new AnomalyDetectionAlarm(...)`
 * and `metric.createAlarm(...)` — and all three have to be seen or the table silently
 * disagrees with the deployment.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import type { AlarmFact } from "./architectureTypes.js";

/** Alarms are created either as `new *Alarm(scope, id, props)` or `metric.createAlarm(scope, id, props)`. */
function alarmCall(
  node: ts.Node,
): { id: string; props?: ts.ObjectLiteralExpression } | undefined {
  let args: ts.NodeArray<ts.Expression> | undefined;
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    // Alarm, CfnAlarm, AnomalyDetectionAlarm — any constructor whose name ends in Alarm.
    if (!/Alarm$/.test(node.expression.text)) return undefined;
    args = node.arguments;
  } else if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "createAlarm"
  ) {
    args = node.arguments;
  }
  if (!args || args.length < 2) return undefined;
  const id = args[1];
  if (!id || !ts.isStringLiteralLike(id)) return undefined;
  const props = args[2];
  return {
    id: id.text,
    props: props && ts.isObjectLiteralExpression(props) ? props : undefined,
  };
}

/** Source text is the honest answer for anything that will not reduce to a number. */
const text = (n: ts.Node, src: ts.SourceFile) =>
  n.getText(src).replace(/\s+/g, " ").trim();

/**
 * Thresholds are usually a named constant (`endToEndLatencyThresholdMs`) or a small
 * expression over one (`fiveXxErrorRatePercent / 100`), and the resolved number is what the
 * table states. Folded over the AST rather than by evaluating source text — the arithmetic
 * here is a handful of node kinds, and none of it should be able to run.
 */
function evalExpr(
  n: ts.Expression,
  consts: Map<string, number>,
): number | undefined {
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isIdentifier(n)) return consts.get(n.text);
  if (ts.isParenthesizedExpression(n)) return evalExpr(n.expression, consts);
  if (
    ts.isPrefixUnaryExpression(n) &&
    n.operator === ts.SyntaxKind.MinusToken &&
    ts.isExpression(n.operand)
  ) {
    const v = evalExpr(n.operand, consts);
    return v === undefined ? undefined : -v;
  }
  if (ts.isBinaryExpression(n)) {
    const a = evalExpr(n.left, consts);
    const b = evalExpr(n.right, consts);
    if (a === undefined || b === undefined) return undefined;
    switch (n.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken:
        return a + b;
      case ts.SyntaxKind.MinusToken:
        return a - b;
      case ts.SyntaxKind.AsteriskToken:
        return a * b;
      case ts.SyntaxKind.SlashToken:
        return b === 0 ? undefined : a / b;
      default:
        return undefined;
    }
  }
  return undefined;
}

/** Declaration order is enough: a const cannot reference one declared after it. */
function numericConstants(src: ts.SourceFile): Map<string, number> {
  const out = new Map<string, number>();
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer
    ) {
      const v = evalExpr(n.initializer, out);
      if (v !== undefined) out.set(n.name.text, v);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

function readProps(
  props: ts.ObjectLiteralExpression | undefined,
  src: ts.SourceFile,
  consts: Map<string, number>,
): Partial<AlarmFact> {
  const out: Partial<AlarmFact> = {};
  if (!props) return out;
  /** A number where it resolves to one, otherwise exactly what the source says. */
  const num = (v: ts.Expression) => {
    const n = evalExpr(v, consts);
    return n === undefined ? text(v, src) : String(n);
  };
  for (const p of props.properties) {
    if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
    const v = p.initializer;
    switch (p.name.text) {
      case "alarmName":
        out.alarmName = text(v, src).replace(/^[`'"]|[`'"]$/g, "");
        break;
      case "threshold":
        out.threshold = num(v);
        break;
      case "stdDevs":
        out.stdDevs = num(v);
        break;
      case "evaluationPeriods":
        out.evaluationPeriods = num(v);
        break;
      case "datapointsToAlarm":
        out.datapointsToAlarm = num(v);
        break;
      case "comparisonOperator":
        out.comparison = text(v, src).replace(/^ComparisonOperator\./, "");
        break;
      case "treatMissingData":
        out.treatMissingData = text(v, src).replace(/^TreatMissingData\./, "");
        break;
      case "metric": {
        const t = text(v, src);
        out.metric = /metricName:\s*"([^"]+)"/.exec(t)?.[1] ?? t;
        const stat = /statistic:\s*(?:Stats\.)?"?([A-Za-z_]+)"?/.exec(t)?.[1];
        if (stat) out.statistic = stat.toLowerCase();
        break;
      }
    }
  }
  return out;
}

export function extractAlarms(root: string, dir: string): AlarmFact[] {
  const alarms: AlarmFact[] = [];
  const files = ts.sys
    .readDirectory(path.join(root, dir), [".ts"])
    .filter((f) => !/\.(test|spec)\.ts$/.test(f))
    .sort();

  for (const file of files) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = path.relative(root, file);
    const consts = numericConstants(src);
    // An alarm assigned to `this.x` gets its topic from a later `this.x.addAlarmAction(...)`,
    // so the property it lands on is what ties the two statements together.
    const byProperty = new Map<string, AlarmFact>();

    const visit = (node: ts.Node) => {
      const call = alarmCall(node);
      if (call) {
        const fact: AlarmFact = {
          id: call.id,
          source: rel,
          ...readProps(call.props, src, consts),
        };
        alarms.push(fact);
        const parent = node.parent as ts.Node | undefined;
        if (
          parent &&
          ts.isBinaryExpression(parent) &&
          parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
        )
          byProperty.set(text(parent.left, src), fact);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "addAlarmAction"
      ) {
        const target = byProperty.get(text(node.expression.expression, src));
        const action = node.arguments[0];
        if (target && action) target.action = text(action, src);
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return alarms;
}

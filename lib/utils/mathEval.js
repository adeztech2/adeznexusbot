// Safe math expression evaluator (no eval / Function). Supports + - * / % ^ ( ),
// constants pi, e and common functions. Trig functions use radians.

const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  log: Math.log10, ln: Math.log, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|([a-z]+)|([-+*/%^(),]))/iy;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const mt = re.exec(src);
    if (!mt) {
      if (!src.slice(pos).trim()) break;
      throw new Error(`Unexpected character "${src.slice(pos).trim()[0]}"`);
    }
    if (mt[1] !== undefined) tokens.push({ t: 'num', v: parseFloat(mt[1]) });
    else if (mt[2] !== undefined) tokens.push({ t: 'id', v: mt[2].toLowerCase() });
    else tokens.push({ t: 'op', v: mt[3] });
    pos = re.lastIndex;
  }
  return tokens;
}

export function evaluate(input) {
  const src = String(input).replace(/×/g, '*').replace(/÷/g, '/');
  if (src.length > 200) throw new Error('Expression too long');
  const tokens = tokenize(src);
  if (!tokens.length) throw new Error('Empty expression');

  let i = 0;
  const peek = () => tokens[i];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;
  const expectOp = (v) => { if (!isOp(v)) throw new Error(`Expected "${v}"`); i++; };

  function expr() {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[i++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  function term() {
    let v = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = tokens[i++].v;
      const r = unary();
      if (op === '*') v *= r;
      else if (op === '/') v /= r;
      else v %= r;
    }
    return v;
  }

  function unary() {
    if (isOp('-')) { i++; return -unary(); }
    if (isOp('+')) { i++; return unary(); }
    return power();
  }

  function power() {
    const base = primary();
    if (isOp('^')) { i++; return Math.pow(base, unary()); }
    return base;
  }

  function primary() {
    const tk = tokens[i++];
    if (!tk) throw new Error('Unexpected end of expression');
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'id') {
      if (tk.v in CONSTS) return CONSTS[tk.v];
      if (tk.v in FUNCS) {
        expectOp('(');
        const args = [];
        if (!isOp(')')) {
          args.push(expr());
          while (isOp(',')) { i++; args.push(expr()); }
        }
        expectOp(')');
        return FUNCS[tk.v](...args);
      }
      throw new Error(`Unknown name "${tk.v}"`);
    }
    if (tk.v === '(') { const v = expr(); expectOp(')'); return v; }
    throw new Error(`Unexpected "${tk.v}"`);
  }

  const result = expr();
  if (i < tokens.length) throw new Error(`Unexpected "${tokens[i].v}"`);
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number');
  return result;
}

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const resolved = path.resolve(root, file);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const mod = { exports: {} };
    cache.set(resolved, mod);
    const source = fs.readFileSync(resolved, 'utf8');
    const compiled = ts.transpileModule(source, { fileName: resolved, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return Object.hasOwn(mocks[name], 'default') ? { __esModule: true, ...mocks[name] } : mocks[name];
      if (/\.(mp3|png)$/.test(name)) return name;
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(resolved), name);
        return load([base, base + '.ts', base + '.tsx'].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()));
      }
      return require(name);
    };
    vm.runInNewContext(compiled, { module: mod, exports: mod.exports, require: localRequire,
      console, process, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval, __DEV__: false, ...globals }, { filename: resolved });
    return mod.exports;
  }
  return load;
}

// Minimal deterministic hook scheduler. Native events and storage are supplied by each test.
function hookRunner() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, value: fn() };
      return slots[index].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  return { react, render(fn) { cursor = 0; const result = fn(); const pending = effects; effects = []; pending.forEach((effect) => effect()); return result; },
    cleanup() { slots.forEach((slot) => slot?.cleanup?.()); } };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const nativeApp = () => {
  const listeners = new Set();
  return { currentState: 'active', addEventListener(_, listener) { listeners.add(listener); return { remove: () => listeners.delete(listener) }; },
    change(state) { this.currentState = state; [...listeners].forEach((listener) => listener(state)); } };
};
module.exports = { loader, hookRunner, tick, nativeApp };

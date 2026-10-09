'use strict';
/* Pruebas del motor: node test.js */
const { mulberry32, DIST, Sim, theory } = require('./engine.js');

let fails = 0;
function check(name, got, want, tol) {
  const err = want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want);
  const ok = err <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FALLA'}  ${name}: obtenido ${got.toFixed(4)}, esperado ${want.toFixed(4)} (error ${(err * 100).toFixed(2)} %, tolerancia ${(tol * 100).toFixed(0)} %)`);
}
function truth(name, cond) { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FALLA'}  ${name}`); }
function run(model, seed, nArrivals) {
  const sim = new Sim(model, seed);
  while (sim.arrivals < nArrivals) sim.step();
  return sim;
}
const st = (name, type, p, servers = 1, cap = Infinity) => ({ name, type, p, servers, cap });

console.log('\n1. Momentos de cada distribución (200 000 muestras)');
const cases = [['exp', { mean: 50 }], ['erlang', { k: 4, mean: 50 }], ['unif', { a: 10, b: 90 }], ['lognormal', { mean: 50, cv: 0.8 }], ['det', { value: 50 }]];
for (const [type, p] of cases) {
  const u = mulberry32(7), d = DIST[type], N = 200000;
  let s = 0, s2 = 0;
  for (let i = 0; i < N; i++) { const x = d.sample(p, u); s += x; s2 += x * x; }
  const m = s / N, v = s2 / N - m * m;
  check(`${type} media`, m, d.mean(p), 0.01);
  if (d.variance(p) > 0) check(`${type} varianza`, v, d.variance(p), 0.04);
  // la densidad integra a 1
  if (type !== 'det') {
    let area = 0; const top = d.mean(p) + 12 * Math.sqrt(d.variance(p)), h = top / 200000;
    for (let i = 0; i < 200000; i++) area += d.pdf(p, (i + 0.5) * h) * h;
    check(`${type} integral de la densidad`, area, 1, 0.01);
  }
}

console.log('\n2. M/M/1 con λ = 8/s y μ = 10/s (W = 500 ms, Lq = 3.2)');
{
  const model = { arrivals: { type: 'exp', p: { mean: 125 } }, stations: [st('S', 'exp', { mean: 100 })] };
  const sim = run(model, 1, 2000000), s = sim.stats(), th = theory(model);
  check('utilización', s.stations[0].util, 0.8, 0.01);
  check('Lq', s.stations[0].Lq, 3.2, 0.04);
  check('Wq', s.stations[0].Wq, 400, 0.04);
  check('W', s.W, 500, 0.04);
  check('teoría Wq', th.stations[0].Wq, 400, 1e-9);
  truth('conservación', sim.conserved());
}

console.log('\n3. D/D/1 calculado a mano (llegada cada 100 ms, servicio 60 ms)');
{
  const model = { arrivals: { type: 'det', p: { value: 100 } }, stations: [st('S', 'det', { value: 60 })] };
  const sim = run(model, 1, 10000), s = sim.stats();
  check('utilización', s.stations[0].util, 0.6, 0.001);
  check('Wq', s.stations[0].Wq, 0, 1e-9);
  check('cola máxima', s.stations[0].maxQ, 0, 1e-9);
}

console.log('\n4. Tubería por defecto: tres estaciones M/M/c en serie');
{
  const model = { arrivals: { type: 'exp', p: { mean: 125 } }, stations: [st('Gateway', 'exp', { mean: 20 }), st('Verificación', 'exp', { mean: 90 }), st('Servicio', 'exp', { mean: 200 }, 2)] };
  const sim = run(model, 2026, 2000000), s = sim.stats(), th = theory(model);
  th.stations.forEach((t, i) => {
    check(`${model.stations[i].name} ρ (${t.kendall})`, s.stations[i].util, t.rho, 0.01);
    check(`${model.stations[i].name} Wq`, s.stations[i].Wq, t.Wq, 0.05);
    check(`${model.stations[i].name} Lq`, s.stations[i].Lq, t.Lq, 0.05);
  });
  check('W del sistema', s.W, th.W, 0.04);
  truth('conservación', sim.conserved());
}

console.log('\n5. M/M/1/K: probabilidad de rechazo con cola de 3 (K = 4, ρ = 0.8)');
{
  const model = { arrivals: { type: 'exp', p: { mean: 125 } }, stations: [st('S', 'exp', { mean: 100 }, 1, 3)] };
  const sim = run(model, 5, 2000000), s = sim.stats();
  const rho = 0.8, K = 4, pb = (1 - rho) * rho ** K / (1 - rho ** (K + 1));
  check('fracción rechazada', s.rejected / s.arrivals, pb, 0.02);
  truth('la cola nunca supera su capacidad', s.stations[0].maxQ <= 3);
  truth('conservación', sim.conserved());
  truth('sin teoría cuando la cola es finita', theory(model).stations[0].known === false);
}

console.log('\n6. M/G/1 contra Pollaczek-Khinchine');
for (const [type, p] of [['erlang', { k: 3, mean: 100 }], ['unif', { a: 50, b: 150 }], ['det', { value: 100 }], ['lognormal', { mean: 100, cv: 1.2 }]]) {
  const model = { arrivals: { type: 'exp', p: { mean: 125 } }, stations: [st('S', type, p)] };
  const sim = run(model, 11, 2000000), s = sim.stats(), th = theory(model);
  check(`${th.stations[0].kendall} Wq`, s.stations[0].Wq, th.stations[0].Wq, 0.06);
}

console.log('\n7. Reproducibilidad e invariantes');
{
  const model = { arrivals: { type: 'lognormal', p: { mean: 100, cv: 1 } }, stations: [st('A', 'unif', { a: 10, b: 60 }, 2, 4), st('B', 'erlang', { k: 2, mean: 80 }, 1, 2)] };
  const a = new Sim(model, 99), b = new Sim(model, 99), c = new Sim(model, 100);
  let same = true, differs = false, monotone = true, cons = true, last = 0;
  for (let i = 0; i < 50000; i++) {
    const x = a.step(), y = b.step(), z = c.step();
    if (x.t !== y.t || x.id !== y.id || x.type !== y.type) same = false;
    if (x.t !== z.t) differs = true;
    if (x.t < last) monotone = false;
    last = x.t;
    if (i % 500 === 0 && !a.conserved()) cons = false;
  }
  truth('misma semilla, misma traza', same);
  truth('otra semilla, otra traza', differs);
  truth('el reloj nunca retrocede', monotone);
  truth('conservación en toda la corrida', cons);
  truth('eventos en la lista futura = 1 llegada + servidores ocupados', a.heap.length === 1 + a.st.reduce((n, s) => n + s.busy, 0));
}

console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fails ? 1 : 0);

"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Series, Bars, Dots, Loss } from "../components/charts";
import { profile } from "../lib/profile";

const STAGES = [
  { id: "dataset", name: "Dataset", title: "Meet the data", cta: "Load dataset", path: "/api/load",
    blurb: "Load the monthly file and check that no month is missing." },
  { id: "clean", name: "Clean", title: "Tidy the readings", cta: "Run cleaning", path: "/api/clean",
    blurb: "Drop duplicate months, repair impossible values, and fill the gaps." },
  { id: "features", name: "Features", title: "Pick the predictors", cta: "Run Spearman + VIF", path: "/api/features",
    blurb: "Keep features that move with arrivals, then remove the ones that repeat each other." },
  { id: "prepare", name: "Prepare", title: "Split without peeking", cta: "Prepare sequences", path: "/api/prepare",
    blurb: "Earlier months train the model, recent months test it. The scaler only ever sees training rows." },
  { id: "train", name: "Train", title: "Teach the LSTM", cta: "Train and tune", path: "/api/train",
    blurb: "Eight small networks compete on validation data. The test months stay sealed." },
  { id: "evaluate", name: "Evaluate", title: "Score it honestly", cta: "Score on test months", path: "/api/evaluate",
    blurb: "The model has to beat two simple rules: repeat last month, or repeat the same month last year." },
  { id: "explain", name: "Explain", title: "See what it leans on", cta: "Compute SHAP values", path: "/api/explain",
    blurb: "SHAP shows which readings pushed the forecast up or down. It describes the model, not cause and effect." },
  { id: "forecast", name: "Forecast", title: "Forecast next month", path: null,
    blurb: "Edit the last twelve months of readings and ask the model what comes next." },
  { id: "interpret", name: "Interpret", title: "Model Interpretation", path: null,
    blurb: "Connect the model's top predictors to real seasonal and climate patterns" },
];

const n0 = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
const n2 = (v) => (v == null ? "n/a" : Number(v).toFixed(2));
const Stat = ({ v, label }) => (<div className="stat"><b>{v}</b><span>{label}</span></div>);

export default function Home() {
  const [active, setActive] = useState("home");
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ratio, setRatio] = useState(0.8);
  const idx = STAGES.findIndex((s) => s.id === active);
  const stage = STAGES[idx];
  const d = data[active];
    useEffect(() => {
    const s = STAGES.find((x) => x.id === active);
    if (s && !s.path) setData((old) => (old[active] ? old : { ...old, [active]: true }));
  }, [active]);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setBusy(true); setError("");
    try {
      const r = await api(stage.path, stage.id === "prepare" ? { train_ratio: ratio } : {});
      // re-running a stage invalidates everything after it
      setData((old) => {
        const next = {};
        STAGES.slice(0, idx).forEach((s) => (next[s.id] = old[s.id]));
        next[stage.id] = r;
        return next;
      });
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function restart() {
    setConfirming(false);
    try { await api("/api/reset", {}); } catch {}
    setData({});
    setError("");
  }

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e) => e.key === "Escape" && setConfirming(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <h1>Tourist Arrivals App</h1>
          <p>Forecasting Philippine tourist arrivals, one stage at a time.</p>
        </div>
        <button className={`step home ${active === "home" ? "active" : ""}`}
          onClick={() => { setActive("home"); setError(""); }}>
          <span className="dot">⌂</span>Home
        </button>
        <ol className="steps">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button className={`step ${s.id === active ? "active" : ""} ${data[s.id] ? "done" : ""}`}
                onClick={() => { setActive(s.id); setError(""); }}>
                <span className="dot">{data[s.id] ? "✓" : i + 1}</span>{s.name}
              </button>
            </li>
          ))}
        </ol>
        <div className="progress">
          <span>{Object.keys(data).length} of {STAGES.length} stages done</span>
          <div className="track">
            <i style={{ width: `${(Object.keys(data).length / STAGES.length) * 100}%` }} />
          </div>
        </div>
      </aside>

      <main className="main">
        {active === "home" ? (
          <HomeView go={setActive} data={data} onRestart={() => setConfirming(true)} />
        ) : (
          <section className="stage" key={active}>
            <h2>{stage.title}</h2>
            <p className="blurb">{stage.blurb}</p>

            {stage.id === "prepare" && (
              <div className="slider">
                <input type="range" min="0.6" max="0.95" step="0.05" value={ratio}
                  onChange={(e) => setRatio(+e.target.value)} aria-label="Train split ratio" />
                <b>{Math.round(ratio * 100)}% train / {Math.round((1 - ratio) * 100)}% test</b>
              </div>
            )}
            {stage.path && (
              <button className="btn" onClick={run} disabled={busy}>{busy ? "Working…" : d ? "Run again" : stage.cta}</button>
            )}
            {busy && <div className="bar"><i /></div>}
            {error && <div className="err" role="alert">{error}</div>}

            {stage.id === "dataset" && d && <Dataset d={d} />}
            {stage.id === "clean" && d && <Clean d={d} />}
            {stage.id === "features" && d && <Features d={d} />}
            {stage.id === "prepare" && d && <Prepare d={d} />}
            {stage.id === "train" && d && <Train d={d} />}
            {stage.id === "evaluate" && d && <Evaluate d={d} />}
            {stage.id === "explain" && d && <Explain d={d} />}
            {stage.id === "forecast" && <Forecast />}
            {stage.id === "interpret" && (
              <Interpret data={data} onGenerate={(r) => setData((old) => ({ ...old, interpret: r }))} />
            )}
          </section>
        )}

        <footer className="foot">
          <div>
            <b>{profile.laboratory}</b>
            <span>Developed by {profile.developer}</span>
          </div>
          <div className="foot-meta">
            <span className="code">{profile.subjectCode}</span>
            <span className="sec">{profile.section}</span>
          </div>
        </footer>
      </main>

      {confirming && (
        <div className="overlay" onClick={() => setConfirming(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rt"
            onClick={(e) => e.stopPropagation()}>
            <h3 id="rt">Restart the lab?</h3>
            <p>This clears every result and the trained model. You'll start again from the dataset.</p>
            <div className="row">
              <button className="ghost" autoFocus onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn restart" onClick={restart}>Yes, restart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeView({ go, data, onRestart }) {
  const [o, setO] = useState(null);
  useEffect(() => { api("/api/overview").then(setO).catch(() => {}); }, []);
  return (
    <section className="stage">
      <div className="hero">
        <div>
          <h2>Forecast Philippine tourist arrivals</h2>
          <p className="blurb">
            An LSTM model trained on monthly arrivals with climate and hazard readings,
            then explained with SHAP. Work through the stages in order.
          </p>
          <div className="row">
            <button className="btn" onClick={() => go("dataset")}>Start with the dataset</button>
            <button className="btn restart" onClick={onRestart} disabled={Object.keys(data).length === 0}>
              Restart
            </button>
          </div>
        </div>
        <div className="panel">
          <h3>Monthly arrivals{o ? `, ${o.start} to ${o.end}` : ""}</h3>
          {o ? (
            <>
              <p className="hint">Peaks every December and January. The 2020 collapse is real.</p>
              <Series data={o.series} keys={["arrivals"]} height={250} />
            </>
          ) : (
            <p className="hint">Start the backend on port 8000 to preview the data here.</p>
          )}
        </div>
      </div>

      {o && (
        <div className="panel stats band">
          <Stat v={o.months} label="months of history" />
          <Stat v={o.peak_month} label="busiest month" />
          <Stat v={n0(o.peak)} label="arrivals in that month" />
          <Stat v={o.predictors} label="candidate predictors" />
        </div>
      )}

      <h3 style={{ marginTop: 40 }}>The stages</h3>
      <ol className="tiles">
        {STAGES.map((s, i) => (
          <li key={s.id}>
            <button className={`tile ${data[s.id] ? "done" : ""}`} onClick={() => go(s.id)}>
              <span className="tnum">{data[s.id] ? "✓" : i + 1}</span>
              <span><b>{s.name}</b><em>{s.blurb}</em></span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Dataset({ d }) {
  return (
    <div className="panel">
      <div className="stats">
        <Stat v={d.rows} label="monthly rows" />
        <Stat v={d.columns} label="columns" />
        <Stat v={`${d.start} to ${d.end}`} label="coverage" />
        <Stat v={d.gaps.length} label="missing months" />
      </div>
      <p className="hint" style={{ marginTop: 20 }}>
        {d.gaps.length ? `Missing: ${d.gaps.join(", ")}` : "No gaps in the monthly sequence."}
      </p>
      <div className="tbl">
        <table>
          <thead><tr>{Object.keys(d.preview[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>{d.preview.map((r, i) => (
            <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{v ?? "—"}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Clean({ d }) {
  const filled = Object.values(d.missing).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="panel">
        <div className="stats">
          <Stat v={d.duplicates} label="duplicate rows removed" />
          <Stat v={filled} label="blank cells filled" />
          <Stat v={d.repaired.length} label="impossible values repaired" />
          <Stat v={d.flagged.length} label="months flagged by IQR" />
        </div>
      </div>
      <div className="panel">
        <h3>Arrivals after cleaning</h3>
        <p className="hint">The drop from March 2020 is real. It stays in the data.</p>
        <Series data={d.series} keys={["arrivals"]} />
      </div>
      {d.repaired.length > 0 && (
        <div className="panel">
          <h3>Repaired as entry errors</h3>
          <p className="hint">These values are physically or practically impossible, so they were treated as missing and interpolated.</p>
          <div className="tags">{d.repaired.map((r, i) => (
            <span className="chip warn" key={i}>{r.date} · {r.column} = {n0(r.value)}</span>
          ))}</div>
        </div>
      )}
    </>
  );
}

function Features({ d }) {
  const label = { selected: ["ok", "selected"], vif: ["warn", "dropped by VIF"], filter: ["no", "failed filter"] };
  return (
    <>
      <div className="panel tbl">
        <table>
          <thead><tr><th>Feature</th><th>Spearman ρ</th><th>p-value</th><th>Result</th></tr></thead>
          <tbody>{d.rows.map((r) => (
            <tr key={r.feature}>
              <td>{r.feature}</td>
              <td><span className={`rho ${r.rho < 0 ? "neg" : ""}`} style={{ width: Math.abs(r.rho ?? 0) * 120 }} />{n2(r.rho)}</td>
              <td>{r.p == null ? "n/a" : r.p < 0.001 ? "<0.001" : r.p.toFixed(3)}</td>
              <td><span className={`chip ${label[r.status][0]}`}>{label[r.status][1]}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Selected features</h3>
        <div className="tags">{d.selected.map((f) => <span className="chip ok" key={f}>{f}</span>)}</div>
        {d.vif_log.length > 0 && (
          <p className="hint" style={{ marginTop: 16 }}>
            VIF removals, in order: {d.vif_log.map((v) => `${v.feature} (${v.vif.toFixed(1)})`).join(", ")}
          </p>
        )}
      </div>
    </>
  );
}

function Prepare({ d }) {
  return (
    <div className="panel">
      <div className="split">
        <div style={{ flex: d.train_rows, background: "#0F7C86", color: "#fff" }}>Train · {d.train_rows}</div>
        <div style={{ flex: d.test_rows, background: "#F2B138" }}>Test · {d.test_rows}</div>
      </div>
      <p className="hint">Train {d.train_range.join(" to ")}. Test {d.test_range.join(" to ")}. Split in time order, never shuffled.</p>
      <div className="stats">
        <Stat v={d.train_windows} label="training windows" />
        <Stat v={d.test_windows} label="test windows" />
        <Stat v={d.lookback} label="months of lookback" />
      </div>
    </div>
  );
}

function Train({ d }) {
  return (
    <>
      <div className="panel">
        <div className="stats">
          <Stat v={d.params.units} label="LSTM units" />
          <Stat v={d.params.dropout} label="dropout" />
          <Stat v={d.params.batch_size} label="batch size" />
          <Stat v={d.val_loss.toFixed(4)} label="best validation loss" />
        </div>
      </div>
      <div className="panel">
        <h3>Learning curve</h3>
        <p className="hint">Teal is training loss, amber is validation loss. If amber climbs while teal falls, the model is overfitting.</p>
        <Loss data={d.history} />
      </div>
    </>
  );
}

function Evaluate({ d }) {
  const rows = ["MAE", "RMSE", "MAPE", "R2"];
  const names = Object.keys(d.metrics);
  const best = (r) => names.reduce((a, b) => {
    const better = r === "R2" ? d.metrics[b][r] > d.metrics[a][r] : d.metrics[b][r] < d.metrics[a][r];
    return better ? b : a;
  });
  return (
    <>
      <div className="panel">
        <div className="tbl">
          <table>
            <thead><tr><th>Metric</th>{names.map((n) => <th key={n}>{n}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r}><td>{r}</td>{names.map((n) => (
                <td key={n} className={best(r) === n ? "best" : ""}>{r === "MAPE" ? n2(d.metrics[n][r]) + "%" : r === "R2" ? n2(d.metrics[n][r]) : n0(d.metrics[n][r])}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 14 }}>Shaded cells are best in their row. If the LSTM doesn't win, that is a real finding to report.</p>
      </div>
      <div className="panel">
        <h3>Test months</h3>
        <p className="hint">Solid area is actual, amber is the LSTM, dashed is seasonal naive.</p>
        <Series data={d.chart} keys={["actual", "LSTM", "Seasonal naive"]} />
      </div>
    </>
  );
}

function Explain({ d }) {
  return (
    <>
      <div className="panel">
        <h3>What the model leans on most</h3>
        <p className="hint">Average absolute SHAP value per feature across 20 test forecasts.</p>
        <Bars data={d.global} />
      </div>
      <div className="panel">
        <h3>One forecast, feature by feature</h3>
        <p className="hint">Teal pushed the forecast up, rose pushed it down.</p>
        <Bars data={d.one} signed />
      </div>
      <div className="panel">
        <h3>Dependence: {d.top}</h3>
        <p className="hint">Each dot is one test forecast. Left to right is the scaled reading of the top feature.</p>
        <Dots data={d.dependence} />
      </div>
    </>
  );
}

function Forecast() {
  const [w, setW] = useState(null);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/window").then(setW).catch((e) => setErr(e.message)); }, []);
  const edit = (i, j, v) => setW((x) => ({ ...x, rows: x.rows.map((r, a) => (a === i ? r.map((c, b) => (b === j ? v : c)) : r)) }));
  async function go() {
    setErr("");
    try { setOut(await api("/api/forecast", { rows: w.rows.map((r) => r.map(Number)) })); }
    catch (e) { setErr(e.message); }
  }
  if (err && !w) return <div className="err" role="alert">{err}</div>;
  if (!w) return <p className="hint">Loading the latest twelve months…</p>;
  return (
    <>
      <div className="grid" style={{ marginTop: 8 }}>
        <table>
          <thead><tr><th>Month</th>{w.features.map((f) => <th key={f}>{f}</th>)}</tr></thead>
          <tbody>{w.rows.map((r, i) => (
            <tr key={i}><td>{w.dates[i]}</td>{r.map((v, j) => (
              <td key={j}><input type="number" step="any" value={v} onChange={(e) => edit(i, j, e.target.value)} aria-label={`${w.features[j]} ${w.dates[i]}`} /></td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 20 }}><button className="btn" onClick={go}>Forecast {w.next_month}</button></div>
      {err && <div className="err" role="alert">{err}</div>}
      {out && (
        <div className="panel">
          <p className="hint">Predicted arrivals for {w.next_month}</p>
          <div className="result">{n0(out.arrivals)}</div>
        </div>
      )}
    </>
  );
}

const pct = (v) => `${(v * 100).toFixed(0)}%`;
const sgn = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);

function corr(pts) {
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

// Every sentence below is computed from the stage results in `data`.
function buildReport(data) {
  const { prepare: pr, train: tr, evaluate: ev, explain: ex, features: ft, clean: cl } = data;
  const m = ev.metrics, L = m.LSTM, S = m["Seasonal naive"], N = m.Naive;
  const sections = [];

  // 1. Setup
  const h = tr?.history ?? [];
  const last = h[h.length - 1];
  sections.push({ title: "How the model was set up", text: [
    pr && `The model trained on ${pr.train_rows} months (${pr.train_range[0]} to ${pr.train_range[1]}) and was tested on ${pr.test_rows} months (${pr.test_range[0]} to ${pr.test_range[1]}): a ${Math.round(pr.ratio * 100)}/${Math.round((1 - pr.ratio) * 100)} chronological split with a ${pr.lookback}-month lookback, which left ${pr.test_windows} test windows.`,
    tr && `The best configuration was ${tr.params.units} LSTM units, dropout ${tr.params.dropout} and batch size ${tr.params.batch_size}, with a validation loss of ${tr.val_loss.toFixed(4)}. Training ran for ${h.length} epochs.${last ? ` At the last epoch the validation loss was ${(last.val_loss / last.loss).toFixed(1)} times the training loss${last.val_loss > 2 * last.loss ? ", a sign of overfitting" : ""}.` : ""}`,
    ft && `${ft.selected.length} of ${ft.rows.length} candidate features were kept: ${ft.selected.join(", ")}.`,
  ].filter(Boolean).join(" ") });

  // 2. What the model leans on
  const total = ex.global.reduce((a, g) => a + g.value, 0);
  const top = ex.global.slice(0, 3);
  const rho = (f) => ft?.rows.find((r) => r.feature === f)?.rho;
  const weak = ex.global.filter((g) => g.value / total < 0.03).map((g) => g.name);
  const dirs = top.filter((t) => rho(t.name) != null).map((t) =>
    `${t.name} (ρ = ${sgn(rho(t.name))}, so higher readings went with ${rho(t.name) >= 0 ? "higher" : "lower"} arrivals in the data)`);
  sections.push({ title: "What the model leans on", text: [
    `The most influential features were ${top.map((t) => `${t.name} (${pct(t.value / total)} of total importance)`).join(", ")}. Together they account for ${pct(top.reduce((a, t) => a + t.value, 0) / total)} of the average absolute SHAP value.`,
    dirs.length && `Their Spearman correlations with arrivals were: ${dirs.join("; ")}.`,
    weak.length && `Features under 3% importance each: ${weak.join(", ")}.`,
  ].filter(Boolean).join(" ") });

  // 3. Direction and one forecast
  const pts = ex.dependence.filter((p) => p.x != null && p.y != null);
  const c = corr(pts);
  const one = ex.one[0];
  sections.push({ title: "What the SHAP plots show", text: [
    c == null
      ? `The dependence plot for ${ex.top} has too little variation to read a trend.`
      : `In the dependence plot for ${ex.top}, SHAP values ${c > 0.5 ? "rise as the reading rises" : c < -0.5 ? "fall as the reading rises" : "show no clear trend against the reading"} (r = ${sgn(c)} across ${pts.length} test forecasts).`,
    one && `In the first explained test forecast, the largest push came from ${one.name}, moving the forecast ${one.value >= 0 ? "up" : "down"} by ${Math.abs(one.value).toFixed(3)} in scaled units.`,
  ].filter(Boolean).join(" ") });

  // 4. Performance
  const [baseName, base] = S.RMSE < N.RMSE ? ["Seasonal naive", S] : ["Naive", N];
  const beat = L.RMSE < base.RMSE;
  const diff = Math.abs(1 - L.RMSE / base.RMSE);
  const worst = ev.chart.reduce((a, r) => (Math.abs(r.actual - r.LSTM) > Math.abs(a.actual - a.LSTM) ? r : a), ev.chart[0]);
  sections.push({ title: "How it did against the baselines", text: [
    `On the test months the LSTM scored MAE ${n0(L.MAE)}, RMSE ${n0(L.RMSE)}, MAPE ${n2(L.MAPE)}% and R² ${n2(L.R2)}.`,
    `The stronger baseline was ${baseName} (RMSE ${n0(base.RMSE)}). The LSTM ${beat ? `beat it on RMSE, which was ${pct(diff)} lower` : `did not beat it on RMSE, which was ${pct(diff)} higher`}.`,
    L.R2 < 0 && "A negative R² means the model predicted worse than simply using the average of the test months.",
    worst && `The largest miss was ${worst.date}: predicted ${n0(worst.LSTM)} against an actual ${n0(worst.actual)}.`,
  ].filter(Boolean).join(" ") });

  // 5. Limits
  const inTest = cl && pr ? cl.flagged.filter((f) => f.date >= pr.test_range[0] && f.date <= pr.test_range[1]).length : null;
  const inTrain = cl && pr ? cl.flagged.filter((f) => f.date <= pr.train_range[1]).length : null;
  sections.push({ title: "What these results do not tell us", text: [
    pr && `Only ${pr.test_windows} test windows were scored, so each metric moves noticeably with a few months.`,
    inTest != null && `${inTest} months flagged as outliers fall inside the test range and ${inTrain} inside the training range, so unusual months shape both the fit and the score.`,
    ft?.vif_log.length ? `VIF removed ${ft.vif_log.map((v) => v.feature).join(", ")}; the features that stayed may carry part of their effect, so importance is shared among correlated readings.` : "",
    `SHAP was computed on the first ${ex.dependence.length} test windows. It describes what this model learned, not what causes arrivals to change.`,
  ].filter(Boolean).join(" ") });

  return sections;
}

function Interpret({ data, onGenerate }) {
  const ready = data.evaluate && data.explain;
  const rep = data.interpret && typeof data.interpret === "object" ? data.interpret : null;
  const missing = [!data.evaluate && "Evaluate", !data.explain && "Explain"].filter(Boolean);
  const [copied, setCopied] = useState(false);
  const generate = () => onGenerate({ at: new Date().toLocaleString(), sections: buildReport(data) });
  const copy = async () => {
    const md = "## Interpretation\n\n" + rep.sections.map((s) => `### ${s.title}\n\n${s.text}`).join("\n\n") + "\n";
    try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };
  return (
    <>
      <div className="row">
        <button className="btn" onClick={generate} disabled={!ready}>
          {rep ? "Regenerate interpretation" : "Generate interpretation"}
        </button>
        {rep && <button className="ghost" onClick={copy}>{copied ? "Copied" : "Copy as Markdown"}</button>}
      </div>
      {!ready && <p className="hint" style={{ marginTop: 12 }}>Run {missing.join(" and ")} first, then come back and press Generate.</p>}
      {ready && !rep && <p className="hint" style={{ marginTop: 12 }}>Your results are ready. Press Generate to write the interpretation from them.</p>}

      {rep && (
        <div className="interp">
          <div>
            <p className="hint">Generated from your current results at {rep.at}.</p>
            {rep.sections.map((s) => (
              <div className="field" key={s.title}>
                <span>{s.title}</span>
                <p className="readout">{s.text}</p>
              </div>
            ))}
          </div>
          <aside>
            <div className="panel">
              <h3>Top predictors</h3>
              <p className="hint">Average absolute SHAP value.</p>
              <Bars data={data.explain.global.slice(0, 6)} height={240} />
            </div>
            <div className="panel tbl">
              <h3>Test scores</h3>
              <table>
                <thead><tr><th></th><th>RMSE</th><th>MAPE</th></tr></thead>
                <tbody>{Object.entries(data.evaluate.metrics).map(([name, v]) => (
                  <tr key={name}><td>{name}</td><td>{n0(v.RMSE)}</td><td>{n2(v.MAPE)}%</td></tr>
                ))}</tbody>
              </table>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
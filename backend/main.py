"""Tourist Arrivals Lab API: the Streamlit pipeline as FastAPI endpoints.
Pipeline state lives in the in-memory dict S (one user, one session)."""
from pathlib import Path
import itertools
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scipy.stats import spearmanr
from sklearn.preprocessing import MinMaxScaler
from statsmodels.stats.outliers_influence import variance_inflation_factor

DATA = Path(__file__).parent / "data" / "tourist_arrivals.csv"
LOOKBACK = 12
CANDIDATES = [
    "quarter", "is_holiday_peak", "temp_mean_c", "temp_min_c", "temp_max_c",
    "rainfall_mm", "rainy_days", "humidity_pct", "typhoon_count",
    "typhoon_max_wind_kt", "storm_signal_days", "pm25_ugm3", "wave_height_m",
    "season_code", "monsoon_code",
]
S: dict = {}

app = FastAPI(title="Arrivals Lab API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])


def need(*keys):
    for k in keys:
        if k not in S:
            raise HTTPException(400, "Run the earlier stages first, in order.")


def num(x):
    x = float(x)
    return None if np.isnan(x) or np.isinf(x) else x


def month(d):
    return pd.Timestamp(d).strftime("%Y-%m")


def series(df):
    return [{"date": month(d), "arrivals": num(a)} for d, a in zip(df["date"], df["arrivals"])]


@app.post("/api/load")
def load():
    if not DATA.exists():
        raise HTTPException(404, f"Put tourist_arrivals.csv in {DATA.parent}")
    with open(DATA, encoding="utf-8-sig") as f:
        skip = next(i for i, line in enumerate(f) if line.strip().lower().startswith("date,"))
    df = pd.read_csv(DATA, skiprows=skip, encoding="utf-8-sig")
    df.columns = df.columns.str.strip().str.lower()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    S.clear()
    S["raw"] = df
    gaps = pd.date_range(df.date.min(), df.date.max(), freq="MS").difference(df["date"])
    cols = ["date", "season", "rainfall_mm", "typhoon_count", "arrivals"]
    prev = df[cols].head(6).astype(object).where(df[cols].head(6).notna(), None)
    prev["date"] = [month(d) for d in df["date"].head(6)]
    return {"rows": len(df), "columns": len(df.columns), "start": month(df.date.min()),
            "end": month(df.date.max()), "gaps": [month(g) for g in gaps],
            "preview": prev.to_dict("records")}


@app.post("/api/clean")
def clean():
    need("raw")
    df = S["raw"].copy()
    dups = int(df.duplicated("date").sum())
    df = df.drop_duplicates("date", keep="first").sort_values("date").reset_index(drop=True)
    missing = {c: int(n) for c, n in df.isna().sum().items() if n > 0}
    repaired = []
    for col, limit in [("temp_min_c", 40), ("temp_max_c", 50), ("arrivals", 5_000_000)]:
        bad = df[col] > limit
        repaired += [{"date": month(d), "column": col, "value": num(v)}
                     for d, v in zip(df.loc[bad, "date"], df.loc[bad, col])]
        df.loc[bad, col] = np.nan
    cols = df.select_dtypes("number").columns
    df[cols] = df[cols].interpolate(limit_direction="both")
    df["season_code"] = df["season"].map({"Dry": 0, "Transition": 1, "Wet": 2})
    df["monsoon_code"] = df["monsoon"].astype("category").cat.codes
    q1, q3 = df["arrivals"].quantile([0.25, 0.75])
    iqr = q3 - q1
    out = df[(df.arrivals < q1 - 1.5 * iqr) | (df.arrivals > q3 + 1.5 * iqr)]
    S["clean"] = df
    return {"duplicates": dups, "missing": missing, "repaired": repaired,
            "flagged": [{"date": month(d), "arrivals": num(a)} for d, a in zip(out.date, out.arrivals)],
            "series": series(df)}


@app.post("/api/features")
def features():
    need("clean")
    df = S["clean"]
    rows = []
    for c in CANDIDATES:
        rho, p = spearmanr(df[c], df["arrivals"])
        rows.append({"feature": c, "rho": num(rho), "p": num(p),
                     "passed": bool(num(rho) is not None and abs(rho) > 0.10 and p < 0.05)})
    kept = [r["feature"] for r in rows if r["passed"]]
    if not kept:
        raise HTTPException(400, "The Spearman filter kept no features. Re-run Clean.")
    X = df[kept].astype(float)
    log = []
    while X.shape[1] > 1:
        v = [variance_inflation_factor(X.values, i) for i in range(X.shape[1])]
        if max(v) < 5:
            break
        drop = X.columns[int(np.argmax(v))]
        log.append({"feature": drop, "vif": num(max(v))})
        X = X.drop(columns=[drop])
    S["features"] = list(X.columns)
    dropped = {l["feature"] for l in log}
    for r in rows:
        r["status"] = "selected" if r["feature"] in X.columns else ("vif" if r["feature"] in dropped else "filter")
    return {"rows": rows, "vif_log": log, "selected": S["features"]}


class PrepareIn(BaseModel):
    train_ratio: float = 0.8


def windows(X, y, n):
    return (np.array([X[i:i + n] for i in range(len(X) - n)]),
            np.array([y[i + n] for i in range(len(X) - n)]))


@app.post("/api/prepare")
def prepare(body: PrepareIn):
    need("clean", "features")
    df, cols = S["clean"], S["features"]
    split = int(len(df) * body.train_ratio)
    tr, te = df.iloc[:split], df.iloc[split:]
    if len(te) <= LOOKBACK:
        raise HTTPException(400, "Test set is too small for a 12-month lookback. Lower the train ratio.")
    S["sx"] = MinMaxScaler().fit(tr[cols])  # train rows only
    S["sy"] = MinMaxScaler().fit(tr[["arrivals"]])
    S["Xtr"], S["ytr"] = windows(S["sx"].transform(tr[cols]), S["sy"].transform(tr[["arrivals"]]), LOOKBACK)
    S["Xte"], S["yte"] = windows(S["sx"].transform(te[cols]), S["sy"].transform(te[["arrivals"]]), LOOKBACK)
    S["test_df"] = te
    return {"ratio": body.train_ratio, "train_rows": len(tr), "test_rows": len(te),
            "train_range": [month(tr.date.min()), month(tr.date.max())],
            "test_range": [month(te.date.min()), month(te.date.max())],
            "train_windows": len(S["Xtr"]), "test_windows": len(S["Xte"]), "lookback": LOOKBACK}


@app.post("/api/train")
def train():
    need("Xtr")
    import tensorflow as tf
    from tensorflow.keras import Input, Sequential
    from tensorflow.keras.callbacks import EarlyStopping
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    tf.random.set_seed(42)
    L, F = S["Xtr"].shape[1:]
    best = {"loss": float("inf")}
    for units, drop, bs in itertools.product([32, 64], [0.1, 0.3], [16, 32]):
        m = Sequential([Input(shape=(L, F)), LSTM(units), Dropout(drop), Dense(1)])
        m.compile(optimizer="adam", loss="mse")
        h = m.fit(S["Xtr"], S["ytr"], validation_split=0.15, epochs=100, batch_size=bs,
                  callbacks=[EarlyStopping(patience=8, restore_best_weights=True)], verbose=0)
        v = min(h.history["val_loss"])
        if v < best["loss"]:
            best = {"loss": v, "model": m, "hist": h.history,
                    "params": {"units": units, "dropout": drop, "batch_size": bs}}
    S["model"] = best["model"]
    return {"params": best["params"], "val_loss": best["loss"],
            "history": [{"epoch": i + 1, "loss": a, "val_loss": b}
                        for i, (a, b) in enumerate(zip(best["hist"]["loss"], best["hist"]["val_loss"]))]}


def score(a, p):
    ss = np.sum((a - a.mean()) ** 2)
    return {"MAE": num(np.mean(np.abs(a - p))), "RMSE": num(np.sqrt(np.mean((a - p) ** 2))),
            "MAPE": num(np.mean(np.abs((a - p) / a)) * 100), "R2": num(1 - np.sum((a - p) ** 2) / ss)}


@app.post("/api/evaluate")
def evaluate():
    need("model")
    n = len(S["Xte"])
    pred = S["sy"].inverse_transform(S["model"].predict(S["Xte"], verbose=0)).ravel()
    actual = S["sy"].inverse_transform(S["yte"]).ravel()
    te = S["test_df"]
    y = te["arrivals"].to_numpy()
    naive = np.array([y[i + LOOKBACK - 1] for i in range(n)])
    seasonal = np.array([y[i + LOOKBACK - 12] for i in range(n)])
    dates = te["date"].iloc[LOOKBACK:].tolist()
    return {"metrics": {"LSTM": score(actual, pred), "Naive": score(actual, naive),
                        "Seasonal naive": score(actual, seasonal)},
            "chart": [{"date": month(d), "actual": num(a), "LSTM": num(p), "Seasonal naive": num(s)}
                      for d, a, p, s in zip(dates, actual, pred, seasonal)]}


@app.post("/api/explain")
def explain():
    need("model")
    import shap
    np.random.seed(0)
    model, cols = S["model"], S["features"]
    L, F = S["Xtr"].shape[1:]

    def f(flat):
        return model.predict(flat.reshape(-1, L, F), verbose=0).reshape(-1)

    bg = S["Xtr"][np.random.choice(len(S["Xtr"]), min(50, len(S["Xtr"])), replace=False)]
    sample = S["Xte"][:20]
    ex = shap.KernelExplainer(f, shap.kmeans(bg.reshape(len(bg), -1), 10))
    sv = np.array(ex.shap_values(sample.reshape(len(sample), -1), nsamples=100)).reshape(len(sample), L, F)
    g = np.abs(sv).mean(axis=(0, 1))
    top = int(np.argmax(g))
    one = sv[0].sum(axis=0)
    return {"top": cols[top],
            "global": sorted([{"name": c, "value": num(v)} for c, v in zip(cols, g)], key=lambda r: -r["value"]),
            "one": sorted([{"name": c, "value": num(v)} for c, v in zip(cols, one)], key=lambda r: -abs(r["value"])),
            "dependence": [{"x": num(sample[i, -1, top]), "y": num(sv[i, -1, top])} for i in range(len(sample))]}


@app.get("/api/window")
def window():
    need("model", "clean")
    df, cols = S["clean"], S["features"]
    tail = df.tail(LOOKBACK)
    nxt = df["date"].max() + pd.offsets.MonthBegin(1)
    return {"features": cols, "dates": [month(d) for d in tail["date"]],
            "rows": tail[cols].astype(float).round(2).values.tolist(), "next_month": month(nxt)}


class ForecastIn(BaseModel):
    rows: list[list[float]]


@app.post("/api/forecast")
def forecast(body: ForecastIn):
    need("model")
    cols = S["features"]
    X = S["sx"].transform(pd.DataFrame(body.rows, columns=cols)).reshape(1, LOOKBACK, len(cols))
    p = S["sy"].inverse_transform(S["model"].predict(X, verbose=0))
    return {"arrivals": float(p[0, 0])}

@app.get("/api/overview")
def overview():
    if not DATA.exists():
        raise HTTPException(404, "Dataset not found")
    with open(DATA, encoding="utf-8-sig") as f:
        skip = next(i for i, line in enumerate(f) if line.strip().lower().startswith("date,"))
    df = pd.read_csv(DATA, skiprows=skip, encoding="utf-8-sig")
    df.columns = df.columns.str.strip().str.lower()
    df["date"] = pd.to_datetime(df["date"])
    df = df.drop_duplicates("date").sort_values("date").reset_index(drop=True)
    df.loc[df["arrivals"] > 5_000_000, "arrivals"] = np.nan
    df["arrivals"] = df["arrivals"].interpolate(limit_direction="both")
    peak = df.loc[df["arrivals"].idxmax()]
    return {"series": series(df), "months": len(df), "start": month(df.date.min()),
            "end": month(df.date.max()), "peak_month": month(peak["date"]),
            "peak": num(peak["arrivals"]), "predictors": len(CANDIDATES)}

@app.post("/api/reset")
def reset():
    S.clear()
    return {"ok": True}
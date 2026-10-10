# pages/4_Prepare.py
import streamlit as st
import numpy as np
from sklearn.preprocessing import MinMaxScaler

st.title("4. Prevent leakage and prepare sequences")

if "selected_features" not in st.session_state:
    st.warning("Run the Features page first.")
    st.stop()

LOOKBACK = 12  # one year of history feeding each prediction

train_ratio = st.slider("Train split ratio", min_value=0.60, max_value=0.95, value=0.80, step=0.05)
st.caption(
    f"{train_ratio:.0%} train / {1 - train_ratio:.0%} test, split chronologically — "
    "no shuffling (Module 2 §7). Earliest rows train the model; the most recent rows test it."
)


def make_sequences(X, y, lookback):
    Xs, ys = [], []
    for i in range(len(X) - lookback):
        Xs.append(X[i:i + lookback])
        ys.append(y[i + lookback])
    return np.array(Xs), np.array(ys)


if st.button("Run"):
    df = st.session_state.clean_df
    split_idx = int(len(df) * train_ratio)  # chronological split — no shuffling
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    cols = st.session_state.selected_features
    st.session_state.scaler_X = MinMaxScaler().fit(train_df[cols])          # TRAIN ONLY
    st.session_state.scaler_y = MinMaxScaler().fit(train_df[["arrivals"]])  # TRAIN ONLY

    train_X = st.session_state.scaler_X.transform(train_df[cols])
    test_X = st.session_state.scaler_X.transform(test_df[cols])
    train_y = st.session_state.scaler_y.transform(train_df[["arrivals"]])
    test_y = st.session_state.scaler_y.transform(test_df[["arrivals"]])

    st.session_state.X_train_seq, st.session_state.y_train_seq = make_sequences(train_X, train_y, LOOKBACK)
    st.session_state.X_test_seq, st.session_state.y_test_seq = make_sequences(test_X, test_y, LOOKBACK)
    st.session_state.test_df = test_df  # kept for the Evaluate page's naive baselines

    st.session_state.prepare_report = {
        "train_ratio": train_ratio,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "train_range": (train_df["date"].min().date(), train_df["date"].max().date()),
        "test_range": (test_df["date"].min().date(), test_df["date"].max().date()),
        "train_windows": len(st.session_state.X_train_seq),
        "test_windows": len(st.session_state.X_test_seq),
        "lookback": LOOKBACK,
    }

# Displayed outside the button block, so the result is still here if you
# leave this page and come back.
if "prepare_report" in st.session_state:
    r = st.session_state.prepare_report
    st.write(f"Split used: {r['train_ratio']:.0%} train / {1 - r['train_ratio']:.0%} test")
    st.write(f"Train: {r['train_rows']} rows ({r['train_range'][0]} – {r['train_range'][1]})")
    st.write(f"Test: {r['test_rows']} rows ({r['test_range'][0]} – {r['test_range'][1]})")
    st.success(
        f"{r['train_windows']} training windows, {r['test_windows']} test windows, "
        f"lookback = {r['lookback']}"
    )
else:
    st.info('Choose a split ratio above, then click "Run" to prepare the sequences.')
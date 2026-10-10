# pages/6_Evaluate.py
import streamlit as st
import numpy as np
import pandas as pd

st.title("6. Evaluate honestly")

if "model" not in st.session_state:
    st.warning("Run the Train page first.")
    st.stop()

SEASONAL_PERIOD = 12  # months in a year — Module 2 §7's ŷₜ = yₜ₋₁₂


def score(actual, pred):
    mae = float(np.mean(np.abs(actual - pred)))
    rmse = float(np.sqrt(np.mean((actual - pred) ** 2)))
    mape = float(np.mean(np.abs((actual - pred) / actual)) * 100)
    ss_res, ss_tot = np.sum((actual - pred) ** 2), np.sum((actual - actual.mean()) ** 2)
    return {"MAE": mae, "RMSE": rmse, "MAPE": mape, "R2": float(1 - ss_res / ss_tot)}


if st.button("Score on the test set"):
    pred_scaled = st.session_state.model.predict(st.session_state.X_test_seq)
    pred = st.session_state.scaler_y.inverse_transform(pred_scaled)
    actual = st.session_state.scaler_y.inverse_transform(st.session_state.y_test_seq)

    # Both baselines come from test_df's own original, unscaled arrivals
    # column (saved by the Prepare page) — never from X_test_seq, which is
    # already scaled and only holds the selected environmental features, not
    # arrivals itself.
    lookback = st.session_state.X_test_seq.shape[1]
    n_windows = len(st.session_state.X_test_seq)
    test_arrivals = st.session_state.test_df["arrivals"].to_numpy()

    if lookback < SEASONAL_PERIOD:
        st.error(f"Seasonal naive needs a lookback of at least {SEASONAL_PERIOD} months; got {lookback}.")
        st.stop()

    # naive: ŷₜ = yₜ₋₁ — the month right before each window's target
    naive = np.array(
        [test_arrivals[i + lookback - 1] for i in range(n_windows)]
    ).reshape(-1, 1)

    # seasonal naive: ŷₜ = yₜ₋₁₂ — the same calendar month, one year before
    seasonal_naive = np.array(
        [test_arrivals[i + lookback - SEASONAL_PERIOD] for i in range(n_windows)]
    ).reshape(-1, 1)

    st.session_state.evaluate_report = pd.DataFrame({
        "LSTM": score(actual, pred),
        "Naive": score(actual, naive),
        "Seasonal naive": score(actual, seasonal_naive),
    })

# Displayed outside the button block, so the result is still here if you
# leave this page and come back.
if "evaluate_report" in st.session_state:
    st.dataframe(st.session_state.evaluate_report)
else:
    st.info('Click "Score on the test set" to evaluate the trained model.')
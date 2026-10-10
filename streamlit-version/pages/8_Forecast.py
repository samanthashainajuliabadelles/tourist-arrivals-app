# pages/8_Forecast.py
import streamlit as st
import pandas as pd

st.title("8. Forecast")

if "model" not in st.session_state:
    st.warning("Run the Train page first.")
    st.stop()

cols = st.session_state.selected_features
lookback = st.session_state.X_train_seq.shape[1]

# Pre-fill with the real last training window, back in the original units
last_window_scaled = st.session_state.X_train_seq[-1]
last_window = st.session_state.scaler_X.inverse_transform(last_window_scaled)
default_df = pd.DataFrame(last_window, columns=cols)

st.write(f"Edit the last {lookback} months of readings below, then forecast:")
edited = st.data_editor(default_df, num_rows="fixed")

if st.button("Forecast next month"):
    X = st.session_state.scaler_X.transform(edited[cols]).reshape(1, lookback, len(cols))
    pred_scaled = st.session_state.model.predict(X)
    st.session_state.forecast_report = float(st.session_state.scaler_y.inverse_transform(pred_scaled)[0][0])

# Displayed outside the button block, so the result is still here if you
# leave this page and come back.
if "forecast_report" in st.session_state:
    st.success(f"Predicted arrivals: {st.session_state.forecast_report:,.0f}")
else:
    st.info('Edit the table above, then click "Forecast next month".')
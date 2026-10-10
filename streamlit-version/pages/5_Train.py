# pages/5_Train.py
import streamlit as st
import itertools
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

st.title("5. Train and tune the LSTM")

if "X_train_seq" not in st.session_state:
    st.warning("Run the Prepare page first.")
    st.stop()

PARAM_GRID = {"units": [32, 64], "dropout": [0.1, 0.3], "batch_size": [16, 32]}

if st.button("Train & tune"):
    with st.spinner("Training… this can take a while"):
        lookback = st.session_state.X_train_seq.shape[1]
        n_features = st.session_state.X_train_seq.shape[2]
        best_val_loss, best_params, best_model, best_history = float("inf"), None, None, None

        for units, dropout, batch_size in itertools.product(*PARAM_GRID.values()):
            candidate = Sequential([
                LSTM(units, input_shape=(lookback, n_features)),
                Dropout(dropout),
                Dense(1),
            ])
            candidate.compile(optimizer="adam", loss="mse")
            hist = candidate.fit(
                st.session_state.X_train_seq, st.session_state.y_train_seq,
                validation_split=0.15, epochs=100, batch_size=batch_size,
                callbacks=[EarlyStopping(patience=8, restore_best_weights=True)],
                verbose=0,
            )
            val_loss = min(hist.history["val_loss"])
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_params = {"units": units, "dropout": dropout, "batch_size": batch_size}
                best_model, best_history = candidate, hist.history

    st.session_state.model = best_model  # used by every later page
    st.session_state.train_report = {
        "best_params": best_params,
        "val_loss": best_val_loss,
        "loss_history": best_history["loss"],
        "val_loss_history": best_history["val_loss"],
    }

# Displayed outside the button block, so the result is still here if you
# leave this page and come back.
if "train_report" in st.session_state:
    r = st.session_state.train_report
    st.success(f"Best hyperparameters: {r['best_params']} (val_loss = {r['val_loss']:.4f})")
    st.line_chart({"loss": r["loss_history"], "val_loss": r["val_loss_history"]})
else:
    st.info('Click "Train & tune" to fit the LSTM on the sequences from the Prepare page.')
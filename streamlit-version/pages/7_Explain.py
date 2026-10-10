# pages/7_Explain.py
import streamlit as st
import numpy as np
import shap

st.title("7. Explain with SHAP")

if "model" not in st.session_state:
    st.warning("Run the Train page first.")
    st.stop()

if st.button("Compute SHAP values"):
    X_train_seq = st.session_state.X_train_seq
    X_test_seq = st.session_state.X_test_seq
    features = st.session_state.selected_features
    model = st.session_state.model
    lookback, n_features = X_train_seq.shape[1], X_train_seq.shape[2]

    # DeepExplainer/GradientExplainer need custom TF gradients that this
    # TensorFlow version doesn't register for LSTM's internal ops (raises
    # "gradient registry has no entry for: shap_TensorListStack"), so we
    # treat the model as a black box instead.
    def predict_flat(flat_x):
        seq = flat_x.reshape(-1, lookback, n_features)
        return model.predict(seq, verbose=0).reshape(-1)

    background = X_train_seq[np.random.choice(len(X_train_seq), 50, replace=False)]
    background_summary = shap.kmeans(background.reshape(len(background), -1), 10)

    test_sample = X_test_seq[:20]
    explainer = shap.KernelExplainer(predict_flat, background_summary)
    shap_values = explainer.shap_values(
        test_sample.reshape(len(test_sample), -1), nsamples=100
    ).reshape(len(test_sample), lookback, n_features)

    mean_abs = np.abs(shap_values).mean(axis=(0, 1))
    top_idx = int(np.argmax(mean_abs))

    st.session_state.explain_report = {
        "global_importance": dict(zip(features, mean_abs.tolist())),
        "one_forecast": dict(zip(features, shap_values[0].sum(axis=0).tolist())),
        "top_feature": features[top_idx],
        "dependence": {
            "value": [float(X_test_seq[i, -1, top_idx]) for i in range(len(shap_values))],
            "shap": [float(shap_values[i][-1, top_idx]) for i in range(len(shap_values))],
        },
    }

# Displayed outside the button block, so the result is still here if you
# leave this page and come back.
if "explain_report" in st.session_state:
    r = st.session_state.explain_report
    st.subheader("Global feature importance")
    st.bar_chart(r["global_importance"])
    st.subheader("One forecast — feature contributions")
    st.bar_chart(r["one_forecast"])
    st.subheader(f"Dependence plot — {r['top_feature']}")
    st.scatter_chart(r["dependence"], x="value", y="shap")
else:
    st.info('Click "Compute SHAP values" to explain the trained model\'s predictions.')
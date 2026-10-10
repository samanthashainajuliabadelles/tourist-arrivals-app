# pages/2_Clean.py
import streamlit as st

st.title("2. Clean the data")

if "raw_df" not in st.session_state:
    st.warning("Run the Dataset page first.")
    st.stop()

if st.button("Run cleaning"):
    df = st.session_state.raw_df.copy()

    duplicates_removed = int(df.duplicated(subset="date").sum())
    df = df.drop_duplicates(subset="date", keep="first")

    missing = df.isna().sum()
    missing = missing[missing > 0]

    q1, q3 = df["arrivals"].quantile([0.25, 0.75])
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    flagged = df[(df["arrivals"] < lower) | (df["arrivals"] > upper)]

    import numpy as np   # at the top of the file

    df = df.drop_duplicates(subset="date", keep="first")
    df = df.sort_values("date").reset_index(drop=True)

    # impossible values -> missing
    df.loc[df["temp_min_c"] > 40, "temp_min_c"] = np.nan
    df.loc[df["temp_max_c"] > 50, "temp_max_c"] = np.nan
    df.loc[df["arrivals"] > 5_000_000, "arrivals"] = np.nan

    # fill all gaps
    num_cols = df.select_dtypes("number").columns
    df[num_cols] = df[num_cols].interpolate(method="linear", limit_direction="both")

    # encodings
    df["season_code"] = df["season"].map({"Dry": 0, "Transition": 1, "Wet": 2})
    df["monsoon_code"] = df["monsoon"].astype("category").cat.codes

    st.session_state.clean_df = df  # used by every later page
    st.session_state.clean_report = {
        "duplicates_removed": duplicates_removed,
        "missing": missing,
        "flagged": flagged[["date", "arrivals"]],
    }

# Displayed outside the button block, so the result is still here if you
# leave this page and come back.
if "clean_report" in st.session_state:
    report = st.session_state.clean_report
    st.write(f"Duplicates removed: {report['duplicates_removed']}")
    st.write("Missing values by column:")
    st.dataframe(report["missing"])
    st.write("Flagged outliers:")
    st.dataframe(report["flagged"])
else:
    st.info('Click "Run cleaning" to process the dataset loaded on the Dataset page.')
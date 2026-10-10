# pages/1_Dataset.py
import streamlit as st
import pandas as pd

st.title("1. Dataset summary")

if "raw_df" not in st.session_state:
    # find the line that starts the real header (date,year,month,...)
    with open("data/tourist_arrivals.csv", encoding="utf-8-sig") as f:
        header_row = next(
            i for i, line in enumerate(f) if line.strip().lower().startswith("date,")
        )
    df = pd.read_csv("data/tourist_arrivals.csv", skiprows=header_row, encoding="utf-8-sig")
    df.columns = df.columns.str.strip().str.lower()
    df["date"] = pd.to_datetime(df["date"])
    st.session_state.raw_df = df.sort_values("date").reset_index(drop=True)

df = st.session_state.raw_df
st.write(f"{len(df)} rows, {len(df.columns)} columns")
st.dataframe(df.head())

expected = pd.date_range(df["date"].min(), df["date"].max(), freq="MS")
missing_months = expected.difference(df["date"])
if len(missing_months):
    st.warning(f"Missing months: {list(missing_months)}")
else:
    st.success("No gaps in the monthly sequence.")

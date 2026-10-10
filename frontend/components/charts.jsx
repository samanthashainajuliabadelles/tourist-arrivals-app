"use client";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, ScatterChart, Scatter } from "recharts";

const C = { lagoon: "#0F7C86", mango: "#F2B138", hibiscus: "#C93C5A", line: "#CFE0DD", muted: "#52737A" };
export const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
const tip = { borderRadius: 12, border: "1px solid #CFE0DD", fontSize: 13 };
const axis = { stroke: C.muted, fontSize: 12, tickLine: false, axisLine: false };

// First key is drawn as a filled area (the "tide line"); the rest as lines.
export function Series({ data, keys, height = 300 }) {
  const colors = [C.lagoon, C.mango, C.hibiscus];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="tide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.lagoon} stopOpacity={0.35} />
            <stop offset="100%" stopColor={C.lagoon} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="date" {...axis} minTickGap={48} />
        <YAxis {...axis} tickFormatter={short} width={44} />
        <Tooltip contentStyle={tip} formatter={(v) => Number(v).toLocaleString()} />
        {keys.map((k, i) =>
          i === 0 ? (
            <Area key={k} dataKey={k} stroke={colors[0]} strokeWidth={2.5} fill="url(#tide)" dot={false} />
          ) : (
            <Line key={k} dataKey={k} stroke={colors[i]} strokeWidth={2.5} dot={false}
              strokeDasharray={i === 2 ? "5 4" : undefined} />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, signed = false, height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 40, right: 16 }}>
        <CartesianGrid stroke={C.line} horizontal={false} />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="name" {...axis} width={130} />
        <Tooltip contentStyle={tip} formatter={(v) => Number(v).toFixed(4)} />
        <Bar dataKey="value" radius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={signed && d.value < 0 ? C.hibiscus : C.lagoon} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Dots({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ left: 0, right: 16, top: 8 }}>
        <CartesianGrid stroke={C.line} />
        <XAxis type="number" dataKey="x" name="scaled value" {...axis} domain={[0, 1]} />
        <YAxis type="number" dataKey="y" name="SHAP" {...axis} width={50} />
        <Tooltip contentStyle={tip} />
        <Scatter data={data} fill={C.lagoon} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function Loss({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="epoch" {...axis} />
        <YAxis {...axis} width={50} />
        <Tooltip contentStyle={tip} />
        <Line dataKey="loss" stroke={C.lagoon} strokeWidth={2.5} dot={false} />
        <Line dataKey="val_loss" stroke={C.mango} strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

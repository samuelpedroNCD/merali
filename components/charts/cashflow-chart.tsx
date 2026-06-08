"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function CashflowChart({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A227" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#C9A227" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B25C46" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#B25C46" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
        <XAxis dataKey="month" stroke="var(--c-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--c-muted)" fontSize={12} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            borderRadius: 11,
            fontSize: 13,
            color: "var(--c-text)",
          }}
          formatter={(v) => `£${Number(v).toLocaleString("en-GB")}`}
        />
        <Area type="monotone" dataKey="income" stroke="#C9A227" strokeWidth={2} fill="url(#incomeFill)" />
        <Area type="monotone" dataKey="expense" stroke="#B25C46" strokeWidth={2} fill="url(#expenseFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

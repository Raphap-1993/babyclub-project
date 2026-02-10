"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SimpleBarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  dataKeys: Array<{ key: string; color: string }>;
  height?: number;
}

export function SimpleBarChart({ data, dataKeys, height = 300 }: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} />
        <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            border: "2px solid #475569",
            borderRadius: "8px",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "500",
          }}
          labelStyle={{ color: "#ffffff", fontWeight: "600" }}
          itemStyle={{ color: "#e2e8f0" }}
        />
        <Legend wrapperStyle={{ color: "#cbd5e1" }} />
        {dataKeys.map((item) => (
          <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

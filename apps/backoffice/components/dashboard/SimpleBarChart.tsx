"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SimpleBarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  dataKeys?: Array<{ key: string; color: string }>; // ✅ Opcional: auto-detect si no se pasa
  height?: number;
}

export function SimpleBarChart({ data, dataKeys, height = 300 }: SimpleBarChartProps) {
  // Auto-detect dataKeys si no se pasan
  const keys = dataKeys || (data.length > 0 
    ? Object.keys(data[0])
        .filter(k => k !== 'name')
        .map(k => ({ key: k, color: '#3b82f6' })) // Color azul por defecto
    : []
  );

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
        {keys.map((item) => (
          <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

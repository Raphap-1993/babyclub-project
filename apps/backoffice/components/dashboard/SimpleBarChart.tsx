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
        .map(k => ({ key: k, color: '#e11d48' })) // Acento rose por defecto
    : []
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis dataKey="name" stroke="#a3a3a3" style={{ fontSize: "12px" }} />
        <YAxis stroke="#a3a3a3" style={{ fontSize: "12px" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0b0b0b",
            border: "2px solid #3f3f46",
            borderRadius: "8px",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "500",
          }}
          labelStyle={{ color: "#ffffff", fontWeight: "600" }}
          itemStyle={{ color: "#d4d4d8" }}
        />
        <Legend wrapperStyle={{ color: "#a3a3a3" }} />
        {keys.map((item) => (
          <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

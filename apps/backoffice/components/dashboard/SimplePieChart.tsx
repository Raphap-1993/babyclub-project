"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SimplePieChartProps {
  data: Array<{ name: string; value: number }>;
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = ["#e11d48", "#f59e0b", "#10b981", "#f97316", "#d946ef", "#a3a3a3"];

export function SimplePieChart({
  data,
  colors = DEFAULT_COLORS,
  height = 300,
}: SimplePieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius="80%"
          innerRadius="40%"
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
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
      </PieChart>
    </ResponsiveContainer>
  );
}

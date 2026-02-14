"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SimpleLineChartProps {
  data: Array<any>;
  lines?: Array<{ key: string; color: string }>;
  xKey?: string;
  height?: number;
}

export function SimpleLineChart({ data, lines, xKey = "name", height = 300 }: SimpleLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis dataKey={xKey} stroke="#a3a3a3" style={{ fontSize: "12px" }} />
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
        {lines && lines.length > 0
          ? lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={2}
                dot={{ fill: l.color, r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))
          : (
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
        {data[0]?.target !== undefined && (
          <Line
            type="monotone"
            dataKey="target"
            stroke="#737373"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

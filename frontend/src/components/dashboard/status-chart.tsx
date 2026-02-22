"use client";

import { formatCurrency } from "@/lib/utils";

interface StatusSlice {
  label: string;
  value: number;
  color: string;
}

interface StatusChartProps {
  slices: StatusSlice[];
}

export function StatusChart({ slices }: StatusChartProps) {
  const filtered = slices.filter((s) => s.value > 0);
  if (filtered.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
        Noch keine Daten vorhanden
      </div>
    );
  }

  const total = filtered.reduce((s, c) => s + c.value, 0);
  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = 38;
  const innerR = 22;

  let angle = -Math.PI / 2;
  const paths = filtered.map((slice) => {
    const portion = slice.value / total;
    const startAngle = angle;
    const endAngle = angle + portion * 2 * Math.PI;
    angle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);
    const largeArc = portion > 0.5 ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    return { ...slice, d, portion };
  });

  return (
    <div className="flex items-start gap-4">
      <svg width={size} height={size} className="flex-shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} fillOpacity={0.85} />
        ))}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight="600"
          fill="currentColor"
          fillOpacity={0.7}
        >
          {total}
        </text>
      </svg>
      <div className="flex-1 space-y-1.5">
        {filtered.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground flex-1">{s.label}</span>
            <span className="font-medium text-foreground">{s.value}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">Gesamt: </span>
          <span className="text-xs font-medium text-foreground">{total}</span>
        </div>
      </div>
    </div>
  );
}

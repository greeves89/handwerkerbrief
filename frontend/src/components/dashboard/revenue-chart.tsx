"use client";

interface MonthRevenue {
  month: string;
  paid: number;
  open: number;
}

interface RevenueChartProps {
  data: MonthRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0 || data.every((d) => d.paid === 0 && d.open === 0)) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Noch keine Daten vorhanden
      </div>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.paid, d.open]), 1);
  const chartH = 120;
  const barW = 18;
  const gap = 5;
  const groupW = barW * 2 + gap;
  const paddingX = 44;
  const paddingY = 12;
  const chartW = data.length * (groupW + 14) + paddingX + 8;

  const scale = (val: number) => chartH - (val / maxVal) * chartH;
  const ticks = [0, 0.5, 1].map((t) => ({
    val: maxVal * t,
    y: chartH - chartH * t + paddingY,
  }));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartW} ${chartH + paddingY + 26}`}
        className="w-full"
        style={{ minWidth: `${Math.max(chartW, 260)}px` }}
      >
        {/* Grid lines */}
        {ticks.map((tick) => (
          <g key={tick.val}>
            <line
              x1={paddingX}
              y1={tick.y}
              x2={chartW - 4}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={paddingX - 4}
              y={tick.y + 4}
              textAnchor="end"
              fontSize={8}
              fill="currentColor"
              fillOpacity={0.4}
            >
              {tick.val >= 1000
                ? `${(tick.val / 1000).toFixed(0)}k`
                : tick.val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingX + i * (groupW + 14);
          const paidH = (d.paid / maxVal) * chartH;
          const openH = (d.open / maxVal) * chartH;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={scale(d.paid) + paddingY}
                width={barW}
                height={paidH}
                rx={3}
                fill="hsl(var(--success))"
                fillOpacity={0.8}
              />
              <rect
                x={x + barW + gap}
                y={scale(d.open) + paddingY}
                width={barW}
                height={openH}
                rx={3}
                fill="hsl(var(--warning))"
                fillOpacity={0.75}
              />
              <text
                x={x + groupW / 2}
                y={chartH + paddingY + 14}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.5}
              >
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-1 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-success opacity-80" />
          <span className="text-xs text-muted-foreground">Bezahlt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-warning opacity-75" />
          <span className="text-xs text-muted-foreground">Offen</span>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          Letzte {data.length} Monate
        </span>
      </div>
    </div>
  );
}

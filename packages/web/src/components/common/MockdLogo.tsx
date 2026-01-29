import React from "react";

type LogoVariant = "full" | "short";
type LogoSize = "sm" | "md" | "lg" | "xl";

interface MockdLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  accentColor?: boolean;
}

const sizes: Record<LogoVariant, Record<LogoSize, { width: number; height: number; fontSize: number }>> = {
  full: {
    sm: { width: 120, height: 32, fontSize: 20 },
    md: { width: 180, height: 48, fontSize: 30 },
    lg: { width: 240, height: 64, fontSize: 40 },
    xl: { width: 320, height: 80, fontSize: 52 },
  },
  short: {
    sm: { width: 32, height: 32, fontSize: 20 },
    md: { width: 48, height: 48, fontSize: 30 },
    lg: { width: 64, height: 64, fontSize: 40 },
    xl: { width: 80, height: 80, fontSize: 52 },
  },
};

export function MockdLogo({
  variant = "full",
  size = "md",
  className = "",
  accentColor = true,
}: MockdLogoProps) {
  const { width, height, fontSize } = sizes[variant][size];
  const text = variant === "full" ? "mockd" : "m";
  const textY = height * 0.68;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Mockd logo"
    >
      <text
        fontFamily="'JetBrains Mono', monospace"
        fontSize={fontSize}
        fontWeight={500}
        y={textY}
        x={width / 2}
        textAnchor="middle"
      >
        <tspan className="fill-base-content">{text}</tspan>
        <tspan className={accentColor ? "fill-primary" : "fill-base-content"}>_</tspan>
      </text>
    </svg>
  );
}

export function MockdLogoBadge({
  variant = "full",
  size = "md",
  className = "",
  accentColor = true,
}: MockdLogoProps) {
  const { width, height, fontSize } = sizes[variant][size];
  const text = variant === "full" ? "mockd" : "m";
  const padding = height * 0.15;
  const badgeWidth = width + padding * 2;
  const badgeHeight = height + padding * 2;
  const textY = badgeHeight * 0.62;

  return (
    <svg
      viewBox={`0 0 ${badgeWidth} ${badgeHeight}`}
      width={badgeWidth}
      height={badgeHeight}
      className={className}
      role="img"
      aria-label="Mockd logo"
    >
      <rect
        className="fill-base-300"
        width={badgeWidth}
        height={badgeHeight}
        rx={badgeHeight * 0.15}
      />
      <text
        fontFamily="'JetBrains Mono', monospace"
        fontSize={fontSize}
        fontWeight={500}
        y={textY}
        x={badgeWidth / 2}
        textAnchor="middle"
      >
        <tspan className="fill-base-content">{text}</tspan>
        <tspan className={accentColor ? "fill-primary" : "fill-base-content"}>_</tspan>
      </text>
    </svg>
  );
}

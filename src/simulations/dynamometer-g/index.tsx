import { formatDK } from '@/lib/numbers';
import type { SimulationProps } from '@/sim-contract';
import { COLORS, FONT, RADIUS, STROKE, TRANSITION } from '@/simulations/_shared/mekanik/tokens';
import { useMemo } from 'react';
import { meta } from './meta';
import { dynamometerSpec, forceFor, pegReading } from './physics';

// Internal viewBox is fixed; the harness scales the SVG via width/height attrs.
const VB_W = 320;
const VB_H = 520;
const CENTER_X = 160;

// Body geometry (logical viewBox coords).
const BODY_LEFT = 120;
const BODY_RIGHT = 200;
const BODY_TOP = 72;
const BODY_BOTTOM = 420;
const BODY_W = BODY_RIGHT - BODY_LEFT;

// Scale strip lives near the right edge of the body.
const SCALE_X = 170;
const SCALE_TOP = 88;
const SCALE_BOTTOM = 404;
const SCALE_H = SCALE_BOTTOM - SCALE_TOP;
const MAJOR_TICK_LEN = 8;
const MINOR_TICK_LEN = 4;

// Caps + ceiling.
const TOP_CAP = { left: 132, right: 188, top: 54, bottom: 74 };
const BOTTOM_CAP = { left: 132, right: 188, top: 420, bottom: 440 };
const CEILING = { left: 60, right: 260, top: 30, bottom: 40 };
const HATCH_TOP = 10;
const EYE_BOLT_TOP = { cx: CENTER_X, cy: 47, r: 6, holeR: 2.5 };

// Hook + mass badge.
const HOOK = { x: CENTER_X, top: 440, bottom: 452 };
const HOOK_EYE = { cx: CENTER_X, cy: 456, r: 4, holeR: 1.5 };
const BADGE = { left: 130, right: 190, top: 466, bottom: 488 };

// Over-scale break: jagged crack across the body. Bottom half drops by DROP px.
const CRACK_TOP_Y = 376; // jagged edge of the top half
const CRACK_BOT_Y = 384; // jagged edge of the bottom half (before drop)
const DROP = 6;

/** Build a horizontal zigzag polyline between (x1, y) and (x2, y) with `peaks` peaks. */
function zigzag(x1: number, x2: number, y: number, amp: number, peaks: number): string {
  const pts: string[] = [];
  const step = (x2 - x1) / peaks;
  for (let i = 0; i <= peaks; i++) {
    const x = x1 + i * step;
    const dy = i % 2 === 0 ? -amp : amp;
    pts.push(`${x.toFixed(2)},${(y + dy).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Generate major + minor tick positions for a chosen dynamometer scale. */
function tickPositions(scaleMax: number, majorTick: number, minorTick: number) {
  const majors: number[] = [];
  const minors: number[] = [];
  // Use rounded counts to avoid floating-point off-by-one (e.g. 50/10).
  const nMajor = Math.round(scaleMax / majorTick);
  for (let i = 0; i <= nMajor; i++) majors.push(i * majorTick);

  const nMinor = Math.round(scaleMax / minorTick);
  for (let i = 0; i <= nMinor; i++) {
    const v = i * minorTick;
    // Skip values that coincide with a major tick.
    if (majors.some((m) => Math.abs(m - v) < minorTick / 2)) continue;
    minors.push(v);
  }
  return { majors, minors };
}

function DynamometerG_Component({
  width,
  height,
  initialParams,
  onProgress: _onProgress,
  onParamChange: _onParamChange,
}: SimulationProps) {
  const params = useMemo(
    () => ({ ...meta.defaultParams, ...(initialParams ?? {}) }),
    [initialParams],
  );

  const mass = Number(params.mass);
  const dynamometerId = String(params.dynamometer);
  const spec = dynamometerSpec(dynamometerId);

  const force = forceFor(mass);
  const { reading, overScale } = pegReading(force, spec.scaleMax);
  const indicatorY = SCALE_TOP + (reading / spec.scaleMax) * SCALE_H;
  const massSag = (reading / spec.scaleMax) * 6; // 0..6 px downward sag with load

  const { majors, minors } = useMemo(
    () => tickPositions(spec.scaleMax, spec.majorTick, spec.minorTick),
    [spec.scaleMax, spec.majorTick, spec.minorTick],
  );

  const ariaLabel = overScale
    ? `Dynamometer ${spec.label} med ${formatDK(mass, 3)} kg hængende — uden for skala, instrumentet er gået i stykker`
    : `Dynamometer ${spec.label} med ${formatDK(mass, 3)} kg hængende, viser ${formatDK(reading, 3)} N`;

  const valueToY = (v: number) => SCALE_TOP + (v / spec.scaleMax) * SCALE_H;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
      style={{ fontFamily: FONT.family }}
    >
      <defs>
        <pattern
          id="dyn-hatch"
          patternUnits="userSpaceOnUse"
          width={10}
          height={10}
          patternTransform="rotate(-45)"
        >
          <line x1={0} y1={0} x2={0} y2={10} stroke={COLORS.hatch} strokeWidth={STROKE.medium} />
        </pattern>
      </defs>

      {/* Outer card background */}
      <rect
        x={4}
        y={4}
        width={VB_W - 8}
        height={VB_H - 8}
        rx={RADIUS.card}
        fill={COLORS.cardFill}
        stroke={COLORS.cardBorder}
        strokeWidth={STROKE.thin}
      />

      {/* Hatched ceiling band */}
      <rect
        x={CEILING.left}
        y={HATCH_TOP}
        width={CEILING.right - CEILING.left}
        height={CEILING.top - HATCH_TOP}
        fill="url(#dyn-hatch)"
      />
      {/* Ceiling bar */}
      <rect
        x={CEILING.left}
        y={CEILING.top}
        width={CEILING.right - CEILING.left}
        height={CEILING.bottom - CEILING.top}
        rx={2}
        fill={COLORS.navy}
      />

      {/* Eye-bolt loop hanging from ceiling */}
      <line
        x1={CENTER_X}
        y1={CEILING.bottom}
        x2={CENTER_X}
        y2={EYE_BOLT_TOP.cy - EYE_BOLT_TOP.r}
        stroke={COLORS.navy}
        strokeWidth={STROKE.medium}
      />
      <circle cx={EYE_BOLT_TOP.cx} cy={EYE_BOLT_TOP.cy} r={EYE_BOLT_TOP.r} fill={COLORS.navy} />
      <circle
        cx={EYE_BOLT_TOP.cx}
        cy={EYE_BOLT_TOP.cy}
        r={EYE_BOLT_TOP.holeR}
        fill={COLORS.cardFill}
      />

      {/* Top cap with instrument-max label */}
      <rect
        x={TOP_CAP.left}
        y={TOP_CAP.top}
        width={TOP_CAP.right - TOP_CAP.left}
        height={TOP_CAP.bottom - TOP_CAP.top}
        rx={RADIUS.cap}
        fill={COLORS.navy}
      />
      <text
        x={CENTER_X}
        y={TOP_CAP.top + (TOP_CAP.bottom - TOP_CAP.top) / 2 + 4}
        textAnchor="middle"
        fontSize={FONT.cap}
        fontWeight={700}
        fill="#ffffff"
      >
        {spec.label}
      </text>

      {/* Body — single rect when intact, split into two halves when over-scale */}
      {overScale ? (
        <>
          {/* Top half (top corners rounded, bottom edge jagged) */}
          <path
            d={`
              M ${BODY_LEFT},${BODY_TOP + RADIUS.body}
              A ${RADIUS.body},${RADIUS.body} 0 0 1 ${BODY_LEFT + RADIUS.body},${BODY_TOP}
              L ${BODY_RIGHT - RADIUS.body},${BODY_TOP}
              A ${RADIUS.body},${RADIUS.body} 0 0 1 ${BODY_RIGHT},${BODY_TOP + RADIUS.body}
              L ${BODY_RIGHT},${CRACK_TOP_Y}
              L ${zigzag(BODY_RIGHT, BODY_LEFT, CRACK_TOP_Y, 3, 8)}
              Z
            `}
            fill={COLORS.bodyFill}
            stroke={COLORS.navy}
            strokeWidth={STROKE.medium}
            strokeLinejoin="round"
          />
          {/* Bottom half — translates down by DROP */}
          <g transform={`translate(0 ${DROP})`}>
            <path
              d={`
                M ${BODY_LEFT},${CRACK_BOT_Y}
                L ${zigzag(BODY_LEFT, BODY_RIGHT, CRACK_BOT_Y, 3, 8)}
                L ${BODY_RIGHT},${BODY_BOTTOM - RADIUS.body}
                A ${RADIUS.body},${RADIUS.body} 0 0 1 ${BODY_RIGHT - RADIUS.body},${BODY_BOTTOM}
                L ${BODY_LEFT + RADIUS.body},${BODY_BOTTOM}
                A ${RADIUS.body},${RADIUS.body} 0 0 1 ${BODY_LEFT},${BODY_BOTTOM - RADIUS.body}
                Z
              `}
              fill={COLORS.bodyFill}
              stroke={COLORS.navy}
              strokeWidth={STROKE.medium}
              strokeLinejoin="round"
            />
          </g>
          {/* "UPS!" alert next to the crack */}
          <text
            x={BODY_LEFT - 12}
            y={CRACK_TOP_Y + 4}
            textAnchor="end"
            fontSize={FONT.alert}
            fontWeight={700}
            fontStyle="italic"
            fill={COLORS.indicator}
          >
            UPS!
          </text>
        </>
      ) : (
        <rect
          x={BODY_LEFT}
          y={BODY_TOP}
          width={BODY_W}
          height={BODY_BOTTOM - BODY_TOP}
          rx={RADIUS.body}
          fill={COLORS.bodyFill}
          stroke={COLORS.navy}
          strokeWidth={STROKE.medium}
        />
      )}

      {/* Vertical scale line */}
      <line
        x1={SCALE_X}
        y1={SCALE_TOP}
        x2={SCALE_X}
        y2={SCALE_BOTTOM}
        stroke={COLORS.navy}
        strokeWidth={STROKE.thin}
      />

      {/* Minor ticks */}
      {minors.map((v) => {
        const y = valueToY(v);
        return (
          <line
            key={`min-${v}`}
            x1={SCALE_X}
            y1={y}
            x2={SCALE_X + MINOR_TICK_LEN}
            y2={y}
            stroke={COLORS.navy}
            strokeWidth={STROKE.thin}
          />
        );
      })}

      {/* Major ticks + numeric labels */}
      {majors.map((v) => {
        const y = valueToY(v);
        return (
          <g key={`maj-${v}`}>
            <line
              x1={SCALE_X}
              y1={y}
              x2={SCALE_X + MAJOR_TICK_LEN}
              y2={y}
              stroke={COLORS.navy}
              strokeWidth={STROKE.medium}
            />
            <text
              x={SCALE_X + MAJOR_TICK_LEN + 3}
              y={y + 3}
              textAnchor="start"
              fontSize={FONT.tick}
              fill={COLORS.scaleText}
            >
              {formatDK(v)}
            </text>
          </g>
        );
      })}

      {/* Indicator arrow — chunky red triangle pointing right at the scale */}
      <g
        style={{
          transform: `translateY(${indicatorY - SCALE_TOP}px)`,
          transition: TRANSITION.indicator,
        }}
      >
        <polygon
          points={`${SCALE_X},${SCALE_TOP} ${SCALE_X - 14},${SCALE_TOP - 5} ${SCALE_X - 14},${SCALE_TOP + 5}`}
          fill={COLORS.indicator}
          stroke={COLORS.indicator}
          strokeWidth={STROKE.thin}
          strokeLinejoin="round"
        />
      </g>

      {/* Bottom cap + hook + mass badge — drop with the crack when over-scale */}
      <g transform={overScale ? `translate(0 ${DROP})` : undefined}>
        <rect
          x={BOTTOM_CAP.left}
          y={BOTTOM_CAP.top}
          width={BOTTOM_CAP.right - BOTTOM_CAP.left}
          height={BOTTOM_CAP.bottom - BOTTOM_CAP.top}
          rx={RADIUS.cap}
          fill={COLORS.navy}
        />
        {/* Hook stem */}
        <line
          x1={HOOK.x}
          y1={HOOK.top}
          x2={HOOK.x}
          y2={HOOK.bottom}
          stroke={COLORS.navy}
          strokeWidth={STROKE.medium}
        />
        {/* Hook eye */}
        <circle cx={HOOK_EYE.cx} cy={HOOK_EYE.cy} r={HOOK_EYE.r} fill={COLORS.navy} />
        <circle cx={HOOK_EYE.cx} cy={HOOK_EYE.cy} r={HOOK_EYE.holeR} fill={COLORS.cardFill} />

        {/* Mass badge — only visible when there's a mass */}
        {mass > 0 && (
          <g
            style={{
              transform: `translateY(${massSag}px)`,
              transition: TRANSITION.mass,
            }}
          >
            <rect
              x={BADGE.left}
              y={BADGE.top}
              width={BADGE.right - BADGE.left}
              height={BADGE.bottom - BADGE.top}
              rx={RADIUS.badge}
              fill={COLORS.badgeFill}
            />
            <text
              x={CENTER_X}
              y={BADGE.top + (BADGE.bottom - BADGE.top) / 2 + 4}
              textAnchor="middle"
              fontSize={FONT.badge}
              fontWeight={600}
              fill={COLORS.badgeText}
            >
              {`${formatDK(mass, 3)} kg`}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

export { meta } from './meta';
export default DynamometerG_Component;

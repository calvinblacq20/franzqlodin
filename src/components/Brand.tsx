import markPath from "../../brand/mark-path.txt?raw";

const VIEWBOX = "119 75 996 1068";

export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox={VIEWBOX}
      width={size * (996 / 1068)}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="currentColor"
    >
      <path fillRule="evenodd" d={markPath.trim()} />
    </svg>
  );
}

export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.26 }}>
      <LogoMark size={size * 0.62} />
    </span>
  );
}

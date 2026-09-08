import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, PropsWithChildren, ReactNode } from "react";

type DivProps = HTMLAttributes<HTMLDivElement>;
type DragProps = { "data-tauri-drag-region"?: boolean | string };

/** The shared transparent glass surface used by each native window. */
export function GlassWindow({ children, className = "", ...props }: PropsWithChildren<DivProps & DragProps>) {
  return (
    <div
      {...props}
      className={`glass-effect app-shell ${className}`.trim()}
      data-tauri-drag-region={props["data-tauri-drag-region"] ?? true}
    >
      {children}
    </div>
  );
}

/** A drag-enabled region. Interactive descendants remain responsible for no-drag markers. */
export function DragRegion({ children, className = "", ...props }: PropsWithChildren<DivProps & DragProps>) {
  return (
    <div {...props} className={className} data-tauri-drag-region={props["data-tauri-drag-region"] ?? true}>
      {children}
    </div>
  );
}

export function WindowHeader({ children, actions, className = "", ...props }: PropsWithChildren<DivProps & DragProps & { actions?: ReactNode }>) {
  return (
    <header
      {...props}
      className={`shrink-0 flex items-center justify-between gap-2 h-11 px-3 border-b border-black/5 dark:border-white/10 ${className}`.trim()}
      data-tauri-drag-region={props["data-tauri-drag-region"] ?? true}
    >
      {children}
      {actions ? <div className="flex items-center gap-1" style={{ ["-webkit-app-region"]: "no-drag" } as CSSProperties}>{actions}</div> : null}
    </header>
  );
}

export function IconButton({ children, className = "", variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "close" }) {
  return <button {...props} className={`icon-button${variant === "close" ? " close" : ""} ${className}`.trim()}>{children}</button>;
}

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90 ${className}`.trim()}>{children}</button>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className = "", ...props }: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "onChange">) {
  return (
    <div {...props} className={`view-toggle ${className}`.trim()} role={props.role ?? "tablist"}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`view-button${option.value === value ? " active" : ""}`}
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, visible = true, children, className = "", ...props }: PropsWithChildren<DivProps & { message?: string; visible?: boolean }>) {
  return (
    <div {...props} role={props.role ?? "status"} className={`toast${visible ? " show" : ""} ${className}`.trim()}>
      {children ?? message}
    </div>
  );
}

export function LoadingState({ children, className = "", ...props }: PropsWithChildren<DivProps>) {
  return <div {...props} className={`py-12 text-center animate-pulse ${className}`.trim()}>{children}</div>;
}

export function BottomSheet({ open, children, className = "", ...props }: PropsWithChildren<DivProps & { open: boolean }>) {
  return (
    <div {...props} className={`bottom-sheet-overlay${open ? " show" : ""} ${className}`.trim()} aria-hidden={!open}>
      <div className="bottom-sheet">{children}</div>
    </div>
  );
}

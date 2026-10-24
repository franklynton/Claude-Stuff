import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  className?: string;
}

// A Windows 98 window frame using 98.css classes. The title bar buttons are decorative.
export default function Win98Window({ title, children, className = "" }: Props) {
  return (
    <div className={`window ${className}`}>
      <div className="title-bar">
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
          <button aria-label="Maximize" />
          <button aria-label="Close" />
        </div>
      </div>
      <div className="window-body">{children}</div>
    </div>
  );
}

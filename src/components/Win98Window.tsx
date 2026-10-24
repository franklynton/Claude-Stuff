import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}

// A Windows 98 window frame using 98.css classes. Only the close button does anything, and only with onClose.
export default function Win98Window({ title, children, className = "", onClose }: Props) {
  return (
    <div className={`window ${className}`}>
      <div className="title-bar">
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
          <button aria-label="Maximize" />
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>
      <div className="window-body">{children}</div>
    </div>
  );
}

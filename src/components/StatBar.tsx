interface Props {
  label: string;
  value: number;
  danger?: boolean; // true when a high value is bad (glitch)
}

export default function StatBar({ label, value, danger = false }: Props) {
  const bad = danger ? value > 60 : value < 30;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24">{label}</span>
      <div className="sunken-panel h-4 flex-1 bg-white">
        <div
          className={`h-full ${bad ? "bg-[#c00000]" : "bg-[#000080]"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right">{Math.round(value)}</span>
    </div>
  );
}

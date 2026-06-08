export default function PercentIcon({ size, className }: { size: number, className?: string }) {
  return (
    <span className={`font-extrabold text-xs inline-block text-center ${className}`} style={{ width: size, height: size }}>
      %
    </span>
  );
}

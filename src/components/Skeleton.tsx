import { cn } from "../lib/ui";

export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

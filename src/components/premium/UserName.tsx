import { cn } from "@/lib/utils";
import { findEffect } from "@/lib/cosmetics";

interface Props {
  name: string;
  effect?: string | null;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export default function UserName({ name, effect, className, as: Tag = "span" }: Props) {
  const def = findEffect(effect);
  return (
    <Tag className={cn("zf-name", def.className, className)}>
      {name}
    </Tag>
  );
}

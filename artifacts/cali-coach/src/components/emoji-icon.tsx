import { emojiIconMap } from "@/lib/icon-map";

interface EmojiIconProps {
  emoji: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function EmojiIcon({ emoji, className = "w-4 h-4 object-contain inline-block align-middle shrink-0", style, alt = "" }: EmojiIconProps) {
  const src = emojiIconMap[emoji];
  if (!src) {
    return <span className="inline-block leading-none shrink-0">{emoji}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      aria-hidden={alt === ""}
    />
  );
}

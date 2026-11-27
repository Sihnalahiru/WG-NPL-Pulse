import { useEffect, useState } from 'react';

interface UserAvatarProps {
  name: string;
  sizeClass?: string;
}

export function UserAvatar({ name, sizeClass = 'w-8 h-8 text-xs' }: UserAvatarProps) {
  // Strip any leading "RO:" or "MO:" prefix (e.g. "RO: Lahiru" -> "Lahiru")
  const cleanName = (name || '')
    .replace(/^(ro|mo)\s*:\s*/i, '')
    .trim();

  const extensions = ['jpg', 'png', 'jpeg', 'webp'];
  const [extIndex, setExtIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setExtIndex(0);
    setFailed(false);
  }, [cleanName]);

  const initials = cleanName
    ? cleanName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')
    : '?';

  if (!cleanName || failed || cleanName === '—') {
    return (
      <div
        className={`${sizeClass} rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center justify-center shrink-0 select-none`}
        title={cleanName}
      >
        {initials}
      </div>
    );
  }

  const src = `./images/user/${encodeURIComponent(cleanName)}.${extensions[extIndex]}`;

  return (
    <img
      src={src}
      alt={cleanName}
      title={cleanName}
      className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0`}
      onError={() => {
        if (extIndex + 1 < extensions.length) {
          setExtIndex((prev) => prev + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

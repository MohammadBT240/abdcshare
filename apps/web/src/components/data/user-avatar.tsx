'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-16 w-16 text-lg',
} as const;

export interface UserAvatarProps {
  src?: string | null;
  initials?: string;
  size?: keyof typeof sizeClass;
  className?: string;
  alt?: string;
}

export function UserAvatar({
  src,
  initials = '?',
  size = 'md',
  className,
  alt = '',
}: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeClass[size], className)}>
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback>{initials.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

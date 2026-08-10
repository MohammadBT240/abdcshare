export const ACTIVE_STYLES = {
  active: 'success' as const,
  inactive: 'secondary' as const,
};

export const STATUS_STYLES = {
  planning: 'secondary' as const,
  inProgress: 'default' as const,
  pending: 'outline' as const,
  returned: 'destructive' as const,
  accepted: 'success' as const,
  completed: 'success' as const,
} as const;

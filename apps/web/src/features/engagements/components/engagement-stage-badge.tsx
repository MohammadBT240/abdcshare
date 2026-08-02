'use client';

import { Badge } from '@/components/ui/badge';
import { getStageStyle, type EngagementStage } from '@/features/engagements/lib/stage-styles';

interface EngagementStageBadgeProps {
  stage: EngagementStage;
  className?: string;
}

export function EngagementStageBadge({ stage, className }: EngagementStageBadgeProps) {
  const style = getStageStyle(stage);
  return (
    <Badge variant={style.variant} className={style.className ?? className}>
      {style.label}
    </Badge>
  );
}

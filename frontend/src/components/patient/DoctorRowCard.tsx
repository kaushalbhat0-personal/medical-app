import { ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { initialsFromName } from '@/lib/patient/mockDoctorPresentation';

export type DoctorAvailabilityBadgeTone = 'today' | 'tomorrow' | 'muted';

export interface DoctorRowCardProps {
  name: string;
  subtitle: string;
  onPrimary?: () => void;
  /** Default: "Book Appointment" in patient flows. */
  primaryLabel?: string;
  onCardClick?: () => void;
  className?: string;
  /** e.g. 4.6 — shown when set */
  rating?: number;
  reviewCount?: number;
  /** e.g. "Available today" */
  availabilityLabel?: string;
  /** Visual weight for availability chip (green / red / neutral). */
  availabilityTone?: DoctorAvailabilityBadgeTone;
  /** Shorter width for horizontal rail */
  compact?: boolean;
  /** When false, CTA is hidden and card is non-interactive where applicable. */
  disabled?: boolean;
}

/**
 * Mobile-first row card for doctor / provider discovery (Practo-style).
 */
export function DoctorRowCard({
  name,
  subtitle,
  onPrimary,
  primaryLabel = 'Book Appointment',
  onCardClick,
  className,
  rating,
  reviewCount,
  availabilityLabel,
  availabilityTone = 'today',
  compact,
  disabled,
}: DoctorRowCardProps) {
  const interactive = Boolean(onCardClick) && !disabled;
  const showRating = typeof rating === 'number' && !Number.isNaN(rating);
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={disabled ? undefined : onCardClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'flex items-stretch gap-3 rounded-2xl border border-border/80 bg-white p-3 shadow-sm transition-all duration-200',
        'hover:border-primary/25 hover:shadow-md',
        interactive && 'cursor-pointer',
        disabled && 'opacity-60',
        className
      )}
    >
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-sm font-bold text-primary ring-1 ring-primary/10',
          compact ? 'h-12 w-12' : 'h-16 w-16'
        )}
        aria-hidden
      >
        {initialsFromName(name)}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="truncate text-base font-semibold leading-tight text-foreground">{name}</h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        {showRating && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-0.5 font-medium text-amber-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
              {rating.toFixed(1)}
            </span>
            {typeof reviewCount === 'number' && (
              <span className="text-muted-foreground/90">({reviewCount} reviews)</span>
            )}
          </div>
        )}
        {availabilityLabel && (
          <p className="mt-2">
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                disabled || availabilityTone === 'muted'
                  ? 'bg-muted text-muted-foreground'
                  : availabilityTone === 'tomorrow'
                    ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                    : 'bg-[#22c55e]/12 text-[#15803d] ring-1 ring-[#22c55e]/20'
              )}
            >
              {availabilityLabel}
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-col items-end justify-center gap-1">
        {onPrimary && (
          <Button
            type="button"
            size="sm"
            className="h-9 min-w-[7.5rem] shrink-0 rounded-xl px-3 text-xs font-semibold sm:text-sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onPrimary();
            }}
          >
            {primaryLabel}
          </Button>
        )}
        {onCardClick && !onPrimary && (
          <ChevronRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" aria-hidden />
        )}
      </div>
    </div>
  );
}

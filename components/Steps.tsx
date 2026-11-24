import type { Booking } from "@/lib/types";

export function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M5 2h7v7M12 2L5 9M10 9v3H2V4h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookingSteps({ booking }: { booking: Booking }) {
  const steps = booking.kind === "link" ? booking.steps ?? [] : booking.steps;
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function BookingLink({ booking, className = "btn btn-primary" }: { booking: Booking; className?: string }) {
  if (!booking.url) return null;
  const label = booking.kind === "link" ? booking.label : `Open ${booking.site}`;
  return (
    <a href={booking.url} target="_blank" rel="noopener noreferrer" className={className}>
      {label} <ExternalIcon />
    </a>
  );
}

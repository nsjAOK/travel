import type { CarClass } from "@/lib/types";

export const CAR_LABELS: Record<CarClass, string> = {
  economy: "Economy car",
  compact: "Compact car",
  midsize: "Midsize car",
  fullsize: "Full-size car",
  midsize_suv: "Midsize SUV",
  fullsize_suv: "Full-size SUV",
  minivan: "Minivan",
  luxury: "Luxury car",
};

export const carLabel = (c: CarClass) => CAR_LABELS[c] ?? c;

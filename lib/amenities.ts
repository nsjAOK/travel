// Canonical amenity keys, with the words people and sources use for them.
// `words` reads what a traveler writes ("a pool and parking"). `listingWords`
// reads hotel listings, where "parking" or "breakfast" alone usually means a
// paid service, so only wording that promises the amenity counts there.
export const AMENITIES: { key: string; label: string; words: string[]; listingWords?: string[] }[] = [
  {
    key: "free_breakfast",
    label: "Free breakfast",
    words: ["free breakfast", "breakfast included", "complimentary breakfast", "breakfast"],
    listingWords: ["free breakfast", "breakfast included", "complimentary breakfast", "free hot breakfast", "free continental breakfast"],
  },
  { key: "pool", label: "Pool", words: ["pool", "swimming"] },
  { key: "kitchen", label: "Kitchen or kitchenette", words: ["kitchenette", "kitchen"] },
  {
    key: "free_parking",
    label: "Free parking",
    words: ["free parking", "parking"],
    listingWords: ["free parking", "free self parking", "free self-parking", "complimentary parking", "parking included"],
  },
  {
    key: "airport_shuttle",
    label: "Airport shuttle",
    words: ["airport shuttle", "shuttle"],
    listingWords: ["airport shuttle", "airport transportation", "airport transfer"],
  },
  { key: "wifi", label: "Wi-Fi", words: ["wi-fi", "wifi", "internet"] },
  { key: "gym", label: "Gym", words: ["gym", "fitness"] },
  { key: "washer_dryer", label: "Washer/dryer", words: ["washer", "dryer", "laundry"] },
  { key: "pet_friendly", label: "Pet friendly", words: ["pet friendly", "pets allowed", "pet-friendly", "dog"] },
  { key: "ev_charging", label: "EV charging", words: ["ev charging", "electric vehicle", "charger"] },
  { key: "spa", label: "Spa", words: ["spa"] },
  { key: "restaurant", label: "Restaurant", words: ["restaurant", "dining"] },
  { key: "hot_tub", label: "Hot tub", words: ["hot tub", "jacuzzi", "whirlpool"] },
];

export const AMENITY_KEYS = AMENITIES.map((a) => a.key);

export function amenityLabel(key: string): string {
  return AMENITIES.find((a) => a.key === key)?.label ?? key;
}

/** Map what a traveler wrote to canonical keys. */
export function amenitiesIn(text: string): string[] {
  const t = text.toLowerCase();
  return AMENITIES.filter((a) => a.words.some((w) => t.includes(w))).map((a) => a.key);
}

/** Map a hotel listing's amenity text to canonical keys, counting only wording that promises the amenity. */
export function listingAmenities(text: string): string[] {
  const t = text.toLowerCase();
  return AMENITIES.filter((a) => (a.listingWords ?? a.words).some((w) => t.includes(w))).map((a) => a.key);
}

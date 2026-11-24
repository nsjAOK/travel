// A starter list of airports with coordinates, used to turn city names into
// airport codes and to measure hotel distance from the arrival airport.
// Add rows as you need them.

export interface Airport {
  code: string;
  name: string;
  city: string;
  aliases: string[];
  lat: number;
  lng: number;
}

export const AIRPORTS: Airport[] = [
  { code: "SEA", name: "Seattle-Tacoma Intl", city: "Seattle", aliases: ["seattle", "seatac", "sea-tac"], lat: 47.4502, lng: -122.3088 },
  { code: "MCO", name: "Orlando Intl", city: "Orlando", aliases: ["orlando", "disney world", "disney"], lat: 28.4312, lng: -81.3081 },
  { code: "LAX", name: "Los Angeles Intl", city: "Los Angeles", aliases: ["los angeles", "la"], lat: 33.9416, lng: -118.4085 },
  { code: "SFO", name: "San Francisco Intl", city: "San Francisco", aliases: ["san francisco"], lat: 37.6213, lng: -122.379 },
  { code: "JFK", name: "John F. Kennedy Intl", city: "New York", aliases: ["new york", "nyc", "kennedy"], lat: 40.6413, lng: -73.7781 },
  { code: "LGA", name: "LaGuardia", city: "New York", aliases: ["laguardia"], lat: 40.7769, lng: -73.874 },
  { code: "EWR", name: "Newark Liberty Intl", city: "Newark", aliases: ["newark"], lat: 40.6895, lng: -74.1745 },
  { code: "ORD", name: "Chicago O'Hare Intl", city: "Chicago", aliases: ["chicago", "o'hare", "ohare"], lat: 41.9742, lng: -87.9073 },
  { code: "ATL", name: "Hartsfield-Jackson Atlanta Intl", city: "Atlanta", aliases: ["atlanta"], lat: 33.6407, lng: -84.4277 },
  { code: "DFW", name: "Dallas/Fort Worth Intl", city: "Dallas", aliases: ["dallas", "fort worth"], lat: 32.8998, lng: -97.0403 },
  { code: "DEN", name: "Denver Intl", city: "Denver", aliases: ["denver"], lat: 39.8561, lng: -104.6737 },
  { code: "LAS", name: "Harry Reid Intl", city: "Las Vegas", aliases: ["las vegas", "vegas"], lat: 36.084, lng: -115.1537 },
  { code: "PHX", name: "Phoenix Sky Harbor Intl", city: "Phoenix", aliases: ["phoenix"], lat: 33.4342, lng: -112.0116 },
  { code: "MIA", name: "Miami Intl", city: "Miami", aliases: ["miami"], lat: 25.7959, lng: -80.287 },
  { code: "FLL", name: "Fort Lauderdale-Hollywood Intl", city: "Fort Lauderdale", aliases: ["fort lauderdale"], lat: 26.0742, lng: -80.1506 },
  { code: "TPA", name: "Tampa Intl", city: "Tampa", aliases: ["tampa"], lat: 27.9755, lng: -82.5332 },
  { code: "BOS", name: "Boston Logan Intl", city: "Boston", aliases: ["boston", "logan"], lat: 42.3656, lng: -71.0096 },
  { code: "IAD", name: "Washington Dulles Intl", city: "Washington", aliases: ["dulles"], lat: 38.9531, lng: -77.4565 },
  { code: "DCA", name: "Reagan Washington National", city: "Washington", aliases: ["washington", "dc", "reagan"], lat: 38.8512, lng: -77.0402 },
  { code: "BWI", name: "Baltimore/Washington Intl", city: "Baltimore", aliases: ["baltimore"], lat: 39.1774, lng: -76.6684 },
  { code: "CLT", name: "Charlotte Douglas Intl", city: "Charlotte", aliases: ["charlotte"], lat: 35.2144, lng: -80.9473 },
  { code: "MSP", name: "Minneapolis-St Paul Intl", city: "Minneapolis", aliases: ["minneapolis", "st paul"], lat: 44.8848, lng: -93.2223 },
  { code: "DTW", name: "Detroit Metro", city: "Detroit", aliases: ["detroit"], lat: 42.2162, lng: -83.3554 },
  { code: "PHL", name: "Philadelphia Intl", city: "Philadelphia", aliases: ["philadelphia", "philly"], lat: 39.8744, lng: -75.2424 },
  { code: "IAH", name: "Houston Bush Intercontinental", city: "Houston", aliases: ["houston"], lat: 29.9902, lng: -95.3368 },
  { code: "AUS", name: "Austin-Bergstrom Intl", city: "Austin", aliases: ["austin"], lat: 30.1975, lng: -97.6664 },
  { code: "SAN", name: "San Diego Intl", city: "San Diego", aliases: ["san diego"], lat: 32.7338, lng: -117.1933 },
  { code: "PDX", name: "Portland Intl", city: "Portland", aliases: ["portland"], lat: 45.5898, lng: -122.5951 },
  { code: "SLC", name: "Salt Lake City Intl", city: "Salt Lake City", aliases: ["salt lake city", "salt lake"], lat: 40.7899, lng: -111.9791 },
  { code: "HNL", name: "Daniel K. Inouye Intl", city: "Honolulu", aliases: ["honolulu", "oahu", "waikiki"], lat: 21.3245, lng: -157.9251 },
  { code: "OGG", name: "Kahului", city: "Maui", aliases: ["maui", "kahului"], lat: 20.8986, lng: -156.4305 },
  { code: "SJC", name: "San Jose Mineta Intl", city: "San Jose", aliases: ["san jose"], lat: 37.3639, lng: -121.9289 },
  { code: "BNA", name: "Nashville Intl", city: "Nashville", aliases: ["nashville"], lat: 36.1263, lng: -86.6774 },
  { code: "MSY", name: "Louis Armstrong New Orleans Intl", city: "New Orleans", aliases: ["new orleans"], lat: 29.9934, lng: -90.258 },
  { code: "RDU", name: "Raleigh-Durham Intl", city: "Raleigh", aliases: ["raleigh", "durham"], lat: 35.8801, lng: -78.788 },
  { code: "SAT", name: "San Antonio Intl", city: "San Antonio", aliases: ["san antonio"], lat: 29.5337, lng: -98.4698 },
  { code: "ANC", name: "Ted Stevens Anchorage Intl", city: "Anchorage", aliases: ["anchorage"], lat: 61.1743, lng: -149.9982 },
  { code: "CUN", name: "Cancún Intl", city: "Cancún", aliases: ["cancun", "cancún"], lat: 21.0365, lng: -86.8771 },
  { code: "YVR", name: "Vancouver Intl", city: "Vancouver", aliases: ["vancouver"], lat: 49.1967, lng: -123.1815 },
];

export function findAirport(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code.toUpperCase());
}

export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

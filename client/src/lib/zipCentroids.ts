export const zipCentroids = [
  // A small subset of 3-digit ZIP code prefixes mapped to rough centroids
  { prefix: '100', lat: 40.71, lng: -74.00, label: 'New York, NY' }, // NY
  { prefix: '900', lat: 34.05, lng: -118.24, label: 'Los Angeles, CA' }, // LA
  { prefix: '606', lat: 41.87, lng: -87.62, label: 'Chicago, IL' }, // Chicago
  { prefix: '770', lat: 29.76, lng: -95.36, label: 'Houston, TX' }, // Houston
  { prefix: '850', lat: 33.44, lng: -112.07, label: 'Phoenix, AZ' }, // Phoenix
  { prefix: '191', lat: 39.95, lng: -75.16, label: 'Philadelphia, PA' }, // Philly
  { prefix: '782', lat: 29.76, lng: -95.36, label: 'San Antonio, TX' }, // San Antonio
  { prefix: '921', lat: 32.71, lng: -117.16, label: 'San Diego, CA' }, // San Diego
  { prefix: '752', lat: 32.77, lng: -96.79, label: 'Dallas, TX' }, // Dallas
  { prefix: '951', lat: 37.33, lng: -121.88, label: 'San Jose, CA' }, // San Jose
  { prefix: '787', lat: 30.26, lng: -97.74, label: 'Austin, TX' }, // Austin
  { prefix: '322', lat: 30.33, lng: -81.65, label: 'Jacksonville, FL' }, // Jax
  { prefix: '941', lat: 37.77, lng: -122.41, label: 'San Francisco, CA' }, // SF
  { prefix: '432', lat: 39.96, lng: -82.99, label: 'Columbus, OH' }, // Columbus
  { prefix: '462', lat: 39.76, lng: -86.15, label: 'Indianapolis, IN' }, // Indy
  { prefix: '282', lat: 35.22, lng: -80.84, label: 'Charlotte, NC' }, // Charlotte
  { prefix: '981', lat: 47.60, lng: -122.33, label: 'Seattle, WA' }, // Seattle
  { prefix: '802', lat: 39.73, lng: -104.99, label: 'Denver, CO' }, // Denver
  { prefix: '200', lat: 38.90, lng: -77.03, label: 'Washington, DC' }, // DC
  { prefix: '021', lat: 42.36, lng: -71.05, label: 'Boston, MA' }, // Boston
  { prefix: '372', lat: 36.16, lng: -86.78, label: 'Nashville, TN' }, // Nashville
  { prefix: '731', lat: 35.46, lng: -97.51, label: 'Oklahoma City, OK' }, // OKC
  { prefix: '891', lat: 36.16, lng: -115.13, label: 'Las Vegas, NV' }, // Las Vegas
  { prefix: '482', lat: 42.33, lng: -83.04, label: 'Detroit, MI' }, // Detroit
  { prefix: '972', lat: 45.52, lng: -122.67, label: 'Portland, OR' }, // Portland
  { prefix: '381', lat: 35.14, lng: -90.04, label: 'Memphis, TN' }, // Memphis
  { prefix: '402', lat: 38.25, lng: -85.75, label: 'Louisville, KY' }, // Louisville
  { prefix: '532', lat: 43.03, lng: -87.90, label: 'Milwaukee, WI' }, // Milwaukee
  { prefix: '212', lat: 39.29, lng: -76.61, label: 'Baltimore, MD' }, // Baltimore
  { prefix: '871', lat: 35.08, lng: -106.65, label: 'Albuquerque, NM' }, // ABQ
  { prefix: '857', lat: 32.22, lng: -110.92, label: 'Tucson, AZ' }, // Tucson
  { prefix: '937', lat: 36.73, lng: -119.78, label: 'Fresno, CA' }, // Fresno
  { prefix: '958', lat: 38.58, lng: -121.49, label: 'Sacramento, CA' }, // Sacramento
  { prefix: '641', lat: 39.09, lng: -94.57, label: 'Kansas City, MO' }, // KC
  { prefix: '303', lat: 33.74, lng: -84.38, label: 'Atlanta, GA' }, // Atlanta
  { prefix: '681', lat: 41.25, lng: -95.93, label: 'Omaha, NE' }, // Omaha
  { prefix: '276', lat: 35.77, lng: -78.63, label: 'Raleigh, NC' }, // Raleigh
  { prefix: '331', lat: 25.76, lng: -80.19, label: 'Miami, FL' }, // Miami
  { prefix: '234', lat: 36.85, lng: -75.97, label: 'Virginia Beach, VA' }, // VA Beach
  { prefix: '946', lat: 37.80, lng: -122.27, label: 'Oakland, CA' }, // Oakland
  { prefix: '554', lat: 44.97, lng: -93.26, label: 'Minneapolis, MN' }, // Minneapolis
  { prefix: '741', lat: 36.15, lng: -95.99, label: 'Tulsa, OK' }, // Tulsa
  { prefix: '672', lat: 37.69, lng: -97.33, label: 'Wichita, KS' }, // Wichita
  { prefix: '701', lat: 29.95, lng: -90.07, label: 'New Orleans, LA' }, // NOLA
  { prefix: '760', lat: 32.72, lng: -97.32, label: 'Arlington, TX' }, // Arlington
  { prefix: '336', lat: 27.95, lng: -82.45, label: 'Tampa, FL' }, // Tampa
];

export function lookupZipCentroid(zipCode: string) {
  const prefix = zipCode.substring(0, 3);
  return zipCentroids.find(z => z.prefix === prefix);
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in miles
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

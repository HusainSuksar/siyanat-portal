// src/constants/locations.ts

// ==========================================
// 1. MACRO LOCATIONS (For Event Bookings)
// ==========================================
export const EVENT_VENUES: Record<string, string[]> = {
  "Najmi Hall": ["Najmi Hall Maghribi Janib", "Najmi Hall Shimali Janib", "Library (Near Gate)", "Multipurpose", "1AF", "1BF", "1CF", "1DF"],
  "Zainee Masjid": ["Zainee Masjid Ground Floor", "1AM", "1BM", "1CM", "6AM"],
  "Jamali Mawaid": ["Talabat Seating Area", "Talebaat Seating Area"],
  "Khaimat (Burhani School)": ["Football/Cricket Ground", "Volleyball Court", "Indore Games Room", "Swimming Pool"],
  "Rabwat (Bait ul Tarbiyat)": ["Rabwat Main Garden", "Dinner Mawaid", "Naashta Mawaid"],
  "Masakin": ["Masakin Ground", "Qasida Room", "Swimming Pool", "Masakin Terrace"]
};

export const EVENT_ZONES = Object.keys(EVENT_VENUES);

// ==========================================
// 2. MICRO HIERARCHY (For Complaints)
// ==========================================
export type SubLocationType = 'SELECT_ROOM' | 'SELECT_BATHROOM' | 'SELECT_FLOOR_ROOM';

export interface SubLocationConfig {
  type: SubLocationType;
  floors?: Record<string, string[]>;
  options?: string[];
  requiresTR?: boolean;
}

export interface VenueConfig {
  name: string;
  subConfig?: SubLocationConfig;
}

export const ZONE_FLOW_MAP: Record<string, VenueConfig[]> = {
  "Main Jamea Complex": [
    { name: "Zainee Masjid / Sehen Ground Floor" },
    {
      name: "Zainee Masjid First Floor (Classes)",
      subConfig: { type: 'SELECT_ROOM', options: ["1AM", "1BM", "1CM", "1DM", "Outer Area (1AM-1BM)", "Outer Area (1CM-1DM)"] }
    },
    { name: "Zainee Masjid - Offices" },
    {
      name: "Zainee Masjid Bathrooms",
      subConfig: { type: 'SELECT_BATHROOM', options: ["ZM-1", "ZM-2", "ZM-3", "ZM-4", "ZM-5", "ZM-Ground Floor Basin Area", "ZM-6", "ZM-7", "ZM-8", "ZM-First Floor Basin Area"] }
    },
    { name: "Zainee Masjid Outer Area" },
    { name: "Zainee Masjid (IT Room)" },
    {
      name: "Najmi Hall Ground Floor (Classes)",
      subConfig: { type: 'SELECT_ROOM', options: ["6AF", "Other (Regarding Najmi Hall)"] }
    },
    {
      name: "Najmi Hall First Floor (Classes)",
      subConfig: { type: 'SELECT_ROOM', options: ["1AF", "1BF", "1CF", "1DF", "Outer Area"] }
    },
    { name: "Najmi Hall - Offices" },
    {
      name: "Najmi Hall Bathrooms",
      subConfig: { type: 'SELECT_BATHROOM', options: ["NH-1", "NH-2", "NH-3", "NH-4", "NH - Basin Area"] }
    },
    { name: "Najmi Hall Outer Area" },
    { name: "Najmi Hall Multi Purpose" },
    { name: "Najmi Hall - Library" },
    {
      name: "Saifee Masjid Ground Floor (Classes)",
      subConfig: { type: 'SELECT_ROOM', options: ["6AM", "Other (Regarding Saifee Masjid)", "Store Room (Saifee Masjid First Floor)"] }
    },
    {
      name: "Saifee Masjid Bathrooms",
      subConfig: { type: 'SELECT_BATHROOM', options: ["SM-1", "SM-2", "SM-3", "SM-4", "SM-Basin Area"] }
    },
    { name: "Rajas Office" },
    { name: "Rajas Office Bathroom" }
  ],

  "Rabwat (Girls Hostel)": [
    {
      name: "Rabwat residence building",
      subConfig: {
        type: 'SELECT_FLOOR_ROOM',
        requiresTR: true,
        floors: {
          "Ground Floor": ["2001", "2002", "2003", "2004"],
          "First Floor": ["2011", "2012", "2013", "2014", "2015"],
          "Second Floor": ["2021", "2022", "2023", "2024", "2025"],
          "Ground Floor Pantry": [],
          "First Floor Pantry": [],
          "Second Floor Pantry": [],
          "Terrace": [],
          "Reception Desk / Settie": [],
          "Luggage Room": []
        }
      }
    },
    { name: "Naashta Mawaid/Garden Room" },
    { name: "Mawaid Hall (Dinner Mawaid)" },
    { name: "Mawaid Hall 1st floor (Maamal, library etc:-)" },
    { name: "Laundry" }
  ],

  "Masakin (Boys Hostel)": [
    {
      name: "Masakin Residence Building",
      subConfig: {
        type: 'SELECT_FLOOR_ROOM',
        requiresTR: true,
        floors: {
          "Ground Floor": ["1001", "1002", "1003", "1004", "1005", "1006"],
          "First Floor": ["1011", "1012", "1013", "1014", "1015", "1016", "1017"],
          "Second Floor": ["1021", "1022", "1023", "1024", "1025", "1026", "1027"]
        }
      }
    },
    { name: "Computer Room" },
    { name: "Qasida Room" },
    { name: "Pantry" },
    {
      name: "Bathrooms Ground Floor",
      subConfig: { type: 'SELECT_BATHROOM', requiresTR: true, options: ["001", "002", "003", "004", "005", "Basin Area"] }
    },
    {
      name: "Bathrooms First Floor",
      subConfig: { type: 'SELECT_BATHROOM', requiresTR: true, options: ["101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "Basin Area (101-105)", "Basin Area (106-110)"] }
    },
    {
      name: "Bathrooms Second Floor",
      subConfig: { type: 'SELECT_BATHROOM', requiresTR: true, options: ["201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "Basin Area (201-205)", "Basin Area (206-210)"] }
    },
    { name: "Reception/Office" },
    { name: "Luggage Room" }
  ],

  "Mawaid": [
    { name: "Mawaid Hall" },
    { name: "Kitchen" },
    { name: "Office" },
    {
      name: "Mawaid Bathrooms",
      subConfig: { type: 'SELECT_BATHROOM', options: ["MD-1", "MD-2", "MD-3", "MD-Ground Floor Basin Area", "MD-4", "MD-5", "MD-6", "MD-7"] }
    },
    { name: "Zabihat Room" },
    { name: "Roti Room" }
  ],

  "Khaimat al-Riyadat": [
    { name: "Burhani School Swimming Pool" },
    { name: "Masakin Swimming Pool" },
    { name: "Cycles" },
    { name: "Burhani School Talabat Ground Area" },
    { name: "Burhani School Talebaat Ground Area" },
    { name: "Indoor Games Room" }
  ]
};

// ==========================================
// 3. FLAT ZONES & FLAT VENUES (For Backwards Compatibility)
// ==========================================
export const MASTER_ZONES = Object.keys(ZONE_FLOW_MAP);

// Re-export MAINTENANCE_ZONES as a flat list of venue names per zone
export const MAINTENANCE_ZONES: Record<string, string[]> = Object.fromEntries(
  Object.entries(ZONE_FLOW_MAP).map(([zone, venues]) => [zone, venues.map(v => v.name)])
);

// ==========================================
// 4. MAPBOX ROUTING COORDINATES [Longitude, Latitude]
// ==========================================
export const ZONE_COORDINATES: Record<string, [number, number]> = {
  "Main Jamea Complex": [72.372697, 23.918141],
  "Rabwat (Girls Hostel)": [72.372697, 23.918141],
  "Masakin (Boys Hostel)": [72.372697, 23.918141],
  "Mawaid": [72.372697, 23.918141],
  "Khaimat al-Riyadat": [72.372697, 23.918141]
};
// Local & Regional Landmarks around Siddhpur / Gujarat
export const LOCAL_LANDMARKS: Record<string, { name: string; coords: [number, number]; category: string }> = {
  "Moula Hasanfeer Dargah (Denmal)": {
    name: "Moula Hasanfeer Shaheed Dargah, Denmal",
    coords: [72.3168, 23.9421],
    category: "Ziyarat"
  },
  "Moula Hasanfeer Mazar (Siddhpur)": {
    name: "Moula Hasanfeer Mazar Sharif, Siddhpur",
    coords: [72.3789, 23.9184],
    category: "Ziyarat"
  },
  "Moulai Fakhruddin Shaheed (Galiakot)": {
    name: "Dargah Hazrat Moulai Fakhruddin Shaheed, Galiakot",
    coords: [73.9877, 23.5356],
    category: "Ziyarat"
  },
  "Siddhpur Railway Station": {
    name: "Siddhpur Railway Station (SID)",
    coords: [72.3846, 23.9163],
    category: "Transit"
  },
  "Ahmedabad Airport (AMD)": {
    name: "Sardar Vallabhbhai Patel International Airport, Ahmedabad",
    coords: [72.6347, 23.0772],
    category: "Transit"
  },
  "Mehsana Railway Station": {
    name: "Mehsana Junction Railway Station",
    coords: [72.3871, 23.5880],
    category: "Transit"
  },
  "Patan (Rani Ki Vav)": {
    name: "Rani Ki Vav, Patan",
    coords: [72.1017, 23.8589],
    category: "Historical"
  }
};
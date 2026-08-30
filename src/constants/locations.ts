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
// 2. MICRO HIERARCHY (For Complaints & Requisitions)
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
// 3. FLAT ZONES & FLAT VENUES
// ==========================================
export const MASTER_ZONES = Object.keys(ZONE_FLOW_MAP);

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

// ==========================================
// 5. REGIONAL MAZAR & ZIYARAT LOCATIONS (35 Direct Points)
// ==========================================
export const MAZAR_LOCATIONS: Record<string, { city: string; mazar: string; coords: [number, number] }> = {
  "Ahmedabad": {
    city: "Ahmedabad",
    mazar: "Mazar-e-Qutbi",
    coords: [72.6053688, 23.0361836]
  },
  "Ahmednagar": {
    city: "Ahmednagar",
    mazar: "Ganje Shohada Nagar Ziyarat",
    coords: [74.7659787, 19.0961381]
  },
  "Amreli": {
    city: "Amreli",
    mazar: "Maulai Jaferji Saheb Mazaar",
    coords: [71.2044114, 21.5951051]
  },
  "Aurangabad": {
    city: "Aurangabad",
    mazar: "Qubba Mubarakah Syedi Najam Khan Saheb",
    coords: [75.3352025, 19.8750954]
  },
  "Banswara": {
    city: "Banswara",
    mazar: "Abdullah Peer Dargah",
    coords: [74.4380296, 23.5351238]
  },
  "Baroda": {
    city: "Baroda",
    mazar: "Syedi Musanji Taj Dargah",
    coords: [73.2155315, 22.3005260]
  },
  "Burhanpur": {
    city: "Burhanpur",
    mazar: "Dargah-E-Hakimi",
    coords: [76.2237752, 21.3338594]
  },
  "Chechat": {
    city: "Chechat",
    mazar: "Chechat mazaar",
    coords: [75.8869701, 24.7887638]
  },
  "Dongaon": {
    city: "Dongaon",
    mazar: "Mazaar-E-Maulai Noorudin Saheb",
    coords: [75.6591283, 19.5157279]
  },
  "Godhra": {
    city: "Godhra",
    mazar: "Syedi Ismailji Shaheed Godhra",
    coords: [73.6132281, 22.7728314]
  },
  "Halwad": {
    city: "Halwad",
    mazar: "Mazar Syedi QadiKhan Saheb",
    coords: [71.1677388, 23.0082664]
  },
  "Hasanfeer Saab (Denmal)": {
    city: "Hasanfeer Saab (Denmal)",
    mazar: "Hasanfeer Saheb Dargah",
    coords: [72.0111325, 23.6300315]
  },
  "Jamnagar": {
    city: "Jamnagar",
    mazar: "Mazar E Badri",
    coords: [70.0804500, 22.4763195]
  },
  "Kalawad": {
    city: "Kalawad",
    mazar: "Mazar E Ganipir - Dawoodi Bohra Dargah",
    coords: [70.3910179, 22.1321950]
  },
  "Kamlapur": {
    city: "Kamlapur",
    mazar: "Kamlapur Syedi Aliji Shaheed Dargah",
    coords: [76.4263788, 22.7488139]
  },
  "Kapadwanj": {
    city: "Kapadwanj",
    mazar: "Dawoodi Bohra Dargah, Kapadvanj",
    coords: [73.0627466, 23.0382435]
  },
  "Khambat": {
    city: "Khambat",
    mazar: "Dawoodi bohra Musafirkhana",
    coords: [72.6257319, 22.3213797]
  },
  "Maisaheba": {
    city: "Maisaheba",
    mazar: "Mazar E Maisaheba",
    coords: [72.8029294, 20.8919674]
  },
  "Mandvi": {
    city: "Mandvi",
    mazar: "Mazaar-E-Noorani",
    coords: [69.3520335, 22.8402830]
  },
  "Morbi": {
    city: "Morbi",
    mazar: "Maulai Raja Saheb Dargah",
    coords: [70.8369515, 22.8245302]
  },
  "Mumbai": {
    city: "Mumbai",
    mazar: "Raudat Tahera",
    coords: [72.8289224, 18.9588889]
  },
  "Mundra": {
    city: "Mundra",
    mazar: "Mazar Rani BaiSaheba",
    coords: [69.7125086, 22.8376695]
  },
  "Pisawada": {
    city: "Pisawada",
    mazar: "Maulaya Burhanuddin Bin Khoj Mazar",
    coords: [72.4815524, 22.6402677]
  },
  "Pratapgarh": {
    city: "Pratapgarh",
    mazar: "Kakaji saheb Dargah",
    coords: [74.7830518, 24.0305541]
  },
  "Rampura": {
    city: "Rampura",
    mazar: "Mazar Syedi Bawa Mulla Khan Saheb",
    coords: [75.4382703, 24.4636938]
  },
  "Ranpur": {
    city: "Ranpur",
    mazar: "Molaya Sheikh phir sahab dargah",
    coords: [71.7198687, 22.3476360]
  },
  "Selavi": {
    city: "Selavi",
    mazar: "Dawoodi Bohra Dargah, Selavi",
    coords: [72.2659025, 23.7118167]
  },
  "Shajapur": {
    city: "Shajapur",
    mazar: "Shajapur - Mazar e Yusufi",
    coords: [76.2669571, 23.4248233]
  },
  "Sidhpur": {
    city: "Sidhpur",
    mazar: "Mazar-E-Sayedi Qazi Khan",
    coords: [72.3698783, 23.9164187]
  },
  "Surat": {
    city: "Surat",
    mazar: "Mazar-E-Saifee SURAT",
    coords: [72.8301112, 21.1946239]
  },
  "Taherabad": {
    city: "Taherabad",
    mazar: "Mazar-e-Fakhri (Galiyakot)",
    coords: [74.0182496, 23.5319869]
  },
  "Udaipur": {
    city: "Udaipur",
    mazar: "Syedi Luqmanji Saheb Mazar Mubarak",
    coords: [73.6890199, 24.5837995]
  },
  "Ujjain": {
    city: "Ujjain",
    mazar: "Mazar-E-Najmi - Ujjain",
    coords: [75.7690304, 23.1902212]
  },
  "Umreth": {
    city: "Umreth",
    mazar: "Syedi Miyaji Bin Taj Saheb Dawoodi Bohra Mazar Dargah",
    coords: [73.1183054, 22.7038128]
  },
  "Wakaner": {
    city: "Wakaner",
    mazar: "Syedi Lukmanji Dargah Wakaner",
    coords: [70.9377202, 22.6105989]
  }
};

// ==========================================
// 6. LOCAL & REGIONAL LANDMARKS & TRANSIT
// ==========================================
export const LOCAL_LANDMARKS: Record<string, { name: string; coords: [number, number]; category: string }> = {
  // --- ZIYARAT DESTINATIONS (from Payload) ---
  "Ahmedabad - Mazar-e-Qutbi": { name: "Mazar-e-Qutbi, Ahmedabad", coords: [72.6053688, 23.0361836], category: "Ziyarat" },
  "Ahmednagar - Ganje Shohada": { name: "Ganje Shohada Nagar Ziyarat, Ahmednagar", coords: [74.7659787, 19.0961381], category: "Ziyarat" },
  "Amreli - Maulai Jaferji Saheb": { name: "Maulai Jaferji Saheb Mazaar, Amreli", coords: [71.2044114, 21.5951051], category: "Ziyarat" },
  "Aurangabad - Syedi Najam Khan Saheb": { name: "Qubba Mubarakah Syedi Najam Khan Saheb, Aurangabad", coords: [75.3352025, 19.8750954], category: "Ziyarat" },
  "Banswara - Abdullah Peer": { name: "Abdullah Peer Dargah, Banswara", coords: [74.4380296, 23.5351238], category: "Ziyarat" },
  "Baroda - Syedi Musanji Taj": { name: "Syedi Musanji Taj Dargah, Baroda", coords: [73.2155315, 22.3005260], category: "Ziyarat" },
  "Burhanpur - Dargah-E-Hakimi": { name: "Dargah-E-Hakimi, Burhanpur", coords: [76.2237752, 21.3338594], category: "Ziyarat" },
  "Chechat - Chechat Mazaar": { name: "Chechat mazaar, Chechat", coords: [75.8869701, 24.7887638], category: "Ziyarat" },
  "Dongaon - Maulai Noorudin Saheb": { name: "Mazaar-E-Maulai Noorudin Saheb, Dongaon", coords: [75.6591283, 19.5157279], category: "Ziyarat" },
  "Godhra - Syedi Ismailji Shaheed": { name: "Syedi Ismailji Shaheed Godhra", coords: [73.6132281, 22.7728314], category: "Ziyarat" },
  "Halwad - Syedi QadiKhan Saheb": { name: "Mazar Syedi QadiKhan Saheb, Halwad", coords: [71.1677388, 23.0082664], category: "Ziyarat" },
  "Denmal - Hasanfeer Saheb Dargah": { name: "Hasanfeer Saheb Dargah, Denmal", coords: [72.0111325, 23.6300315], category: "Ziyarat" },
  "Jamnagar - Mazar E Badri": { name: "Mazar E Badri, Jamnagar", coords: [70.0804500, 22.4763195], category: "Ziyarat" },
  "Kalawad - Mazar E Ganipir": { name: "Mazar E Ganipir - Dawoodi Bohra Dargah, Kalawad", coords: [70.3910179, 22.1321950], category: "Ziyarat" },
  "Kamlapur - Syedi Aliji Shaheed": { name: "Kamlapur Syedi Aliji Shaheed Dargah", coords: [76.4263788, 22.7488139], category: "Ziyarat" },
  "Kapadwanj - Dawoodi Bohra Dargah": { name: "Dawoodi Bohra Dargah, Kapadvanj", coords: [73.0627466, 23.0382435], category: "Ziyarat" },
  "Khambat - Dawoodi Bohra Musafirkhana": { name: "Dawoodi bohra Musafirkhana, Khambat", coords: [72.6257319, 22.3213797], category: "Ziyarat" },
  "Maisaheba - Mazar E Maisaheba": { name: "Mazar E Maisaheba, Maisaheba", coords: [72.8029294, 20.8919674], category: "Ziyarat" },
  "Mandvi - Mazaar-E-Noorani": { name: "Mazaar-E-Noorani, Mandvi", coords: [69.3520335, 22.8402830], category: "Ziyarat" },
  "Morbi - Maulai Raja Saheb Dargah": { name: "Maulai Raja Saheb Dargah, Morbi", coords: [70.8369515, 22.8245302], category: "Ziyarat" },
  "Mumbai - Raudat Tahera": { name: "Raudat Tahera, Mumbai", coords: [72.8289224, 18.9588889], category: "Ziyarat" },
  "Mundra - Mazar Rani BaiSaheba": { name: "Mazar Rani BaiSaheba, Mundra", coords: [69.7125086, 22.8376695], category: "Ziyarat" },
  "Pisawada - Maulaya Burhanuddin Bin Khoj": { name: "Maulaya Burhanuddin Bin Khoj Mazar, Pisawada", coords: [72.4815524, 22.6402677], category: "Ziyarat" },
  "Pratapgarh - Kakaji Saheb Dargah": { name: "Kakaji saheb Dargah, Pratapgarh", coords: [74.7830518, 24.0305541], category: "Ziyarat" },
  "Rampura - Syedi Bawa Mulla Khan": { name: "Mazar Syedi Bawa Mulla Khan Saheb, Rampura", coords: [75.4382703, 24.4636938], category: "Ziyarat" },
  "Ranpur - Molaya Sheikh Phir Sahab": { name: "Molaya Sheikh phir sahab dargah, Ranpur", coords: [71.7198687, 22.3476360], category: "Ziyarat" },
  "Selavi - Dawoodi Bohra Dargah": { name: "Dawoodi Bohra Dargah, Selavi", coords: [72.2659025, 23.7118167], category: "Ziyarat" },
  "Shajapur - Mazar e Yusufi": { name: "Shajapur - Mazar e Yusufi", coords: [76.2669571, 23.4248233], category: "Ziyarat" },
  "Sidhpur - Mazar-E-Sayedi Qazi Khan": { name: "Mazar-E-Sayedi Qazi Khan, Sidhpur", coords: [72.3698783, 23.9164187], category: "Ziyarat" },
  "Surat - Mazar-E-Saifee": { name: "Mazar-E-Saifee SURAT", coords: [72.8301112, 21.1946239], category: "Ziyarat" },
  "Taherabad - Mazar-e-Fakhri (Galiyakot)": { name: "Mazar-e-Fakhri (Galiyakot), Taherabad", coords: [74.0182496, 23.5319869], category: "Ziyarat" },
  "Udaipur - Syedi Luqmanji Saheb": { name: "Syedi Luqmanji Saheb Mazar Mubarak, Udaipur", coords: [73.6890199, 24.5837995], category: "Ziyarat" },
  "Ujjain - Mazar-E-Najmi": { name: "Mazar-E-Najmi - Ujjain", coords: [75.7690304, 23.1902212], category: "Ziyarat" },
  "Umreth - Syedi Miyaji Bin Taj Saheb": { name: "Syedi Miyaji Bin Taj Saheb Dawoodi Bohra Mazar Dargah, Umreth", coords: [73.1183054, 22.7038128], category: "Ziyarat" },
  "Wakaner - Syedi Lukmanji Dargah": { name: "Syedi Lukmanji Dargah Wakaner", coords: [70.9377202, 22.6105989], category: "Ziyarat" },

  
};
// dataLoader.js
const SUPABASE_URL = 'https://tvobyllquridjqrrigjh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Mte49as-tS6_epDO2XjK7Q_uSsOAP8p';

// Load and normalize parcel data with landlord and title holder info
export async function loadData() {
    const [parcels, landlords, titleHolders, agents, owners] = await Promise.all([
      fetch('https://tvobyllquridjqrrigjh.supabase.co/storage/v1/object/public/landlord-data//parcels.json').then(r => r.json()),
      fetch('https://tvobyllquridjqrrigjh.supabase.co/storage/v1/object/public/landlord-data//landlords.json').then(r => r.json()),
      fetch('https://tvobyllquridjqrrigjh.supabase.co/storage/v1/object/public/landlord-data//title_holders.json').then(r => r.json()),
      fetch('https://tvobyllquridjqrrigjh.supabase.co/storage/v1/object/public/landlord-data//registered_agents.json').then(r => r.json()),
      fetch('https://tvobyllquridjqrrigjh.supabase.co/storage/v1/object/public/landlord-data//owners.json').then(r => r.json())
    ]);

     // ◀︎ build an owner-count lookup by parcel ID
    const unitsByPID = owners.reduce((acc, o) => {
      acc[o.situs_pID] = (acc[o.situs_pID] || 0) + 1;
      return acc;
    }, {});
  
    // Create lookup maps for joining
    const titleHolderMap = new Map(titleHolders.map(th => [th.name, th]));
    const landlordMap = new Map(landlords.map(ld => [`${ld.name}|${ld.linked_title_holder}`, ld]));
  
    // Enhance parcel data
    const enrichedParcels = parcels.map(parcel => {
      const titleHolder = titleHolderMap.get(parcel.linked_title_holder);
  
      // Find landlord(s) for this parcel
      const parcelLandlords = landlords.filter(ld => ld.linked_title_holder === parcel.linked_title_holder);
  
      return {
        ...parcel,
        units: unitsByPID[parcel.property_id] || 0,
        title_holder: titleHolder || null,
        landlords: parcelLandlords
      };
    });
  
    return {
      parcels: enrichedParcels,
      landlords,
      titleHolders,
      registeredAgents: agents,
      owners
    };
  }
  
  // Example filter function
  export function filterParcelsByZip(parcels, zip) {
    return parcels.filter(p => p.street_address.includes(zip));
  }
  
  export function filterParcelsByLandlord(parcels, landlordName) {
    return parcels.filter(p =>
      p.landlords.some(ld => ld.name.toLowerCase().includes(landlordName.toLowerCase()))
    );
  }
  
  export function filterParcelsByMinUnits(parcels, minUnits) {
    return parcels.filter(p => p.units !== undefined && p.units >= minUnits);
  }
  
  export function summarizeLandlordsByParcelCount(parcels) {
    const summary = {};
    parcels.forEach(p => {
      p.landlords.forEach(ld => {
        summary[ld.name] = (summary[ld.name] || 0) + 1;
      });
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }  

  /**
 * Summarize how many unique parcels each owner owns.
 * @param {Array} owners  — array of owner records, each with .owner_name and .situs_pID
 * @returns {Array}       — [{ owner: string, parcelCount: number }, …]
 */
export function summarizeParcelsByOwner(owners) {
  // map owner_name → Set of parcel IDs
  const ownerMap = owners.reduce((acc, o) => {
    if (!acc[o.owner_name]) acc[o.owner_name] = new Set();
    acc[o.owner_name].add(o.situs_pID);
    return acc;
  }, {});

  // turn into a sortable array
  return Object.entries(ownerMap)
    .map(([owner, pidSet]) => ({ owner, parcelCount: pidSet.size }))
    .sort((a, b) => b.parcelCount - a.parcelCount);
}


export async function fetchFirstThousandParcels() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Owners?select=*&limit=1000`, 
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Error fetching parcels: ${res.status} ${res.statusText}`);
  }

  return res.json();
}


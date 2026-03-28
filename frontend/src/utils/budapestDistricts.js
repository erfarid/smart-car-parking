export const BUDAPEST_DISTRICTS = {
  D01: { lat: 47.4979, lng: 19.0325, label: "District I - Várkerület" },
  D02: { lat: 47.5265, lng: 19.0129, label: "District II - Rózsadomb" },
  D03: { lat: 47.5616, lng: 19.0399, label: "District III - Óbuda-Békásmegyer" },
  D04: { lat: 47.5762, lng: 19.0895, label: "District IV - Újpest" },
  D05: { lat: 47.4997, lng: 19.048, label: "District V - Belváros-Lipótváros" },
  D06: { lat: 47.5078, lng: 19.0656, label: "District VI - Terézváros" },
  D07: { lat: 47.4995, lng: 19.0728, label: "District VII - Erzsébetváros" },
  D08: { lat: 47.4901, lng: 19.0708, label: "District VIII - Józsefváros" },
  D09: { lat: 47.4769, lng: 19.0902, label: "District IX - Ferencváros" },
  D10: { lat: 47.4815, lng: 19.1274, label: "District X - Kőbánya" },
  D11: { lat: 47.4674, lng: 19.0367, label: "District XI - Újbuda" },
  D12: { lat: 47.4911, lng: 18.9993, label: "District XII - Hegyvidék" },
  D13: { lat: 47.5313, lng: 19.0705, label: "District XIII - Angyalföld" },
  D14: { lat: 47.5188, lng: 19.1098, label: "District XIV - Zugló" },
  D15: { lat: 47.5626, lng: 19.1162, label: "District XV - Rákospalota-Pestújhely" },
  D16: { lat: 47.5149, lng: 19.1709, label: "District XVI - Mátyásföld" },
  D17: { lat: 47.4721, lng: 19.253, label: "District XVII - Rákosmente" },
  D18: { lat: 47.4341, lng: 19.1839, label: "District XVIII - Pestszentlőrinc-Pestszentimre" },
  D19: { lat: 47.4548, lng: 19.144, label: "District XIX - Kispest" },
  D20: { lat: 47.4348, lng: 19.1019, label: "District XX - Pesterzsébet" },
  D21: { lat: 47.424, lng: 19.0692, label: "District XXI - Csepel" },
  D22: { lat: 47.4022, lng: 19.0097, label: "District XXII - Budafok-Tétény" },
  D23: { lat: 47.3974, lng: 19.1164, label: "District XXIII - Soroksár" },
};

export function normalizeDistrictKey(zoneId) {
  const raw = String(zoneId || "")
    .trim()
    .toUpperCase();

  if (!raw) return "";

  if (raw.startsWith("D")) {
    const numeric = raw.slice(1).replace(/\D/g, "");
    return numeric ? `D${numeric.padStart(2, "0")}` : "";
  }

  if (raw.startsWith("Z_")) {
    const numeric = raw.slice(2).replace(/\D/g, "");
    return numeric ? `D${numeric.padStart(2, "0")}` : "";
  }

  const numeric = raw.replace(/\D/g, "");
  return numeric ? `D${numeric.padStart(2, "0")}` : raw;
}

export function getDistrictLabel(zone) {
  if (!zone) return "Unknown District";
  if (typeof zone === "string") {
    const normalized = normalizeDistrictKey(zone);
    return BUDAPEST_DISTRICTS[normalized]?.label || zone;
  }

  const normalized = normalizeDistrictKey(zone.zone_id);
  return zone.zone_name || BUDAPEST_DISTRICTS[normalized]?.label || zone.zone_id || "Unknown District";
}

export function getDistrictPoint(zoneId, zoneName = "") {
  const normalized = normalizeDistrictKey(zoneId);
  const fallback = BUDAPEST_DISTRICTS[normalized];
  return {
    lat: fallback?.lat ?? 47.4979,
    lng: fallback?.lng ?? 19.0402,
    label: zoneName || fallback?.label || normalized || zoneId,
  };
}

export function sortDistricts(zones = []) {
  return [...zones].sort((a, b) => {
    const left = Number(String(normalizeDistrictKey(a?.zone_id)).replace(/\D/g, "")) || 0;
    const right = Number(String(normalizeDistrictKey(b?.zone_id)).replace(/\D/g, "")) || 0;
    return left - right;
  });
}

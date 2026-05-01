import { describe, expect, it } from 'vitest';
import {
  BUDAPEST_DISTRICTS,
  getDistrictLabel,
  getDistrictPoint,
  normalizeDistrictKey,
  sortDistricts,
} from '../utils/budapestDistricts';

describe('budapestDistricts utils', () => {
  it('normalizes district identifiers from different formats', () => {
    expect(normalizeDistrictKey('d5')).toBe('D05');
    expect(normalizeDistrictKey('Z_12')).toBe('D12');
    expect(normalizeDistrictKey('7')).toBe('D07');
    expect(normalizeDistrictKey('')).toBe('');
  });

  it('returns labels for strings and zone objects', () => {
    expect(getDistrictLabel('D01')).toBe(BUDAPEST_DISTRICTS.D01.label);
    expect(getDistrictLabel({ zone_id: 'D02', zone_name: 'Custom District II' })).toBe('Custom District II');
    expect(getDistrictLabel(null)).toBe('Unknown District');
  });

  it('returns fallback map point details when zone is unknown', () => {
    expect(getDistrictPoint('D03')).toEqual({
      lat: BUDAPEST_DISTRICTS.D03.lat,
      lng: BUDAPEST_DISTRICTS.D03.lng,
      label: BUDAPEST_DISTRICTS.D03.label,
    });

    expect(getDistrictPoint('UNKNOWN')).toEqual({
      lat: 47.4979,
      lng: 19.0402,
      label: 'UNKNOWN',
    });
  });

  it('sorts districts by district number', () => {
    const sorted = sortDistricts([
      { zone_id: 'D10' },
      { zone_id: 'D02' },
      { zone_id: 'D01' },
    ]);

    expect(sorted.map((item) => item.zone_id)).toEqual(['D01', 'D02', 'D10']);
  });
});

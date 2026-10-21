import { describe, it, expect } from 'vitest';
import { SZERKEZET_SABLONOK } from '../src/tablak/szerkezet_sablonok';
import { ALAP_ANYAGOK, BOVITETT_ANYAGOK } from '../src/alapkatalogus';

/** Egyszerű U a homogén rétegekből (Rsi + Rse falnál 0,17). */
function U(kod: string) {
  const s = SZERKEZET_SABLONOK.find((x) => x.kod === kod)!;
  const kat = [...ALAP_ANYAGOK, ...BOVITETT_ANYAGOK];
  let R = 0.17;
  for (const r of s.retegek) { const a = kat.find((x) => x.id === r.anyagId); expect(a, r.anyagId).toBeTruthy(); R += a!.lambda ? r.dCm / 100 / a!.lambda : (a!.R!.R * r.dCm / 100) / a!.R!.d; }
  return 1 / R;
}

describe('iparosított (nem panel) szerkezetek – a forrás (Osztroluczky) U-tartományaival összevetve', () => {
  it('nagyblokkos falak: kohóhabsalak 1,3–1,7, téglablokk 1,4–1,8 W/m²K', () => {
    expect(U('fal_blokk_kohosalak')).toBeGreaterThan(1.3); expect(U('fal_blokk_kohosalak')).toBeLessThan(1.7);
    expect(U('fal_blokk_tegla')).toBeGreaterThan(1.4); expect(U('fal_blokk_tegla')).toBeLessThan(1.8);
  });
  it('no-fines: eredeti ≈ 1,5; 4 cm Dryvit és 6,5 cm Hőstop az 1986-os k = 0,70 közelében', () => {
    expect(U('fal_nf_eredeti')).toBeGreaterThan(1.4); expect(U('fal_nf_eredeti')).toBeLessThan(1.75);
    expect(U('fal_nf_dryvit')).toBeLessThan(0.70);
    expect(U('fal_nf_hostop')).toBeLessThan(0.75);
  });
});

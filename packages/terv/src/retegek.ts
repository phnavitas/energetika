/**
 * PDF-rétegek (optional content group – pl. ArchiCAD-rétegek) besorolása a nevük szerint. Az irodák elnevezése
 * eltér („SZERKEZET - fal, főfal.1702”, „B-010-Fal-szerkezetek.STR”, „Falak”, „___00 tartószerkezet”), ezért
 * kulcsszavakkal sorolunk: a fal / hőszigetelés / helyiség jellegű rétegek a felismerés alapjai, a bútor, környezet,
 * burkolat és a metszősík fölötti (szaggatott) szerkezetek rétegei zajnak számítanak.
 */
import type { Lap } from './kinyeres';

export type RetegTipus = 'fal' | 'valaszfal' | 'hoszig' | 'zona' | 'pecset' | 'nyilas' | 'meret' | 'felirat' | 'zaj' | 'egyeb';

const kis = (s: string) => s.toLowerCase().replace(/[–—_]/g, ' ');

/** Fal-, pillér-, tartószerkezet-réteg (a falmetszet itt van). */
const FAL = /\bfal\b|falak|fal,|fal-szerk|főfal|tartófal|tartószerkezet|pillér|oszlop|vb szerkezet|vázszerkezet - tartó|\bmag\b/;
const VALASZ = /válaszfal|belső fal|belső határoló/;
const HOSZIG = /hőszig|homlokzati hőszig|külső határoló|homlokzatburkolat|lábazatszig/;
const ZONA = /\.zon\b|zóna|^helyiség$|helyiségek|helyiség külső/;
const PECSET = /pecsét/;
const NYILAS = /nyílászáró|ablak|ajtó|\bdoors?\b|windows?/;
const MERET = /méretez|kótáz|kotáz/;
const FELIRAT = /felirat|szöveg|címke|\bjel\b|jelek/;
/** Zaj: berendezés, környezet, burkolat, a metszősík fölötti szerkezet (födém, gerenda, tető, álmennyezet), raszter. */
const ZAJ = /bútor|butor|berendez|szaniter|konyha|technológia|lámpa|környezet|kornyezet|helyszín|terep|telek|zöld|kert|növény|járda|\bút\b|kerítés|földhivatal|fölfhivatal|földrészlet|helyrajzi|árnyék|álmennyezet|gerenda|födém|tető|fedélszék|ácsszerkezet|raszter|metszetjel|tűzvédelem|elektromos|gépész|vízelvezetés|bútorozás|padló|burkolat|csempe|lépcső|korlát|létra|\bauto\b|cars?\b|alapozás|sávalap|aljzat|vázlatterv|konszignáció|táblázat|háló|merevítő/;

export function retegTipus(nev: string): RetegTipus {
  const s = kis(nev).normalize('NFC');
  // (a metszősík fölötti szerkezet – tető, födém, gerenda – akkor is zaj, ha „tartószerkezet” vagy „hőszigetelés”)
  if (/tető|födém|gerend|fedélszék|alapozás|raszter|koszorú/.test(s) && !/\bfal/.test(s)) return 'zaj';
  if (HOSZIG.test(s)) return 'hoszig';
  if (VALASZ.test(s)) return 'valaszfal';
  // (a „falak_oszlopok_lépcső_mag” fal; a „Falak csempe”, „Burkolat - fal” burkolat)
  if (FAL.test(s) && !/csempe|burkolat|támfal|kerítés/.test(s)) return 'fal';
  if (PECSET.test(s)) return 'pecset';
  if (ZONA.test(s)) return 'zona';
  if (NYILAS.test(s)) return 'nyilas';
  if (MERET.test(s)) return 'meret';
  if (ZAJ.test(s)) return 'zaj';
  if (FELIRAT.test(s)) return 'felirat';
  return 'egyeb';
}

/**
 * Rétegzett lapon a zajrétegek (bútor, környezet, burkolat, födém/gerenda/tető, raszter) vonalainak elhagyása – a
 * fal-, helyiség- és nyílásfelismerés így csak a szerkezeti rajzot látja. Rétegek nélküli lap változatlan marad.
 */
export function retegSzures(lap: Lap): Lap {
  if (!lap.retegek?.length || !lap.utvonalak.some((u) => u.reteg)) return lap;
  const tip = new Map<string, RetegTipus>();
  const t = (n: string) => { let v = tip.get(n); if (!v) { v = retegTipus(n); tip.set(n, v); } return v; };
  // biztonság: csak akkor szűrünk, ha a lapon van felismert fal-réteg (különben a besorolás nem erre az irodára illik)
  if (!lap.utvonalak.some((u) => u.reteg && (t(u.reteg) === 'fal' || t(u.reteg) === 'valaszfal'))) return lap;
  return { ...lap, utvonalak: lap.utvonalak.filter((u) => !u.reteg || t(u.reteg) !== 'zaj') };
}

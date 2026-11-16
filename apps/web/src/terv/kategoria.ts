import type { HelyisegKategoria } from '../modell';

/** Besorolás javaslata a helyiség nevéből (5.1. táblázat); a felhasználó felülírhatja. */
export function kategoriaJavaslat(nev: string): HelyisegKategoria | null {
  const n = nev.toLowerCase();
  if (/garázs|garazs|padlás|padlas|pince|kazánház|kazanhaz|műhely|muhely|szín\b|fáskamra|faskamra|raktár|raktar/.test(n)) return 'gyengen_kapcsolt';
  if (/kamra|tároló|tarolo|gardrób|gardrob|spájz|spajz|éléskamra/.test(n)) return 'erosen_kapcsolt';
  if (/wc|közlekedő|kozlekedo|előtér|eloter|folyosó|folyoso|lépcső|lepcso|szoba|nappali|konyha|étkező|etkezo|fürdő|furdo|háló|halo|dolgozó|mosókonyha|háztartási/.test(n)) return 'kondicionalt';
  return null;
}

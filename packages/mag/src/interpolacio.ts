/**
 * Táblázati interpoláció a 9/2023 ÉKM számítási módszer (1. függelék) 7. fejezete szerint:
 * „Köztes értékek esetén lineáris interpolációt kell alkalmazni.”
 *
 * Forráshiány kezelése: a hivatalos táblázatok több helyen üres cellát tartalmaznak
 * (pl. 8.2., 8.15., 9.4., 9.11. táblázat). Ezeket `null` jelöli. Szabály:
 *  - a meglévő pontok között lineárisan interpolálunk (az üres cellákat kihagyva),
 *  - a tartomány alatt és az utolsó meglévő ponton túl az értéket állandónak tartjuk.
 * A WinWatt 9.54 a 9.11. táblázatnál 100,5 m²-re ugyanígy 10%-ot adott.
 * Minden ilyen esetet figyelmeztetésként visszaadunk, hogy a tanúsítvány készítője lássa.
 */

export interface Figyelmeztetes {
  kod: string;
  uzenet: string;
  forras?: string;
}

export interface TablazatOszlop {
  /** Pl. „8.9. táblázat, 35/28 °C oszlop”. */
  forras: string;
  /** Növekvő alapértékek (pl. rendszer-alapterület m²). */
  x: readonly number[];
  /** A hozzájuk tartozó értékek; `null` = a forrásban üres cella. */
  y: readonly (number | null)[];
}

export function interpolal(oszlop: TablazatOszlop, x: number, figyelmeztetesek?: Figyelmeztetes[]): number {
  const pontok: [number, number][] = [];
  oszlop.x.forEach((xi, i) => {
    const yi = oszlop.y[i];
    if (yi !== null && yi !== undefined) pontok.push([xi, yi]);
  });
  if (pontok.length === 0) throw new Error(`Nincs adat a táblázatban: ${oszlop.forras}`);

  const elso = pontok[0]!;
  const utolso = pontok[pontok.length - 1]!;
  const vanUresCella = oszlop.y.some((v) => v === null);

  if (x <= elso[0]) {
    if (x < elso[0]) figyelmeztetesek?.push({ kod: 'TARTOMANY_ALATT', uzenet: `${x} a táblázat legkisebb értéke (${elso[0]}) alatt van, az első értéket használtuk.`, forras: oszlop.forras });
    return elso[1];
  }
  if (x >= utolso[0]) {
    const tablaVege = oszlop.x[oszlop.x.length - 1]!;
    if (utolso[0] < tablaVege) {
      figyelmeztetesek?.push({ kod: 'FORRASHIANY', uzenet: `A forrástáblázat ${utolso[0]} felett üres; az utolsó meglévő értéket (${utolso[1]}) tartottuk.`, forras: oszlop.forras });
    }
    return utolso[1];
  }
  for (let i = 0; i < pontok.length - 1; i++) {
    const [x0, y0] = pontok[i]!;
    const [x1, y1] = pontok[i + 1]!;
    if (x >= x0 && x <= x1) {
      if (vanUresCella) {
        const kihagyott = oszlop.x.some((xi, k) => xi > x0 && xi < x1 && oszlop.y[k] === null);
        if (kihagyott) figyelmeztetesek?.push({ kod: 'FORRASHIANY', uzenet: `Üres cellák átugrásával interpoláltunk ${x0} és ${x1} között.`, forras: oszlop.forras });
      }
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return utolso[1];
}

/** Egyszerű lineáris interpoláció rendezett pontsoron (nincs üres cella). */
export function linearis(xk: readonly number[], yk: readonly number[], x: number): number {
  return interpolal({ forras: 'belső', x: xk, y: yk }, x);
}

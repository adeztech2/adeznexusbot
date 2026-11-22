// Offline unit conversion. Each category maps unit → factor to its base unit.
const TABLES = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  mass:   { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237 },
  volume: { ml: 0.001, l: 1, floz: 0.0295735295625, cup: 0.2365882365, pt: 0.473176473, qt: 0.946352946, gal: 3.785411784 },
  data:   { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 },
  time:   { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
  speed:  { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 0.514444 },
};

const ALIASES = {
  millimeter: 'mm', millimeters: 'mm', centimeter: 'cm', centimeters: 'cm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km', inch: 'in', inches: 'in', foot: 'ft', feet: 'ft',
  yard: 'yd', yards: 'yd', mile: 'mi', miles: 'mi',
  milligram: 'mg', milligrams: 'mg', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  tonne: 't', tonnes: 't', ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', lbs: 'lb',
  milliliter: 'ml', milliliters: 'ml', liter: 'l', liters: 'l', litre: 'l', litres: 'l', gallon: 'gal', gallons: 'gal',
  quart: 'qt', quarts: 'qt', pint: 'pt', pints: 'pt', cups: 'cup', 'fl.oz': 'floz',
  byte: 'b', bytes: 'b', kib: 'kb', mib: 'mb', gib: 'gb', tib: 'tb',
  ms: 'ms', sec: 's', second: 's', seconds: 's', minute: 'min', minutes: 'min', mins: 'min', hr: 'h', hour: 'h', hours: 'h',
  day: 'd', days: 'd', week: 'wk', weeks: 'wk',
  kph: 'km/h', kmh: 'km/h', 'kmph': 'km/h', knot: 'kn', knots: 'kn', mps: 'm/s',
  celsius: 'c', fahrenheit: 'f', kelvin: 'k', '°c': 'c', '°f': 'f',
};

const TEMPS = ['c', 'f', 'k'];

function norm(u) {
  const x = String(u).toLowerCase();
  return ALIASES[x] || x;
}

function toCelsius(v, u) { return u === 'c' ? v : u === 'f' ? (v - 32) * 5 / 9 : v - 273.15; }
function fromCelsius(v, u) { return u === 'c' ? v : u === 'f' ? v * 9 / 5 + 32 : v + 273.15; }

/** @returns {{ result: number, from: string, to: string }} */
export function convertUnit(value, fromRaw, toRaw) {
  const from = norm(fromRaw);
  const to   = norm(toRaw);

  if (TEMPS.includes(from) && TEMPS.includes(to)) {
    return { result: fromCelsius(toCelsius(value, from), to), from, to };
  }

  for (const table of Object.values(TABLES)) {
    if (from in table && to in table) {
      return { result: (value * table[from]) / table[to], from, to };
    }
  }
  throw new Error(`Can't convert "${fromRaw}" to "${toRaw}" (unknown or incompatible units).`);
}

export const SUPPORTED_UNITS = [
  'length: mm cm m km in ft yd mi',
  'mass: mg g kg t oz lb',
  'volume: ml l floz cup pt qt gal',
  'data: b kb mb gb tb',
  'time: ms s min h d wk',
  'speed: m/s km/h mph kn',
  'temperature: c f k',
];

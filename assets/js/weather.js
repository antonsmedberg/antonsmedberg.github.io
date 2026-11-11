// Malmö's weather from SMHI, loaded after the page: one request with nothing but the address, kept half an
// hour. ?wx=clear|cloudy|overcast|rain|snow|fog|thunder needs none; with ?hour=N only ?wx=live asks.

import { kind, symbol } from './sky.js';

const H = 36e5;
// An hour: time, °C, symbol, octas, mm, rain or snow, m/s, wind from, km seen, thunder %. Missing (9999) or out of range: null.
const F = 'air_temperature -60 60 symbol_code 1 27 cloud_area_fraction 0 8 precipitation_amount_mean 0 300 predominant_precipitation_type_at_surface 0 12 wind_speed 0 90 wind_from_direction 0 360 visibility_in_air 0 999 thunderstorm_probability 0 100'.split(' ');
const ok = (h) => h?.length === 10 && h[0] > 0 && h[1] !== null && Number.isInteger(h[2]);
const read = (json) => json.timeSeries.map((r) => [Date.parse(r.time), ...F.flatMap((k, i) => {
  const v = r.data[k];
  return i % 3 ? [] : [typeof v === 'number' && v !== 9999 && v >= F[i + 1] && v <= F[i + 2] ? v : null];
})]).filter(ok);
const STATES = { clear: '8 1 0 0 0 3 250 40 0', cloudy: '7 4 5 0 0 4 230 30 2', overcast: '6 6 8 0 0 5 220 20 2', rain: '5 19 8 2.5 1 7 210 8 5',
  snow: '-1 26 8 1.5 5 4 40 3 0', fog: '4 7 8 0 0 1 180 .3 0', thunder: '14 21 8 6 1 9 200 8 80' };

async function load(state, live) {
  if (STATES[state]) return Array.from({ length: 30 }, (_, i) => [(Math.floor(Date.now() / H) + i - 1) * H, ...STATES[state].split(' ').map(Number)]);
  if (!live) return null;
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 4000);
  try {
    const kept = JSON.parse(sessionStorage.getItem('wx'));
    if (Date.now() - kept.at < 18e5 && kept.s[0] && kept.s.every(ok)) return kept.s;
  } catch (e) { /* nothing kept: ask */ }
  try {
    const res = await fetch('https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/13.0/lat/55.6/data.json', { signal: stop.signal, referrerPolicy: 'no-referrer' });
    const s = read(await res.json());
    if (!s[0]) return null;
    try { sessionStorage.setItem('wx', JSON.stringify({ at: Date.now(), s })); } catch (e) { /* asked again */ }
    return s;
  } catch (e) {
    return null;
  }
}

// SMHI's 27 symbols; an empty one repeats the last.
const WORDS = {
  en: 'Clear|Mostly clear|Variable cloud|Partly cloudy|Cloudy|Overcast|Fog|Light showers|Showers|Heavy showers|Thunderstorms|Sleet showers|||Snow showers|||Light rain|Rain|Heavy rain|Thunder|Light sleet|Sleet|Heavy sleet|Light snow|Snow|Heavy snow',
  sv: 'Klart|Nästan klart|Växlande moln|Halvklart|Molnigt|Mulet|Dimma|Lätta regnskurar|Regnskurar|Kraftiga skurar|Åskskurar|Snöblandade byar|||Snöbyar|||Lätt regn|Regn|Kraftigt regn|Åska|Snöblandat regn|||Lätt snöfall|Snöfall|Kraftigt snöfall',
};

export function mountWeather(alm, { lang, dayAt, city, asked }) {
  const ask = new URLSearchParams(location.search).get('wx');
  const words = WORDS[lang].split('|').map((w, i, all) => w || all[i - 1] || all[i - 2]);
  const deg = (t) => `${Math.round(t)}`.replace('-', '\u2212');
  const now = alm.querySelector('[data-now]');
  let series;
  let at = Date.now();
  let drawn;
  const show = (ms) => {
    at = ms;
    const t = Math.round(ms / H) * H;
    const i = series ? series.findLastIndex((h) => h[0] <= t) : -1;
    const [time, c, s, octas, mm, type, wind, from, km, storm] = series?.[i]?.map((v) => v ?? NaN) || [];
    const k = kind(s, dayAt(t));
    if (!(t - time < 6 * H) || drawn === time + k + !city()) return;
    drawn = time + k + !city();
    now.innerHTML = `${symbol(k, words[s - 1])}<b>${deg(c)}°</b><span>${words[s - 1]}</span>`;
    // The city draws the same hour, without what SMHI left out.
    const wet = [1, 2, 3, 11, 12].includes(type) ? 1 : type === 7 ? 0.5 : 0;
    const w = { cloud: octas / 8, rain: mm * wet, snow: type ? mm * (1 - wet) : 0, fog: Math.max(km < 5 ? 1 - km / 5 : 0, s === 7 ? 0.7 : 0),
      wind, windDir: from, thunder: Math.max(storm / 100, s % 10 === 1 && s > 10 ? 0.8 : 0) };
    city()?.setWeather?.(Object.fromEntries(Object.entries(w).filter(([, v]) => Number.isFinite(v))));
  };
  load(ask, ask === 'live' || (asked === null && !ask)).then((s) => {
    series = s;
    show(at);
  });
  return { show };
}

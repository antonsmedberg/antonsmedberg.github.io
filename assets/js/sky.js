// The forecast's symbol for the almanac, loaded with weather.js after the page. Drawn on a 24 unit grid in
// one stroke, in the words' own colour, as a typeface's figures are; what stands behind a cloud is cut
// away where the cloud passes in front.

const CLOUD = 'M6.5 18.3A3.8 3.8 0 0 1 7.05 10.74A5.5 5.5 0 0 1 17.95 10.73A3.8 3.8 0 0 1 17.5 18.3Z';
const HIGH = 'M7 16A3.5 3.5 0 0 1 7.53 9.04A5 5 0 0 1 17.5 8.5A3.5 3.5 0 0 1 17.5 16Z';
const FRONT = 'M8 20.5A3 3 0 0 1 8.4 14.53A4.3 4.3 0 0 1 16.9 14.1A3.2 3.2 0 0 1 17 20.5Z';
const line = (d) => `<path d="${d}"/>`;
const rays = (x, y, a, b) => line(Array.from({ length: 8 }, (_, i) => {
  const c = Math.cos((i * Math.PI) / 4);
  const s = Math.sin((i * Math.PI) / 4);
  return `M${(x + a * c).toFixed(2)} ${(y + a * s).toFixed(2)}L${(x + b * c).toFixed(2)} ${(y + b * s).toFixed(2)}`;
}).join(''));
const sun = (x, y, r, a, b) => `<circle cx="${x}" cy="${y}" r="${r}"/>${rays(x, y, a, b)}`;
const behind = (back, front) => `<mask id="wx-cut"><rect width="24" height="24" fill="#fff"/><path d="${front}" fill="#000" stroke="#000" stroke-width="5"/></mask><g mask="url(#wx-cut)">${back}</g>${line(front)}`;
const ART = {
  sun: sun(12, 12, 4, 7, 9.5),
  moon: line('M15.5 15.9A6.6 6.6 0 0 1 9.1 5.1 7.4 7.4 0 1 0 18.9 14.9 6.6 6.6 0 0 1 15.5 15.9Z'),
  psun: behind(sun(9, 8.5, 3, 5.2, 7.1), FRONT),
  pmoon: behind(line('M10.6 12.4A4.6 4.6 0 0 1 6.6 4.8 5.2 5.2 0 1 0 13.4 11.4 4.6 4.6 0 0 1 10.6 12.4Z'), FRONT),
  cloud: line(CLOUD),
  over: behind(line('M13 12.1A2.6 2.6 0 0 1 12.92 6.9A3.6 3.6 0 0 1 20.07 6.94A2.6 2.6 0 0 1 19.6 12.1Z'), CLOUD),
  fog: line('M4 8.5h16M4 12.5h16M4 16.5h12'),
  rain: line(HIGH) + line('M8.5 18.5l-1.2 3M12.5 18.5l-1.2 3M16.5 18.5l-1.2 3'),
  sleet: line(HIGH) + line('M9 18.5l-1.2 3M15 20.2h0'),
  snow: line(HIGH) + line('M8.5 19.5h0M12.5 21.2h0M16.5 19.5h0'),
  storm: line(HIGH) + line('M12.8 15.5l-2.3 3.6h3l-2.3 3.6'),
};
// Which drawing one of SMHI's 27 symbols gets, by day or by night.
export const kind = (s, day) => (s < 3 ? (day ? 'sun' : 'moon') : s < 5 ? (day ? 'psun' : 'pmoon') : s < 8 ? ['cloud', 'over', 'fog'][s - 5]
  : s % 10 === 1 ? 'storm' : s > 11 && s % 10 > 1 && s % 10 < 5 ? 'sleet' : (s > 14 && s < 18) || s > 24 ? 'snow' : 'rain');
export const symbol = (kind, label) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${ART[kind]}</svg>`;

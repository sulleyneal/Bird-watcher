/* geo.js — best-effort location. Never blocks the capture flow. */

export function getLocation(timeoutMs = 5000) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      pos => { clearTimeout(timer); finish({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      () => { clearTimeout(timer); finish(null); },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 }
    );
  });
}

export function fmtCoords(lat, lon) {
  if (lat == null || lon == null) return '';
  const ns = lat >= 0 ? 'N' : 'S', ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lon).toFixed(3)}°${ew}`;
}

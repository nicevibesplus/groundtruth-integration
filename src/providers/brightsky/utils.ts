export function getUnit(phenomenon: string): string {
  if (phenomenon.includes('temperature') || phenomenon.includes('dew_point')) return '°C';
  if (phenomenon.includes('humidity') || phenomenon.includes('cloud_cover')) return '%';
  if (phenomenon.includes('pressure')) return 'hPa';
  if (phenomenon.includes('visibility')) return 'm';
  if (phenomenon.startsWith('precipitation')) return 'mm';
  if (phenomenon.includes('speed')) return 'm/s';
  if (phenomenon.includes('direction')) return '°';
  if (phenomenon.startsWith('solar')) return 'W/m²';
  if (phenomenon.startsWith('sunshine')) return 'min';
  return 'unknown';
}
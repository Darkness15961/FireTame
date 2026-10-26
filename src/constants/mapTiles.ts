/** Teselas raster sin API key (Carto ahora exige clave y muestra "API KEY REQUIRED"). */
export const DARK_MAP_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'

export const LIGHT_MAP_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'

export const MAP_TILE_OPTIONS = {
  maxZoom: 16,
}

export function mapTileUrl(dark: boolean): string {
  return dark ? DARK_MAP_TILES : LIGHT_MAP_TILES
}

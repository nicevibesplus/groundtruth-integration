import smhiMetadata from './parameters.json';

export interface SmhiParameterConfig {
    key: string;
    title: string;
    short_title: string;
    summary: string;
    unit: string;
    short_unit: string;
}

const parameters = smhiMetadata as SmhiParameterConfig[];

/**
 * Retrieves the short_title (e.g., 'air_temperature') by SMHI numerical key
 */
export function getParameterName(paramId: number | string): string {
    const config = parameters.find(p => p.key === String(paramId));
    return config ? config.short_title : `smhi_param_${paramId}`;
}

/**
 * Retrieves the short_unit (e.g., '°C') by SMHI numerical key
 */
export function getParameterUnit(paramId: number | string): string {
    const config = parameters.find(p => p.key === String(paramId));
    return config ? config.short_unit : '';
}

/**
 * Retrieves the SMHI numerical key using the short_title
 */
export function getParameterIdByName(shortTitle: string): string | undefined {
    const config = parameters.find(p => p.short_title === shortTitle);
    return config?.key;
}
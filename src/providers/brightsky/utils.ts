import brightskyParams from './parameters.json';

export interface BrightskyParameterConfig {
    key: string;
    title: string;
    short_title: string;
    unit: string;
    short_unit: string;
}

const parameters = brightskyParams as BrightskyParameterConfig[];

export function getShortTitleFromApiKey(apiKey: string): string | undefined {
    return parameters.find(p => p.key === apiKey)?.short_title;
}

export function getShortUnitFromApiKey(apiKey: string): string | undefined {
    return parameters.find(p => p.key === apiKey)?.short_unit;
}

export function getApiKeyFromShortTitle(shortTitle: string): string | undefined {
    return parameters.find(p => p.short_title === shortTitle)?.key;
}
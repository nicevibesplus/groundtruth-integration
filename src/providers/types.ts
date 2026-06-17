export interface Station {
    stationID: string;
    name: string;
    latitude: number;
    longitude: number;
    provider: string;
    phenomena: {
        title: string;
        unit: string;
    }[];
}

export interface MeasurementCollection {
    osemBoxId: string;
    accessToken: string;
    values: {
        sensor: string;
        value: string;
        createdAt: string;
    }[];
}
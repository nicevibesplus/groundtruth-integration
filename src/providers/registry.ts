import { BrightskyProvider } from './brightsky/brightsky';
import { SmhiProvider } from './smhi/smhi';

export const providerRegistry = [
    new BrightskyProvider(),
    new SmhiProvider()
    // new OpenWeatherProvider(),
];
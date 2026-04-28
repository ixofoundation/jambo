declare module 'unl-core' {
  const UnlCore: {
    encode: (latitude: number, longitude: number, precision: number) => string;
    decode: (locationId: string) => {
      coordinates: { lat: number; lon: number };
      bounds: { sw: { lat: number; lon: number }; ne: { lat: number; lon: number } };
    };
  };
  export default UnlCore;
}

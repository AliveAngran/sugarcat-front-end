declare namespace AMap {
  class Map {
    constructor(container: string | HTMLElement, options?: MapOptions);
    destroy(): void;
    addControl(control: any): void;
  }

  class Scale {
    constructor(options?: any);
  }

  class ToolBar {
    constructor(options?: any);
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    remove(): void;
  }

  class Polyline {
    constructor(options: PolylineOptions);
    setMap(map: Map | null): void;
    remove(): void;
  }

  class Geocoder {
    constructor(options?: any);
    getLocation(
      address: string,
      callback: (status: string, result: any) => void
    ): void;
  }

  class Driving {
    constructor(options?: any);
    search(
      origin: LngLat | [number, number],
      destination: LngLat | [number, number],
      options: any,
      callback: (status: string, result: any) => void
    ): void;
  }

  interface MapOptions {
    zoom?: number;
    center?: [number, number];
    [key: string]: any;
  }

  interface MarkerOptions {
    position: [number, number];
    title?: string;
    label?: {
      content: string;
      direction?: string;
    };
    [key: string]: any;
  }

  interface PolylineOptions {
    path: Array<[number, number]>;
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    [key: string]: any;
  }

  interface LngLat {
    lng: number;
    lat: number;
  }
}

interface Window {
  AMap: typeof AMap;
} 
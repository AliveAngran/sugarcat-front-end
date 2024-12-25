import type { AMapRouteResponse } from '../types';
import { AMAP_CONFIG } from '../config';

interface RouteResult {
  distance: number;
  duration: number;
  path: string[];
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 高德地图服务
 */
export class AMapService {
  private static instance: AMapService;
  private key: string;

  constructor(amapKey?: string) {
    // 优先使用传入的key，否则使用Web服务API密钥
    this.key = amapKey || process.env.NEXT_PUBLIC_AMAP_WEB_API_KEY || '';
    if (!this.key) {
      throw new Error('未配置高德地图API密钥,请在环境变量中设置 NEXT_PUBLIC_AMAP_WEB_API_KEY');
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AMapService {
    if (!AMapService.instance) {
      AMapService.instance = new AMapService();
    }
    return AMapService.instance;
  }

  /**
   * 计算两点间驾车路线
   */
  async calculateRoute(
    origin: { longitude: number; latitude: number },
    destination: { longitude: number; latitude: number }
  ): Promise<RouteResult> {
    const originStr = `${origin.longitude},${origin.latitude}`;
    const destinationStr = `${destination.longitude},${destination.latitude}`;

    const url = new URL('https://restapi.amap.com/v5/direction/driving');
    url.searchParams.append('key', this.key);
    url.searchParams.append('origin', originStr);
    url.searchParams.append('destination', destinationStr);
    url.searchParams.append('show_fields', 'cost,polyline');

    try {
      // 添加延迟，避免请求过于频繁
      await delay(500);

      const response = await fetch(url.toString());
      const data: AMapRouteResponse = await response.json();

      console.log('路线规划API响应:', data);

      if (data.status !== '1') {
        throw new Error(data.info || '路线计算失败');
      }

      if (!data.route?.paths?.[0]) {
        throw new Error('未获取到有效的路线数据');
      }

      const path = data.route.paths[0];
      
      if (!path.steps || !Array.isArray(path.steps)) {
        console.warn('未获取到路线步骤数据');
        return {
          distance: parseInt(path.distance || '0'),
          duration: parseInt(path.duration || '0'),
          path: [],
        };
      }

      return {
        distance: parseInt(path.distance || '0'),
        duration: parseInt(path.duration || '0'),
        path: path.steps.map(step => step.path || '').filter(Boolean),
      };
    } catch (error) {
      console.error('路线计算失败:', error);
      throw error;
    }
  }

  /**
   * 计算多点间驾车路线
   */
  async calculateMultiPointRoute(
    points: Array<{ longitude: number; latitude: number }>
  ): Promise<RouteResult> {
    if (points.length < 2) {
      throw new Error('至少需要两个点');
    }

    let totalDistance = 0;
    let totalDuration = 0;
    const paths: string[] = [];

    // 依次计算相邻点之间的路线
    for (let i = 0; i < points.length - 1; i++) {
      const result = await this.calculateRoute(points[i], points[i + 1]);
      totalDistance += result.distance;
      totalDuration += result.duration;
      paths.push(...result.path);
    }

    return {
      distance: totalDistance,
      duration: totalDuration,
      path: paths,
    };
  }

  /**
   * 批量地理编码
   */
  async batchGeocode(
    addresses: string[]
  ): Promise<Array<{ longitude: number; latitude: number } | null>> {
    return Promise.all(
      addresses.map(async (address) => {
        try {
          // 添加延迟，避免请求过于频繁
          await delay(500);

          const url = new URL('https://restapi.amap.com/v3/geocode/geo');
          url.searchParams.append('key', this.key);
          url.searchParams.append('address', address);

          const response = await fetch(url.toString());
          const data = await response.json();

          if (data.status === '1' && data.geocodes?.length) {
            const [longitude, latitude] = data.geocodes[0].location.split(',');
            return {
              longitude: parseFloat(longitude),
              latitude: parseFloat(latitude),
            };
          }
        } catch (error) {
          console.error('地理编码失败:', error);
        }
        return null;
      })
    );
  }
} 
import type { AMapRouteResponse } from '../types';
import { AMAP_CONFIG } from '../config';

interface RouteResult {
  distance: number;
  duration: number;
  path: string[];
}

/**
 * 延迟指定时间
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带重试的API请求
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<AMapRouteResponse> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 指数退避延迟
      if (i > 0) {
        const delayTime = baseDelay * Math.pow(2, i - 1);
        await delay(delayTime);
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1') {
        return data;
      } else if (data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT') {
        // QPS超限，等待更长时间后重试
        await delay(2000 * (i + 1));
        continue;
      }
      
      throw new Error(data.info || '请求失败');
    } catch (error) {
      lastError = error as Error;
      console.warn(`第${i + 1}次请求失败:`, error);
    }
  }
  
  throw lastError || new Error('请求失败');
}

/**
 * 高德地图服务
 */
export class AMapService {
  private static instance: AMapService;
  private key: string;
  private requestQueue: Promise<any>;

  constructor(amapKey?: string) {
    this.key = amapKey || process.env.NEXT_PUBLIC_AMAP_WEB_API_KEY || '';
    if (!this.key) {
      throw new Error('未配置高德地图API密钥');
    }
    this.requestQueue = Promise.resolve();
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
   * 添加请求到队列
   */
  private async enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
    const currentRequest = this.requestQueue.then(async () => {
      await delay(500); // 基础延迟
      return request();
    });
    this.requestQueue = currentRequest.catch(() => {});
    return currentRequest;
  }

  /**
   * 计算两点间驾车路线
   */
  async calculateRoute(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ): Promise<{
    distance: number;
    duration: number;
    path: string[];
  }> {
    return this.enqueueRequest(async () => {
      try {
        const url = new URL('https://restapi.amap.com/v5/direction/driving');
        url.searchParams.append('key', this.key);
        url.searchParams.append('origin', `${from.longitude},${from.latitude}`);
        url.searchParams.append('destination', `${to.longitude},${to.latitude}`);
        url.searchParams.append('show_fields', 'cost,duration');
        url.searchParams.append('strategy', '32');

        const data = await fetchWithRetry(url.toString());

        if (!data.route?.paths?.[0]) {
          throw new Error('未获取到有效的路线数据');
        }

        const path = data.route.paths[0];
        
        // 获取行驶时间（秒）
        const duration = path.cost?.duration ? parseInt(path.cost.duration) : 0;
        
        return {
          distance: parseInt(path.distance) || 0,
          duration: duration,
          path: path.steps?.map(step => step.polyline || '').filter(Boolean) || []
        };
      } catch (error) {
        console.error('路线计算失败:', error);
        throw error;
      }
    });
  }

  /**
   * 计算多点间驾车路线
   */
  async calculateMultiPointRoute(
    points: Array<{ longitude: number; latitude: number }>
  ): Promise<{
    distance: number;
    duration: number;
    path: string[];
  }> {
    return this.enqueueRequest(async () => {
      if (points.length < 2) {
        throw new Error('至少需要两个点');
      }

      try {
        const url = new URL('https://restapi.amap.com/v5/direction/driving');
        url.searchParams.append('key', this.key);
        url.searchParams.append('origin', `${points[0].longitude},${points[0].latitude}`);
        url.searchParams.append('destination', `${points[points.length - 1].longitude},${points[points.length - 1].latitude}`);
        
        if (points.length > 2) {
          const waypoints = points.slice(1, -1)
            .map(p => `${p.longitude},${p.latitude}`)
            .join(';');
          url.searchParams.append('waypoints', waypoints);
        }
        
        url.searchParams.append('show_fields', 'cost,duration');
        url.searchParams.append('strategy', '32');

        const data = await fetchWithRetry(url.toString());

        if (!data.route?.paths?.[0]) {
          throw new Error('未获取到有效的路线数据');
        }

        const path = data.route.paths[0];
        
        // 获取行驶时间（秒）
        const duration = path.cost?.duration ? parseInt(path.cost.duration) : 0;
        
        return {
          distance: parseInt(path.distance) || 0,
          duration: duration,
          path: path.steps?.map(step => step.polyline || '').filter(Boolean) || []
        };
      } catch (error) {
        console.error('多点路线计算失败:', error);
        throw error;
      }
    });
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
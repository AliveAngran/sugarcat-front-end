import type { Store, Vehicle, DeliveryRoute, PlanningResult, RouteStop, NavigationStep } from '../types';
import { AMapService } from '../services/amapService';

interface PlanningOptions {
  maxDrivingHours: number;
  maxStores: number;
  amapKey: string;
}

/**
 * 路线规划服务
 */
export class RoutePlanner {
  private stores: Store[];
  private vehicles: Vehicle[];
  private depot: { latitude: number; longitude: number };
  private amapService: AMapService;

  constructor(stores: Store[], vehicles: Vehicle[], amapKey: string) {
    // 过滤掉未定位的店铺
    this.stores = stores.filter(store => store.location?.latitude && store.location?.longitude);
    // 按优先级排序车辆（优先级高的先分配）
    this.vehicles = [...vehicles].sort((a, b) => b.priority - a.priority);
    // 使用湖州林欣雅网络科技有限公司作为配送中心
    this.depot = {
      latitude: 30.53671,
      longitude: 120.120171
    };

    console.log('初始化路线规划:', {
      totalStores: stores.length,
      validStores: this.stores.length,
      skippedStores: stores.length - this.stores.length
    });

    this.amapService = new AMapService(amapKey);
  }

  /**
   * 规划配送路线
   */
  public async plan(): Promise<PlanningResult> {
    try {
      if (this.stores.length === 0) {
        return {
          success: false,
          error: '没有可配送的店铺（所有店铺都未能成功定位）'
        };
      }

      // 计算每辆车应分配的店铺数
      const storesPerVehicle = Math.ceil(this.stores.length / this.vehicles.length);
      console.log('每辆车平均店铺数:', storesPerVehicle);

      // 按距离排序店铺
      const sortedStores = [...this.stores].sort((a, b) => {
        const distanceA = this.calculateDistance(this.depot, a.location!);
        const distanceB = this.calculateDistance(this.depot, b.location!);
        return distanceA - distanceB; // 从近到远排序
      });

      // 初始化路线数组
      const routes: DeliveryRoute[] = [];
      let currentStores: Store[] = [];
      let currentVehicleIndex = 0;

      // 遍历店铺，平均分配给每辆车
      for (let i = 0; i < sortedStores.length; i++) {
        currentStores.push(sortedStores[i]);

        // 当前车辆分配完毕或已到最后一个店铺
        if (currentStores.length >= storesPerVehicle || i === sortedStores.length - 1) {
          const vehicle = this.vehicles[currentVehicleIndex];
          
          // 构建路线
          const route = await this.buildRoute(currentStores, vehicle);
          routes.push(route);

          // 重置并移到下一辆车
          currentStores = [];
          currentVehicleIndex++;
        }
      }

      // 平衡路线
      await this.balanceRoutes(routes);

      if (routes.length === 0) {
        return {
          success: false,
          error: '未能生成有效的配送路线'
        };
      }

      return {
        success: true,
        routes: routes
      };
    } catch (error) {
      console.error('路线规划失败:', error);
      return {
        success: false,
        error: '路线规划过程出错: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 平衡各条路线的里程数和店铺数
   */
  private async balanceRoutes(routes: DeliveryRoute[]): Promise<void> {
    let balanced = false;
    const maxAttempts = 5;
    let attempts = 0;

    while (!balanced && attempts < maxAttempts) {
      balanced = true;
      attempts++;

      // 计算平均值
      const avgDistance = routes.reduce((sum, r) => sum + r.totalDistance, 0) / routes.length;
      const avgStores = routes.reduce((sum, r) => sum + r.stops.length, 0) / routes.length;

      // 遍历��线，尝试平衡
      for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
          const route1 = routes[i];
          const route2 = routes[j];

          // 计算差异
          const distanceDiff = Math.abs(route1.totalDistance - route2.totalDistance);
          const storesDiff = Math.abs(route1.stops.length - route2.stops.length);

          // 如果差异过大，尝试交换店铺
          if (distanceDiff > avgDistance * 0.2 || storesDiff > 2) {
            // 找到可以交换的店铺对
            const store1Index = this.findStoreForSwap(route1, route2, avgDistance);
            const store2Index = this.findStoreForSwap(route2, route1, avgDistance);

            if (store1Index >= 0 && store2Index >= 0) {
              // 交换店铺
              const temp = route1.stops[store1Index];
              route1.stops[store1Index] = route2.stops[store2Index];
              route2.stops[store2Index] = temp;

              // 重新构建路线
              routes[i] = await this.buildRoute(route1.stops.map(s => s.store), route1.vehicle);
              routes[j] = await this.buildRoute(route2.stops.map(s => s.store), route2.vehicle);

              balanced = false;
              break;
            }
          }
        }
        if (!balanced) break;
      }
    }
  }

  /**
   * 找到适合交换的店铺索引
   */
  private findStoreForSwap(
    fromRoute: DeliveryRoute, 
    toRoute: DeliveryRoute, 
    avgDistance: number
  ): number {
    let bestIndex = -1;
    let minDiff = Number.MAX_VALUE;

    for (let i = 0; i < fromRoute.stops.length; i++) {
      const store = fromRoute.stops[i].store;
      const distance = this.calculateDistance(this.depot, store.location!);

      // 计算交换后的预期差异
      const newDiff = Math.abs((fromRoute.totalDistance - distance * 2) - avgDistance) +
                     Math.abs((toRoute.totalDistance + distance * 2) - avgDistance);

      if (newDiff < minDiff) {
        minDiff = newDiff;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  /**
   * 找出距离给定位置最近的n个店铺
   */
  private findNearestStores(stores: Store[], n: number): Store[] {
    return [...stores]
      .sort((a, b) => {
        const distanceA = this.calculateDistance(this.depot, a.location!);
        const distanceB = this.calculateDistance(this.depot, b.location!);
        return distanceA - distanceB;
      })
      .slice(0, Math.min(n, stores.length));
  }

  /**
   * 根据距离将店铺分组
   */
  private groupStoresByDistance(): Store[][] {
    // 按距离排序
    const sortedStores = [...this.stores].sort((a, b) => {
      const distanceA = this.calculateDistance(this.depot, a.location!);
      const distanceB = this.calculateDistance(this.depot, b.location!);
      return distanceB - distanceA; // 从远到近排序，优先处理远距离
    });

    // 分组：每组不超过车辆最大配送店铺数
    const groups: Store[][] = [];
    let currentGroup: Store[] = [];
    let maxStoresPerGroup = Math.min(...this.vehicles.map(v => v.maxStores));

    for (const store of sortedStores) {
      if (currentGroup.length >= maxStoresPerGroup) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(store);
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * 为店铺组选择最合适的车辆
   */
  private selectBestVehicle(stores: Store[], maxDistance: number): Vehicle | null {
    try {
      console.log('计算最大距离:', maxDistance);

      // 筛选满足距离要求的车辆
      const suitableVehicles = this.vehicles.filter(v => 
        v.maxDistance >= maxDistance && 
        v.maxStores >= stores.length
      );

      if (suitableVehicles.length === 0) {
        console.log('没有满足要求的车辆');
        return null;
      }

      // 如果距离超过200公里，���先选择货车
      if (maxDistance > 200) {
        const trucks = suitableVehicles.filter(v => v.type === 'truck');
        if (trucks.length > 0) {
          return trucks[0];
        }
      }

      // 否则返回第一个满足条件的车辆
      return suitableVehicles[0];
    } catch (error) {
      console.error('选择车辆失败:', error);
      return null;
    }
  }

  /**
   * 计算店铺组的最大距离
   */
  private calculateMaxDistance(stores: Store[]): number {
    try {
      let maxDistance = 0;

      // 计算配送中心到最远店铺的距离
      for (const store of stores) {
        if (!store.location) continue;
        const distance = this.calculateDistance(this.depot, store.location);
        maxDistance = Math.max(maxDistance, distance);
      }

      // 考虑来回距离
      return maxDistance * 2;
    } catch (error) {
      console.error('计算最大距离失败:', error);
      return 0;
    }
  }

  /**
   * 计算两点之间的距离（公里）
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    if (!point1 || !point2) {
      console.error('无效的坐标点:', { point1, point2 });
      return 0;
    }

    const R = 6371; // 地球半径（���里）
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    const lat1 = this.toRad(point1.latitude);
    const lat2 = this.toRad(point2.latitude);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 计算路线总距离
   */
  private calculateTotalDistance(stores: Store[]): number {
    try {
      let totalDistance = 0;
      let lastPoint = this.depot;

      for (const store of stores) {
        if (!store.location) continue;
        totalDistance += this.calculateDistance(lastPoint, store.location);
        lastPoint = store.location;
      }

      // 加上返回配送中心的距离
      totalDistance += this.calculateDistance(lastPoint, this.depot);

      return totalDistance;
    } catch (error) {
      console.error('计算总距离失败:', error);
      return 0;
    }
  }

  /**
   * 优化访问顺序（简单贪心算法）
   */
  private async optimizeRoute(stores: Store[]): Promise<Store[]> {
    try {
      // 过滤掉没有位置信息的店铺
      const validStores = stores.filter(store => store.location);
      if (validStores.length === 0) {
        throw new Error('没有可用的店铺位置信息');
      }

      const optimized: Store[] = [];
      const remaining = [...validStores];
      let currentPoint = this.depot;

      while (remaining.length > 0) {
        // 找到最近的下一个店铺
        let minDistance = Infinity;
        let nextIndex = -1;

        for (let i = 0; i < remaining.length; i++) {
          const distance = this.calculateDistance(currentPoint, remaining[i].location!);
          if (distance < minDistance) {
            minDistance = distance;
            nextIndex = i;
          }
        }

        if (nextIndex === -1) break;

        const nextStore = remaining.splice(nextIndex, 1)[0];
        optimized.push(nextStore);
        currentPoint = nextStore.location!;
      }

      return optimized;
    } catch (error) {
      console.error('路线优化失败:', error);
      throw error;
    }
  }

  /**
   * 角度转弧度
   */
  private toRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private async buildRoute(
    stores: Store[], 
    vehicle: Vehicle
  ): Promise<DeliveryRoute> {
    try {
      // 优化访问顺序
      const optimizedStores = await this.optimizeRoute(stores);
      
      const stops: RouteStop[] = [];
      const navigationSteps: NavigationStep[] = [];
      let totalDistance = 0;
      let totalDuration = 0;
      
      // 设置出发时间为早上8:30
      let currentTime = new Date();
      currentTime.setHours(8, 30, 0, 0);
      
      // 从配送中心出发
      let currentPoint = this.depot;
      
      // 依次访问每个店铺
      for (const store of optimizedStores) {
        // 确保店铺有位置信息
        if (!store.location) {
          console.warn(`店铺 ${store.name} 缺少位置信息，跳过路线计算`);
          continue;
        }

        // 计算到下一个店铺的路线
        const result = await this.amapService.calculateRoute(
          {
            latitude: currentPoint.latitude,
            longitude: currentPoint.longitude
          },
          {
            latitude: store.location.latitude,
            longitude: store.location.longitude
          }
        );
        
        // 累计距离和时间
        totalDistance += result.distance;
        totalDuration += result.duration;
        
        // 计算预计到达时间
        currentTime = new Date(currentTime.getTime() + result.duration * 1000);
        
        // 添加导航步骤
        if (result.path && result.path.length > 0) {
          navigationSteps.push({
            instruction: `导航到${store.name}`,
            road: store.address,
            distance: result.distance,
            duration: result.duration,
            path: result.path.join(';')
          });
        }
        
        // 添加站点信息（停留时间改为30分钟）
        stops.push({
          store,
          estimatedArrival: currentTime.toLocaleTimeString(),
          estimatedDuration: 30 // 每个店铺停留30分钟
        });
        
        // 更新当前位置和时间（加上30分钟停留时间）
        currentPoint = {
          latitude: store.location.latitude,
          longitude: store.location.longitude
        };
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      }
      
      // 返回配送中心
      const returnRoute = await this.amapService.calculateRoute(
        {
          latitude: currentPoint.latitude,
          longitude: currentPoint.longitude
        },
        {
          latitude: this.depot.latitude,
          longitude: this.depot.longitude
        }
      );
      
      totalDistance += returnRoute.distance;
      totalDuration += returnRoute.duration;
      
      if (returnRoute.path && returnRoute.path.length > 0) {
        navigationSteps.push({
          instruction: '返回配送中心',
          road: '返程路线',
          distance: returnRoute.distance,
          duration: returnRoute.duration,
          path: returnRoute.path.join(';')
        });
      }
      
      return {
        vehicle,
        stops,
        totalDistance,
        totalDuration: Math.ceil(totalDuration / 60), // 转换为分钟
        navigationSteps
      };
    } catch (error) {
      console.error('建路线失败:', error);
      throw error;
    }
  }
} 
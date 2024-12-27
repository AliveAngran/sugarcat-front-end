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
  private onProgress?: (progress: { current: number; total: number; status: string }) => void;

  constructor(
    stores: Store[], 
    vehicles: Vehicle[], 
    amapKey: string,
    onProgress?: (progress: { current: number; total: number; status: string }) => void
  ) {
    // 过滤掉未定位的店铺
    this.stores = stores.filter(store => store.location?.latitude && store.location?.longitude);
    // 按优先级排序车辆（优先级高的先分配）
    this.vehicles = [...vehicles].sort((a, b) => b.priority - a.priority);
    // 使用湖州林欣雅网络科技有限公司作为配送中心
    this.depot = {
      latitude: 30.877369,
      longitude: 120.093902
    };
    this.onProgress = onProgress;

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

      // 将店铺按区域聚类
      let clusters = this.clusterStoresByRegion(this.stores);
      console.log('区域聚类完成, 共分为', clusters.length, '个区域');
      
      // 初始化路线数组
      const routes: DeliveryRoute[] = [];
      const unassignedStores: Store[] = [];
      
      // 按距离排序聚类，优先处理远距离区域
      clusters.sort((a, b) => {
        const centerA = this.calculateClusterCenter(a);
        const centerB = this.calculateClusterCenter(b);
        const distanceA = this.calculateDistance(this.depot, centerA);
        const distanceB = this.calculateDistance(this.depot, centerB);
        return distanceB - distanceA;
      });
      
      // 为每个区域分配合适的车辆
      for (let i = 0; i < clusters.length; i++) {
        let cluster = clusters[i];
        this.updateProgress(i + 1, clusters.length, `正在处理第${i + 1}个区域，共${clusters.length}个区域`);
        
        // 计算该区域的中心点到配送中心的距离
        const clusterCenter = this.calculateClusterCenter(cluster);
        let distanceToDepot = this.calculateDistance(this.depot, clusterCenter);
        
        // 估算该区域所需时间
        let estimatedTime = this.estimateRouteTime(cluster);
        
        // 选择合适的车辆
        let selectedVehicle = null;
        let bestClusterSize = 0;
        
        // 尝试不同的聚类大小
        while (cluster.length > 0 && !selectedVehicle) {
          for (const vehicle of this.vehicles) {
            // 检查是否已被分配
            if (routes.some(r => r.vehicle.id === vehicle.id)) continue;
            
            // 如果聚类太大,尝试拆分
            if (cluster.length > vehicle.maxStores) {
              const subClusters = this.splitLargeCluster(cluster, vehicle.maxStores);
              if (subClusters.length > 0) {
                // 使用第一个子聚类
                const newCluster = subClusters[0];
                
                // 重新计算时间和距离
                const newClusterCenter = this.calculateClusterCenter(newCluster);
                const newDistanceToDepot = this.calculateDistance(this.depot, newClusterCenter);
                const newEstimatedTime = this.estimateRouteTime(newCluster);
                
                // 检查限制条件
                if (newDistanceToDepot * 2 <= vehicle.maxDistance &&
                    newEstimatedTime <= vehicle.maxWorkHours * 60 &&
                    newCluster.length <= vehicle.maxStores) {
                  selectedVehicle = vehicle;
                  cluster = newCluster;
                  // 将剩余子聚类加回待处理列表
                  clusters.push(...subClusters.slice(1));
                  break;
                }
              }
            } else {
              // 检查限制条件
              if (distanceToDepot * 2 <= vehicle.maxDistance &&
                  estimatedTime <= vehicle.maxWorkHours * 60) {
                selectedVehicle = vehicle;
                break;
              }
            }
          }
          
          // 如果没找到合适的车辆，减少聚类大小
          if (!selectedVehicle && cluster.length > 3) {
            const reducedCluster = cluster.slice(0, Math.floor(cluster.length * 0.8));
            const remainingStores = cluster.slice(Math.floor(cluster.length * 0.8));
            cluster = reducedCluster;
            if (remainingStores.length > 0) {
              clusters.push(remainingStores);
            }
            // 重新计算距离和时间
            const newClusterCenter = this.calculateClusterCenter(cluster);
            distanceToDepot = this.calculateDistance(this.depot, newClusterCenter);
            estimatedTime = this.estimateRouteTime(cluster);
          } else {
            break;
          }
        }
        
        if (!selectedVehicle) {
          console.warn('区域', i + 1, '未找到合适的车辆，将店铺加入未分配列表');
          unassignedStores.push(...cluster);
          continue;
        }
        
        // 构建路线
        const route = await this.buildRoute(cluster, selectedVehicle);
        routes.push(route);
      }

      // 处理未分配的店铺
      if (unassignedStores.length > 0) {
        console.log('尝试处理未分配的店铺:', unassignedStores.length);
        
        // 将未分配的店铺按距离分组，尽量使用较小的组
        const maxGroupSize = Math.min(
          10,
          Math.max(...this.vehicles.map(v => v.maxStores)) / 2
        );
        
        // 按距离排序
        const sortedStores = [...unassignedStores].sort((a, b) => {
          const distanceA = this.calculateDistance(this.depot, a.location!);
          const distanceB = this.calculateDistance(this.depot, b.location!);
          return distanceA - distanceB;
        });
        
        // 分成小组
        let currentGroup: Store[] = [];
        for (const store of sortedStores) {
          currentGroup.push(store);
          
          // 当组达到一定大小或是最后一个店铺时，尝试分配
          if (currentGroup.length >= maxGroupSize || store === sortedStores[sortedStores.length - 1]) {
            // 尝试为当前组找到可用的车辆
            for (const vehicle of this.vehicles) {
              // 跳过已分配的车辆
              if (routes.some(r => r.vehicle.id === vehicle.id)) continue;
              
              // 检查限制
              const estimatedTime = this.estimateRouteTime(currentGroup);
              const maxDistance = this.calculateMaxDistance(currentGroup);
              
              if (maxDistance <= vehicle.maxDistance &&
                  estimatedTime <= vehicle.maxWorkHours * 60 &&
                  currentGroup.length <= vehicle.maxStores) {
                // 构建路线
                const route = await this.buildRoute(currentGroup, vehicle);
                routes.push(route);
                currentGroup = []; // 清空当前组
                break;
              }
            }
            
            // 如果没有找到合适的车辆，减少组大小再试
            if (currentGroup.length > 0) {
              const reducedGroup = currentGroup.slice(0, Math.max(3, Math.floor(currentGroup.length * 0.7)));
              for (const vehicle of this.vehicles) {
                if (routes.some(r => r.vehicle.id === vehicle.id)) continue;
                
                const estimatedTime = this.estimateRouteTime(reducedGroup);
                const maxDistance = this.calculateMaxDistance(reducedGroup);
                
                if (maxDistance <= vehicle.maxDistance &&
                    estimatedTime <= vehicle.maxWorkHours * 60 &&
                    reducedGroup.length <= vehicle.maxStores) {
                  const route = await this.buildRoute(reducedGroup, vehicle);
                  routes.push(route);
                  // 将未能分配的店铺放回待处理列表
                  currentGroup = currentGroup.slice(reducedGroup.length);
                  break;
                }
              }
            }
          }
        }
      }

      if (routes.length === 0) {
        return {
          success: false,
          error: '未能生成有效的配送路线'
        };
      }

      // 平衡路线
      await this.balanceRoutes(routes);

      // 输出规划结果统计
      const totalStores = routes.reduce((sum, route) => sum + route.stops.length, 0);
      console.log('路线规划完成:', {
        totalRoutes: routes.length,
        totalStores,
        averageStoresPerRoute: (totalStores / routes.length).toFixed(1),
        unassignedStores: this.stores.length - totalStores
      });

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
   * 更新进度
   */
  private updateProgress(current: number, total: number, status: string) {
    if (this.onProgress) {
      this.onProgress({ current, total, status });
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

      // 遍历线，尝试平衡
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
              // 换店铺
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
  private groupStoresByDistance(stores: Store[]): Store[][] {
    // 按距离排序
    const sortedStores = [...stores].sort((a, b) => {
      const distanceA = this.calculateDistance(this.depot, a.location!);
      const distanceB = this.calculateDistance(this.depot, b.location!);
      return distanceB - distanceA; // 从远到近排序，优先处理远距离
    });

    // 分组：每组不超过车辆最大配送店铺数
    const groups: Store[][] = [];
    let currentGroup: Store[] = [];
    let maxStoresPerGroup = Math.max(...this.vehicles.map(v => v.maxStores));

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

      // 如果距离超过200公里，先选择货车
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

    const R = 6371; // 地球半径（公里）
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

  /**
   * 生成高德导航链接
   */
  private generateAMapNavigationUrl(stops: RouteStop[]): string {
    if (stops.length === 0) return '';
    
    // 构建途经点
    const waypoints = stops.map(stop => 
      `${stop.store.location!.longitude},${stop.store.location!.latitude}`
    ).join(';');
    
    // 构建导航链接
    // 起点：配送中心
    // 终点：最后一个店铺
    // 途经点：其他店铺
    const url = new URL('https://uri.amap.com/navigation');
    url.searchParams.append('from', `${this.depot.longitude},${this.depot.latitude},配送中心`);
    url.searchParams.append('to', `${stops[stops.length - 1].store.location!.longitude},${stops[stops.length - 1].store.location!.latitude},${stops[stops.length - 1].store.name}`);
    
    if (stops.length > 1) {
      // 去掉最后一个店铺（已作为终点），其他店铺作为途经点
      const waypointsStr = stops.slice(0, -1).map(stop => 
        `${stop.store.location!.longitude},${stop.store.location!.latitude}`
      ).join(';');
      url.searchParams.append('waypoints', waypointsStr);
    }
    
    url.searchParams.append('mode', 'car');
    url.searchParams.append('policy', '1'); // 推荐路线
    
    return url.toString();
  }

  /**
   * 生成单个导航链接
   */
  private generateSingleNavigationUrl(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, fromName: string, toName: string): string {
    const url = new URL('https://uri.amap.com/navigation');
    url.searchParams.append('from', `${from.longitude},${from.latitude},${fromName}`);
    url.searchParams.append('to', `${to.longitude},${to.latitude},${toName}`);
    url.searchParams.append('mode', 'car');
    url.searchParams.append('policy', '1'); // 推荐路线
    return url.toString();
  }

  /**
   * 构建配送路线
   */
  private async buildRoute(
    stores: Store[], 
    vehicle: Vehicle
  ): Promise<DeliveryRoute> {
    try {
      // 优化访问顺序
      const optimizedStores = await this.optimizeRoute(stores);
      
      // 构建所有点的坐标数组（包括配送中心）
      const points = [
        { longitude: this.depot.longitude, latitude: this.depot.latitude },
        ...optimizedStores.map(store => ({
          longitude: store.location!.longitude,
          latitude: store.location!.latitude
        }))
      ];

      // 使用多点路线规划API计算完整路线
      const routeResult = await this.amapService.calculateMultiPointRoute(points);
      
      const stops: RouteStop[] = [];
      const navigationSteps: NavigationStep[] = [];
      
      // 设置出发时间为早上8:30
      let currentTime = new Date();
      currentTime.setHours(8, 30, 0, 0);
      
      // 从配送中心出发
      let currentPoint = this.depot;
      let currentName = '配送中心唐茂';
      
      // 依次访问每个店铺
      for (let i = 0; i < optimizedStores.length; i++) {
        const store = optimizedStores[i];
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

        // 更新当前时间（加上行驶时间）
        currentTime = new Date(currentTime.getTime() + result.duration * 1000);
        
        // 生成导航链接
        const navigationUrl = this.generateSingleNavigationUrl(
          currentPoint,
          store.location,
          currentName,
          store.name
        );

        // 添加导航步骤
        navigationSteps.push({
          instruction: `从${currentName}导航到${store.name}`,
          road: `途经${store.address}`,
          distance: result.distance,
          duration: result.duration,
          path: result.path.join(';'),
          navigationUrl
        });
        
        // 添加站点信息
        stops.push({
          store,
          estimatedArrival: currentTime.toLocaleTimeString(),
          estimatedDuration: 30, // 每个店铺停留30分钟
          drivingInfo: {
            distance: result.distance,
            duration: result.duration,
            from: currentName,
            to: store.name
          }
        });
        
        // 更新当前位置和名称
        currentPoint = store.location;
        currentName = store.name;
        
        // 更新时间（加上30分钟停留时间）
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      }
      
      // 计算返回配送中心的路线
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
      
      // 添加返回配送中心的导航步骤
      const returnNavigationUrl = this.generateSingleNavigationUrl(
        currentPoint,
        this.depot,
        currentName,
        '配送中心'
      );

      navigationSteps.push({
        instruction: `从${currentName}返回配送中心`,
        road: '返程路线',
        distance: returnRoute.distance,
        duration: returnRoute.duration,
        path: returnRoute.path.join(';'),
        navigationUrl: returnNavigationUrl
      });
      
      // 添加返回配送中心的行驶信息
      if (stops.length > 0) {
        stops[stops.length - 1].drivingInfo = {
          ...stops[stops.length - 1].drivingInfo!,
          returnInfo: {
            distance: returnRoute.distance,
            duration: returnRoute.duration,
            from: currentName,
            to: '配送中心'
          }
        };
      }

      // 生成完整路线的导航链接
      const fullRouteNavigationUrl = this.generateAMapNavigationUrl(stops);
      
      // 计算总时间（包括行驶时间和停留时间）
      const totalDuration = navigationSteps.reduce((sum, step) => sum + step.duration, 0) + 
                          stops.length * 30 * 60; // 加上所有停留时间（30分钟/站）
      
      return {
        vehicle,
        stops,
        totalDistance: routeResult.distance,
        totalDuration: Math.ceil(totalDuration / 60), // 转换为分钟
        navigationSteps,
        navigationUrl: fullRouteNavigationUrl
      };
    } catch (error) {
      console.error('构建路线失败:', error);
      throw error;
    }
  }

  /**
   * 将店铺按区域聚类
   */
  private clusterStoresByRegion(stores: Store[]): Store[][] {
    // 使用基于距离的分层聚类
    const clusters: Store[][] = [];
    const maxClusterRadius = 15; // 减小最大聚类半径为15公里
    
    // 按到配送中心的距离排序
    const sortedStores = [...stores].sort((a, b) => {
      const distanceA = this.calculateDistance(this.depot, a.location!);
      const distanceB = this.calculateDistance(this.depot, b.location!);
      return distanceA - distanceB; // 从近到远排序
    });
    
    // 复制店铺数组
    const remainingStores = [...sortedStores];
    
    while (remainingStores.length > 0) {
      // 取第一个店铺作为聚类中心
      const centerStore = remainingStores[0];
      const cluster: Store[] = [centerStore];
      remainingStores.splice(0, 1);
      
      // 找出距离中心点较近的店铺
      for (let i = remainingStores.length - 1; i >= 0; i--) {
        const store = remainingStores[i];
        const distance = this.calculateDistance(
          centerStore.location!,
          store.location!
        );
        
        // 如果距离在阈值内且不会导致超出车辆限制,加入当前聚类
        if (distance <= maxClusterRadius) {
          const newCluster = [...cluster, store];
          const estimatedTime = this.estimateRouteTime(newCluster);
          const maxDistance = this.calculateMaxDistance(newCluster);
          
          // 检查是否有车辆可以处理这个扩展后的聚类
          const hasValidVehicle = this.vehicles.some(v => 
            v.maxDistance >= maxDistance &&
            v.maxWorkHours * 60 >= estimatedTime &&
            v.maxStores >= newCluster.length
          );
          
          if (hasValidVehicle) {
            cluster.push(store);
            remainingStores.splice(i, 1);
          }
        }
      }
      
      clusters.push(cluster);
    }
    
    // 合并小聚类
    return this.mergeSmallClusters(clusters);
  }

  /**
   * 合并小聚类
   */
  private mergeSmallClusters(clusters: Store[][]): Store[][] {
    const minClusterSize = 3; // 减小最小聚类大小为3
    const result: Store[][] = [];
    
    // 先处理大聚类
    const largeClusters = clusters.filter(c => c.length >= minClusterSize);
    result.push(...largeClusters);
    
    // 收集小聚类
    const smallClusters = clusters.filter(c => c.length < minClusterSize);
    
    // 尝试将小聚类合并到最近的大聚类
    for (const smallCluster of smallClusters) {
      let bestDistance = Number.MAX_VALUE;
      let bestClusterIndex = -1;
      
      // 找到最近的聚类(不限于大聚类)
      for (let i = 0; i < result.length; i++) {
        const targetCluster = result[i];
        const distance = this.calculateClusterDistance(smallCluster, targetCluster);
        
        // 检查合并后是否有车辆可以处理
        const mergedCluster = [...targetCluster, ...smallCluster];
        const estimatedTime = this.estimateRouteTime(mergedCluster);
        const maxDistance = this.calculateMaxDistance(mergedCluster);
        
        const hasValidVehicle = this.vehicles.some(v => 
          v.maxDistance >= maxDistance &&
          v.maxWorkHours * 60 >= estimatedTime &&
          v.maxStores >= mergedCluster.length
        );
        
        if (distance < bestDistance && hasValidVehicle) {
          bestDistance = distance;
          bestClusterIndex = i;
        }
      }
      
      // 如果找到合适的聚类且距离不太远,就合并
      if (bestClusterIndex >= 0 && bestDistance <= 20) { // 减小合并距离阈值为20公里
        result[bestClusterIndex].push(...smallCluster);
      } else {
        // 否则作为独立聚类
        result.push(smallCluster);
      }
    }
    
    return result;
  }

  /**
   * 计算两个聚类之间的距离
   */
  private calculateClusterDistance(cluster1: Store[], cluster2: Store[]): number {
    let minDistance = Number.MAX_VALUE;
    
    // 计算两个聚类中所有店铺对之间的最小距离
    for (const store1 of cluster1) {
      for (const store2 of cluster2) {
        const distance = this.calculateDistance(
          store1.location!,
          store2.location!
        );
        minDistance = Math.min(minDistance, distance);
      }
    }
    
    return minDistance;
  }

  /**
   * 拆分过大的聚类
   */
  private splitLargeCluster(cluster: Store[], maxSize: number): Store[][] {
    if (cluster.length <= maxSize) {
      return [cluster];
    }

    const result: Store[][] = [];
    
    // 按到配送中心的距离排序
    const sortedStores = [...cluster].sort((a, b) => {
      const distanceA = this.calculateDistance(this.depot, a.location!);
      const distanceB = this.calculateDistance(this.depot, b.location!);
      return distanceA - distanceB;
    });
    
    // 动态调整分组大小，确保每组都满足时间和距离限制
    let currentGroup: Store[] = [];
    let currentDistance = 0;
    let currentTime = 0;
    
    for (const store of sortedStores) {
      // 计算添加这个店铺后的距离和时间
      const storeDistance = this.calculateDistance(this.depot, store.location!);
      const newDistance = Math.max(currentDistance, storeDistance * 2); // 考虑往返距离
      const newTime = this.estimateRouteTime([...currentGroup, store]);
      
      // 检查是否超出限制
      const exceedsDistance = newDistance > Math.min(...this.vehicles.map(v => v.maxDistance));
      const exceedsTime = newTime > Math.min(...this.vehicles.map(v => v.maxWorkHours * 60));
      const exceedsSize = currentGroup.length >= maxSize;
      
      if (exceedsDistance || exceedsTime || exceedsSize) {
        if (currentGroup.length > 0) {
          result.push(currentGroup);
          currentGroup = [];
          currentDistance = 0;
          currentTime = 0;
        }
      }
      
      currentGroup.push(store);
      currentDistance = newDistance;
      currentTime = newTime;
    }
    
    if (currentGroup.length > 0) {
      result.push(currentGroup);
    }
    
    return result;
  }

  /**
   * 计算区域中心点
   */
  private calculateClusterCenter(stores: Store[]): { latitude: number; longitude: number } {
    if (stores.length === 0) {
      return this.depot; // 如果没有店铺，返回配送中心坐标
    }
    
    const validStores = stores.filter(store => store.location);
    if (validStores.length === 0) {
      return this.depot;
    }
    
    const sum = validStores.reduce((acc, store) => ({
      latitude: acc.latitude + store.location!.latitude,
      longitude: acc.longitude + store.location!.longitude
    }), { latitude: 0, longitude: 0 });
    
    return {
      latitude: sum.latitude / validStores.length,
      longitude: sum.longitude / validStores.length
    };
  }

  /**
   * 估算路线所需时间（分钟）
   */
  private estimateRouteTime(stores: Store[]): number {
    if (stores.length === 0) return 0;
    
    let totalTime = 0;
    let currentPoint = this.depot;
    
    // 计算行驶时间（假设平均速度50km/h）
    const AVERAGE_SPEED = 50;
    
    // 访问每个店铺
    for (const store of stores) {
      if (!store.location) continue;
      
      // 计算到下一个店铺的距离和时间
      const distance = this.calculateDistance(currentPoint, store.location);
      const driveTime = (distance / AVERAGE_SPEED) * 60; // 转换为分钟
      
      // 累加行驶时间和停留时间
      totalTime += driveTime + 30; // 30分钟停留时间
      
      currentPoint = store.location;
    }
    
    // 添加返回配送中心的时间
    const returnDistance = this.calculateDistance(currentPoint, this.depot);
    const returnTime = (returnDistance / AVERAGE_SPEED) * 60;
    totalTime += returnTime;
    
    return Math.ceil(totalTime);
  }
} 
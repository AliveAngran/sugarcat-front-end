// 车辆类型
export type VehicleType = 'truck' | 'van';

// 车辆信息
export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  maxLoad: number;        // 最大载重(kg)
  maxDistance: number;    // 最大行驶距离(公里)
  maxWorkHours: number;   // 最大工作时间(小时)
  maxStores: number;      // 最大配送店铺数
  priority: number;       // 优先级(值越大优先级越高)
}

// 店铺地址信息
export interface Store {
  id: string;
  name: string;
  address: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// 导航步骤
export interface NavigationStep {
  instruction: string;  // 导航指示
  road: string;        // 道路名
  distance: number;    // 该步骤的距离
  duration: number;    // 预计用时(秒)
  path: string;        // 路径坐标串
}

// 站点信息
export interface RouteStop {
  store: Store;
  estimatedArrival: string;  // 预计到达时间
  estimatedDuration: number; // 停留时间(分钟)
}

// 修改配送路线接口
export interface DeliveryRoute {
  vehicle: Vehicle;
  stops: RouteStop[];        // 改用stops替代stores
  totalDistance: number;
  totalDuration: number;     // 总行驶时间(分钟) 
  navigationSteps: NavigationStep[];
}

// 规划结果
export interface PlanningResult {
  success: boolean;
  routes?: DeliveryRoute[];
  error?: string;
}

// 高德地图路线规划响应
export interface AMapRouteResponse {
  status: string;
  info: string;
  route: {
    paths: Array<{
      distance: string;
      duration: string;
      steps: Array<{
        instruction?: string;
        road_name?: string;
        path: string;
        distance?: string;
        duration?: string;
      }>;
    }>;
  };
}

// 文件上传响应
export interface ImportResponse {
  success: boolean;
  stores?: Store[];
  error?: string;
} 
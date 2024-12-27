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
  navigationUrl: string; // 该步骤的导航链接
}

// 站点信息
export interface RouteStop {
  store: Store;
  estimatedArrival: string;    // 预计到达时间
  estimatedDuration: number;   // 停留时间(分钟)
  drivingInfo?: {             // 到达该站点的行驶信息
    distance: number;         // 行驶距离(米)
    duration: number;         // 行驶时间(秒)
    from: string;            // 从哪里出发
    to: string;              // 到达哪里
    returnInfo?: {           // 返回配送中心的行驶信息（最后一个站点才有）
      distance: number;      // 返程距离(米)
      duration: number;      // 返程时间(秒)
      from: string;         // 从哪里出发
      to: string;          // 到达哪里
    };
  };
}

// 修改配送路线接口
export interface DeliveryRoute {
  vehicle: Vehicle;
  stops: RouteStop[];        // 改用stops替代stores
  totalDistance: number;
  totalDuration: number;     // 总行驶时间(分钟) 
  navigationSteps: NavigationStep[];
  navigationUrl: string; // 高德导航链接
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
  infocode: string;
  count: string;
  route: {
    origin?: string;
    destination?: string;
    taxi_cost?: string;
    paths: Array<{
      distance: string;
      duration: string;  // 路线总耗时
      restriction: string;
      cost?: {
        duration: string;  // 路线耗时
        tolls?: string;   // 道路收费
        toll_distance?: string;  // 收费路段里程
      };
      steps: Array<{
        instruction: string;
        orientation?: string;
        road_name?: string;
        step_distance?: string;
        polyline?: string;
        duration?: string;  // 当前路段耗时
        tmcs?: Array<{
          tmc_status: string;
          tmc_distance: string;
        }>;
      }>;
    }>;
  };
}

// 文件上传响应
export interface ImportResponse {
  success: boolean;
  stores?: Store[];
  unlocatedStores?: Store[];  // 未能定位的店铺
  error?: string;
} 
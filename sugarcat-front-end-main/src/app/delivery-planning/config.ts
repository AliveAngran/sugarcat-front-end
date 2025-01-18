// 高德地图配置
export const AMAP_CONFIG = {
  key: process.env.NEXT_PUBLIC_AMAP_KEY || '', // 从环境变量读取key
  version: '2.0',
  plugins: ['AMap.Driving']
}; 
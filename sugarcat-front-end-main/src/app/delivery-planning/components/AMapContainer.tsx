'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Store, DeliveryRoute } from '../types';

interface Props {
  stores?: Store[];
  routes?: DeliveryRoute[];
  onMapReady?: (map: any) => void;
}

// 标记点样式
const MARKER_COLORS = {
  store: '#1677ff', // 店铺标记颜色
  start: '#52c41a', // 起点颜色
  end: '#f5222d', // 终点颜色
};

let AMapLoader: any = null;
let AMapClass: any = null;

// 动态导入AMapLoader
const loadAMapLoader = async () => {
  if (!AMapLoader) {
    const module = await import('@amap/amap-jsapi-loader');
    AMapLoader = module.default;
  }
  return AMapLoader;
};

const AMapContainer: React.FC<Props> = ({ stores, routes, onMapReady }) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current || mapInstance) return;

    const initMap = async () => {
      try {
        console.log('开始加载地图...');
        const loader = await loadAMapLoader();
        const AMap = await loader.load({
          key: process.env.NEXT_PUBLIC_AMAP_KEY!,
          version: '2.0',
          plugins: [
            'AMap.Scale',
            'AMap.ToolBar',
          ],
        });

        // 保存 AMap 类
        AMapClass = AMap;

        console.log('地图脚本加载成功');
        const map = new AMap.Map(containerRef.current, {
          zoom: 11,
          center: [120.209947, 30.245853], // 杭州市中心
        });

        // 添加控件
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar());

        setMapInstance(map);
        mapRef.current = map;
        onMapReady?.(map);
      } catch (e) {
        console.error('地图加载失败:', e);
        setError('地图加载失败，请刷新页面重试');
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }
    };
  }, [onMapReady]);

  // 更新标记点
  useEffect(() => {
    if (!mapInstance || !stores || !AMapClass) return;

    console.log('更新地图标记, 店铺数:', stores.length);

    // 清除现有标记
    markersRef.current.forEach((marker) => {
      marker.remove();
    });
    markersRef.current = [];

    // 添加新标记
    stores.forEach((store) => {
      if (!store.location) {
        console.log('店铺未定位:', store.name);
        return;
      }

      console.log('添加标记:', store.name, store.location);
      const marker = new AMapClass.Marker({
        position: [store.location.longitude, store.location.latitude],
        title: store.name,
        label: {
          content: store.name,
          direction: 'top',
        },
      });

      marker.setMap(mapInstance);
      markersRef.current.push(marker);
    });

    // 如果有标记点，调整地图视野以包含所有标记
    if (markersRef.current.length > 0) {
      console.log('调整地图视野, 标记数:', markersRef.current.length);
      mapInstance.setFitView();
    }
  }, [mapInstance, stores]);

  // 更新路线
  useEffect(() => {
    if (!mapInstance || !routes || !AMapClass) return;

    // 清除现有路线
    polylinesRef.current.forEach((polyline) => {
      polyline.remove();
    });
    polylinesRef.current = [];

    // 绘制新路线
    routes.forEach((route) => {
      // 合并所有导航步骤的路径
      const allPaths = route.navigationSteps.map(step => step.path).filter(Boolean);
      if (allPaths.length === 0) return;

      // 将所有路径点转换为坐标数组
      const path = allPaths.flatMap(pathStr => {
        return pathStr.split(';').map(point => {
          const [lng, lat] = point.split(',');
          return [parseFloat(lng), parseFloat(lat)];
        });
      });

      if (path.length < 2) return;

      const polyline = new AMapClass.Polyline({
        path,
        strokeColor: '#1890ff',
        strokeWeight: 6,
        strokeOpacity: 0.8,
      });

      polyline.setMap(mapInstance);
      polylinesRef.current.push(polyline);
    });
  }, [mapInstance, routes]);

  if (error) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-100">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[400px]"
    />
  );
};

export default AMapContainer;

// 地理编码服务
export const geocodeAddress = async (
  address: string,
  city = '杭州'
): Promise<{ longitude: number; latitude: number } | null> => {
  try {
    console.log('开始地理编码:', address);
    
    // 构建请求URL
    const url = new URL('/api/geocode', window.location.origin);
    url.searchParams.append('address', address);
    url.searchParams.append('city', city);
    
    // 发起请求
    const response = await fetch(url.toString());
    const data = await response.json();
    
    // 检查响应状态
    if (!response.ok) {
      console.error('地理编码请求失败:', data);
      return null;
    }
    
    // 检查API响应
    if (data.status !== '1') {
      console.error('地理编码API错误:', data.info, data);
      return null;
    }
    
    if (!data.geocodes?.length) {
      console.log('未找到地理编码结果:', address);
      return null;
    }
    
    // 解析结果
    const location = data.geocodes[0].location.split(',');
    console.log('地理编码成功:', {
      address,
      location,
      formatted_address: data.geocodes[0].formatted_address,
      level: data.geocodes[0].level
    });
    
    return {
      longitude: parseFloat(location[0]),
      latitude: parseFloat(location[1])
    };
  } catch (error) {
    console.error('地理编码请求失败:', error);
    return null;
  }
}; 
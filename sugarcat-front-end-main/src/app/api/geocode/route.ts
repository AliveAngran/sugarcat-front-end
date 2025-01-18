import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const city = searchParams.get('city') || '杭州';

  if (!address) {
    return NextResponse.json({ error: '地址不能为空' }, { status: 400 });
  }

  try {
    // 构建高德地图 API 请求
    const url = new URL('https://restapi.amap.com/v3/geocode/geo');
    url.searchParams.append('key', process.env.NEXT_PUBLIC_AMAP_WEB_API_KEY!);
    url.searchParams.append('address', address);
    url.searchParams.append('city', city);
    url.searchParams.append('output', 'JSON');

    console.log('发送地理编码请求:', url.toString());

    // 发起请求
    const response = await fetch(url.toString());
    const data = await response.json();

    console.log('地理编码响应:', {
      status: response.status,
      data: data
    });

    // 检查API响应状态
    if (data.status !== '1') {
      console.error('高德API错误:', data.info);
      return NextResponse.json({ 
        error: `高德API错误: ${data.info}`,
        detail: data 
      }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('地理编码请求失败:', error);
    return NextResponse.json({ 
      error: '地理编码服务异常',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
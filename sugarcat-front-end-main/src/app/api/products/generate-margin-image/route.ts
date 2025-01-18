import { NextResponse } from 'next/server';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import { uploadBufferToCOS } from '@/utils/cos-server';
import { dbPromise } from '@/utils/cloudbase';
import os from 'os';

// 根据操作系统选择合适的字体路径
const getFontPath = () => {
  const platform = os.platform();
  if (platform === 'win32') {
    // Windows 字体备选列表
    const windowsFonts = [
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\simhei.ttf',  // 黑体
      'C:\\Windows\\Fonts\\simsun.ttc',  // 宋体
      'C:\\Windows\\Fonts\\msyh.ttf'     // 微软雅黑
    ];
    
    // 返回第一个存在的字体
    for (const font of windowsFonts) {
      try {
        if (require('fs').existsSync(font)) {
          console.log('Using font:', font);
          return font;
        }
      } catch (error) {
        console.warn('Font check failed:', font, error);
      }
    }
  } else if (platform === 'darwin') {
    return '/System/Library/Fonts/Supplemental/Arial.ttf';
  }
  console.warn('No suitable font found, using system default');
  return null;
};

// 注册字体
let fontFamily = 'sans-serif';  // 默认字体
try {
  const fontPath = getFontPath();
  if (fontPath) {
    registerFont(fontPath, { family: 'CustomFont' });
    fontFamily = 'CustomFont, sans-serif';
    console.log('Font registered successfully:', fontFamily);
  }
} catch (error) {
  console.error('Font registration error:', error);
}

export async function POST(request: Request) {
  try {
    const { productId, title, price, originPrice, grossMargin } = await request.json();
    console.log('Generating margin image for:', { productId, title, price, originPrice, grossMargin });

    // 创建画布
    const canvas = createCanvas(720, 720);
    const ctx = canvas.getContext('2d');

    // 设置背景色
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 720, 720);

    // 使用注册的字体
    console.log('Using font family:', fontFamily);

    // 绘制标题
    ctx.font = `bold 40px ${fontFamily}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    
    // 处理标题换行
    const words = title.split('');
    let line = '';
    let lines = [];
    for (let word of words) {
      const testLine = line + word;
      if (ctx.measureText(testLine).width > 500) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // 绘制标题文本
    lines.forEach((line, i) => {
      ctx.fillText(line, 360, 200 + (i * 50));
    });

    // 绘制毛利率
    ctx.font = `bold 90px ${fontFamily}`;
    ctx.fillStyle = '#FF0000';
    ctx.textAlign = 'center';
    const grossMarginText = `您的毛利 ${grossMargin}%`;
    ctx.fillText(grossMarginText, 360, 360);

    // 添加下划线
    const textWidth = ctx.measureText(grossMarginText).width;
    ctx.beginPath();
    ctx.moveTo(360 - textWidth/2, 370);
    ctx.lineTo(360 + textWidth/2, 370);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 绘制采购价
    ctx.font = `bold 45px ${fontFamily}`;
    ctx.fillStyle = '#00008B';
    ctx.fillText(`单件采购价 ¥${price}`, 360, 460);

    // 绘制零售价
    ctx.fillText(`建议零售价 ¥${originPrice}`, 360, 530);

    // 绘制底部装饰条
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(0, 700, 720, 10);

    // 将画布转换为Buffer
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

    // 将 Buffer 转换为 base64 字符串
    const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    // 返回预览图片的 base64 数据
    return NextResponse.json({ 
      success: true, 
      previewImage: base64Image,
      buffer: buffer // 后续上传时会用到
    });

  } catch (error: any) {
    console.error('生成毛利图失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '生成毛利图失败' }, 
      { status: 500 }
    );
  }
} 
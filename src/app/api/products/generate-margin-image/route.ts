import { NextResponse } from 'next/server';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import { uploadBufferToCOS } from '@/utils/cos-server';
import { dbPromise } from '@/utils/cloudbase';

// 注册字体 - 使用系统默认字体
try {
  registerFont('/System/Library/Fonts/Supplemental/Arial.ttf', {
    family: 'Arial'
  });
} catch (error) {
  console.warn('Font registration warning:', error);
}

export async function POST(request: Request) {
  try {
    const { productId, title, price, originPrice, grossMargin } = await request.json();

    // 创建画布
    const canvas = createCanvas(720, 720);
    const ctx = canvas.getContext('2d');

    // 设置背景色
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 720, 720);

    // 绘制标题
    ctx.font = 'bold 40px Arial';
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
    ctx.font = 'bold 90px Arial';
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
    ctx.font = 'bold 45px Arial';
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
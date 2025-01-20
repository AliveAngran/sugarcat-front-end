import { POST } from '../route';
import { uploadBufferToCOS } from '@/utils/cos-server';
import { db } from '@/utils/cloudbase-server';

jest.mock('@/utils/cos-server', () => ({
  uploadBufferToCOS: jest.fn()
}));

jest.mock('@/utils/cloudbase-server', () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue(true)
      })
    })
  }
}));

describe('Upload Margin Image API', () => {
  const mockImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const mockProductId = '123';

  beforeEach(() => {
    jest.clearAllMocks();
    (uploadBufferToCOS as jest.Mock).mockResolvedValue({ url: 'https://example.com/image.jpg' });
  });

  it('should successfully upload an image', async () => {
    const request = new Request('http://localhost:3000/api/products/upload-margin-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: mockProductId,
        imageData: mockImageData,
      }),
    });
    
    const response = await POST(request);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.imageUrl).toBeDefined();
    expect(uploadBufferToCOS).toHaveBeenCalled();
    expect(db.collection).toHaveBeenCalledWith('products');
  });

  it('should return 400 when productId is missing', async () => {
    const request = new Request('http://localhost:3000/api/products/upload-margin-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: mockImageData,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('缺少必要参数');
  });

  it('should return 400 for invalid image format', async () => {
    const request = new Request('http://localhost:3000/api/products/upload-margin-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: mockProductId,
        imageData: 'invalid-data',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('无效的图片格式');
  });

  it('should handle COS upload errors', async () => {
    (uploadBufferToCOS as jest.Mock).mockRejectedValue(new Error('Upload failed'));

    const request = new Request('http://localhost:3000/api/products/upload-margin-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: mockProductId,
        imageData: mockImageData,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Upload failed');
  });
});

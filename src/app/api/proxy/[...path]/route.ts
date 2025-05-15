import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://misleading-karil-furey1116-057e2f94.koyeb.app';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // 获取请求路径
    const path = params.path.join('/');
    
    // 获取原始请求中的查询参数
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    
    // 构建完整URL
    const apiUrl = `${API_BASE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;
    
    // 转发请求到目标API
    const response = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // 读取响应数据
    const data = await response.json();
    
    // 返回响应
    return NextResponse.json(data);
  } catch (error) {
    console.error('API代理错误:', error);
    return NextResponse.json(
      { error: '请求API时出错' },
      { status: 500 }
    );
  }
} 
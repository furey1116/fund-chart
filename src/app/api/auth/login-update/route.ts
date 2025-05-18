import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 更新用户最后登录时间
export async function PUT(request: NextRequest) {
  try {
    // 获取用户ID
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json({ error: '未找到用户' }, { status: 404 });
    }
    
    // 更新最后登录时间
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('更新最后登录时间失败:', error);
    return NextResponse.json({ error: '更新最后登录时间失败' }, { status: 500 });
  }
} 
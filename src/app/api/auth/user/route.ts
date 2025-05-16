import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 获取用户信息
export async function GET(request: NextRequest) {
  try {
    // 获取用户ID
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }
    
    // 从数据库查找用户
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json({ error: '未找到用户' }, { status: 404 });
    }
    
    // 移除密码后返回
    const { password, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 200 });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
} 
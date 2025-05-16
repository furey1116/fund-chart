import { NextRequest, NextResponse } from 'next/server';
import { LoginRequest, User } from '@/types/user';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// 用户登录
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const credentials = await request.json() as LoginRequest;
    
    // 验证请求字段
    if (!credentials.username || !credentials.password) {
      return NextResponse.json({ error: '缺少用户名或密码' }, { status: 400 });
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username: credentials.username }
    });
    
    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 更新最后登录时间
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    // 返回用户信息，不含密码
    const { password, ...userWithoutPassword } = updatedUser;
    return NextResponse.json(userWithoutPassword, { status: 200 });
  } catch (error) {
    console.error('用户登录失败:', error);
    return NextResponse.json({ error: '用户登录失败' }, { status: 500 });
  }
} 
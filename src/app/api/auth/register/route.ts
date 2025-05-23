import { NextRequest, NextResponse } from 'next/server';
import { RegisterRequest, User } from '@/types/user';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// 用户注册
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const userData = await request.json() as RegisterRequest;
    
    // 验证请求字段
    if (!userData.username || !userData.password || !userData.displayName) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }
    
    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username: userData.username }
    });
    
    if (existingUser) {
            return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }
    
    // 密码加密
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    
    // 创建新用户
    const newUser = await prisma.user.create({
      data: {
      username: userData.username,
      password: hashedPassword,
      displayName: userData.displayName,
        email: userData.email || null
      }
    });
    
    // 返回用户信息，不含密码
    const { password, ...userWithoutPassword } = newUser;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('注册用户失败:', error);
    return NextResponse.json({ error: '注册用户失败' }, { status: 500 });
  }
} 
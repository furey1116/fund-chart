import { NextRequest, NextResponse } from 'next/server';
import * as vercelBlob from '@vercel/blob';
import { LoginRequest, User } from '@/types/user';
import bcrypt from 'bcryptjs';

// 用户登录
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const credentials = await request.json() as LoginRequest;
    
    // 验证请求字段
    if (!credentials.username || !credentials.password) {
      return NextResponse.json({ error: '缺少用户名或密码' }, { status: 400 });
    }
    
    // 获取所有用户
    const { blobs } = await vercelBlob.list({
      prefix: 'users/',
    });
    
    const userListBlob = blobs.find(blob => blob.pathname.includes('user-list'));
    if (!userListBlob) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }
    
    const userListPath = userListBlob.pathname;
    
    // 获取用户列表
    const response = await fetch(userListBlob.url);
    if (!response.ok) {
      return NextResponse.json({ error: '无法获取用户列表' }, { status: 500 });
    }
    
    const text = await response.text();
    const users = JSON.parse(text) as User[];
    
    // 查找用户
    const user = users.find(u => u.username === credentials.username);
    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 更新最后登录时间
    const updatedUser = { ...user, lastLoginAt: new Date().toISOString() };
    
    // 更新用户列表
    const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
    await vercelBlob.put(userListPath, JSON.stringify(updatedUsers), {
      access: 'public',
    });
    
    // 更新用户详情
    await vercelBlob.put(`users/${user.id}.json`, JSON.stringify(updatedUser), {
      access: 'public',
    });
    
    // 返回用户信息，不含密码
    const { password, ...userWithoutPassword } = updatedUser;
    return NextResponse.json(userWithoutPassword, { status: 200 });
  } catch (error) {
    console.error('用户登录失败:', error);
    return NextResponse.json({ error: '用户登录失败' }, { status: 500 });
  }
} 
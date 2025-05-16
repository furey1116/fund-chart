import { NextRequest, NextResponse } from 'next/server';
import * as vercelBlob from '@vercel/blob';
import { RegisterRequest, User, createUser } from '@/types/user';
import bcrypt from 'bcryptjs';

// 用户注册
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const userData = await request.json() as RegisterRequest;
    
    // 验证请求字段
    if (!userData.username || !userData.password || !userData.displayName) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }
    
    // 获取所有用户
    const { blobs } = await vercelBlob.list({
      prefix: 'users/',
    });
    
    // 检查用户名是否已存在
    let existingUsers: User[] = [];
    const userListPath = 'users/user-list-main.json';
    
    if (blobs.length > 0) {
      // 获取所有用户列表文件
      const userListBlobs = blobs.filter(blob => blob.pathname.includes('user-list'));
      
      // 合并所有用户列表中的用户
      if (userListBlobs.length > 0) {
        // 获取所有用户列表中的用户
        const allUsers: User[] = [];
        
        for (const blob of userListBlobs) {
          try {
            const response = await fetch(blob.url);
            if (response.ok) {
              const text = await response.text();
              const users = JSON.parse(text) as User[];
              allUsers.push(...users);
            }
          } catch (error) {
            console.error(`读取用户列表文件 ${blob.pathname} 失败:`, error);
          }
        }
        
        // 去重用户列表
        const uniqueUsers = Array.from(
          new Map(allUsers.map(user => [user.id, user])).values()
        );
        
        existingUsers = uniqueUsers;
      }
      
      // 检查用户名是否已存在
      const userExists = existingUsers.some(user => user.username === userData.username);
      if (userExists) {
        return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
      }
    }
    
    // 密码加密
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    
    // 创建新用户
    const newUser = createUser({
      username: userData.username,
      password: hashedPassword,
      displayName: userData.displayName,
      email: userData.email
    });
    
    // 更新用户列表
    existingUsers.push(newUser);
    
    // 保存用户列表
    await vercelBlob.put(userListPath, JSON.stringify(existingUsers), {
      access: 'public',
    });
    
    // 单独保存用户详情
    await vercelBlob.put(`users/${newUser.id}.json`, JSON.stringify(newUser), {
      access: 'public',
    });
    
    // 返回用户信息,不含密码
    const { password, ...userWithoutPassword } = newUser;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('注册用户失败:', error);
    return NextResponse.json({ error: '注册用户失败' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import * as vercelBlob from '@vercel/blob';
import { User } from '@/types/user';

// u83b7u53d6u7528u6237u4fe1u606f
export async function GET(request: NextRequest) {
  try {
    // u83b7u53d6u7528u6237ID
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'u7f3au5c11u7528u6237ID' }, { status: 400 });
    }
    
    // u5c1du8bd5u76f4u63a5u83b7u53d6u7528u6237u8be6u60c5
    const { blobs } = await vercelBlob.list({
      prefix: `users/${userId}`,
    });
    
    // u5982u679cu627eu5230u4e86u7528u6237u8be6u60c5u6587u4ef6
    const userBlob = blobs.find(blob => blob.pathname === `users/${userId}.json`);
    if (userBlob) {
      const response = await fetch(userBlob.url);
      if (response.ok) {
        const text = await response.text();
        const user = JSON.parse(text) as User;
        
        // u79fb9664u5bc6u7801u540eu8fd4u56de
        const { password, ...userWithoutPassword } = user;
        return NextResponse.json(userWithoutPassword, { status: 200 });
      }
    }
    
    // 如果没有直接的用户文件，尝试从用户列表中查找
    const userListResponse = await vercelBlob.list({
      prefix: 'users/',
    });
    
    // 获取所有用户列表文件
    const userListBlobs = userListResponse.blobs.filter(blob => blob.pathname.includes('user-list'));
    if (userListBlobs.length === 0) {
      return NextResponse.json({ error: '未找到用户' }, { status: 404 });
    }
    
    // 合并所有用户列表中的用户
    let allUsers: User[] = [];
    
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
    const users = Array.from(
      new Map(allUsers.map(user => [user.id, user])).values()
    );
    
    // 查找用户
    const user = users.find(u => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: '未找到用户' }, { status: 404 });
    }
    
    // u79fb9664u5bc6u7801u540eu8fd4u56de
    const { password, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 200 });
  } catch (error) {
    console.error('u83b7u53d6u7528u6237u4fe1u606fu5931u8d25:', error);
    return NextResponse.json({ error: 'u83b7u53d6u7528u6237u4fe1u606fu5931u8d25' }, { status: 500 });
  }
} 
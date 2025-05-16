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
    
    const userListBlob = userListResponse.blobs.find(blob => blob.pathname.includes('user-list'));
    if (!userListBlob) {
      return NextResponse.json({ error: '未找到用户' }, { status: 404 });
    }
    
    // u83b7u53d6u7528u6237u5217u8868
    const response = await fetch(userListBlob.url);
    if (!response.ok) {
      return NextResponse.json({ error: 'u65e0u6cd5u83b7u53d6u7528u6237u5217u8868' }, { status: 500 });
    }
    
    const text = await response.text();
    const users = JSON.parse(text) as User[];
    
    // u67e5u627eu7528u6237
    const user = users.find(u => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: 'u672au627eu5230u7528u6237' }, { status: 404 });
    }
    
    // u79fb9664u5bc6u7801u540eu8fd4u56de
    const { password, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 200 });
  } catch (error) {
    console.error('u83b7u53d6u7528u6237u4fe1u606fu5931u8d25:', error);
    return NextResponse.json({ error: 'u83b7u53d6u7528u6237u4fe1u606fu5931u8d25' }, { status: 500 });
  }
} 
// 从Vercel Blob迁移用户数据到PostgreSQL
import { PrismaClient } from '@prisma/client';
import * as vercelBlob from '@vercel/blob';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function migrateUsers() {
  try {
    console.log('开始迁移用户数据...');
    
    // 获取所有用户列表文件
    const { blobs } = await vercelBlob.list({
      prefix: 'users/',
    });
    
    const userListBlobs = blobs.filter(blob => blob.pathname.includes('user-list'));
    
    if (userListBlobs.length === 0) {
      console.log('未找到用户列表文件');
      return;
    }
    
    console.log(`找到 ${userListBlobs.length} 个用户列表文件`);
    
    // 合并所有用户列表中的用户
    let allUsers = [];
    
    for (const blob of userListBlobs) {
      try {
        console.log(`读取文件: ${blob.pathname}`);
        const response = await fetch(blob.url);
        if (response.ok) {
          const text = await response.text();
          const users = JSON.parse(text);
          allUsers.push(...users);
          console.log(`从 ${blob.pathname} 读取到 ${users.length} 个用户`);
        }
      } catch (error) {
        console.error(`读取用户列表文件 ${blob.pathname} 失败:`, error);
      }
    }
    
    // 去重用户列表
    const uniqueUsers = Array.from(
      new Map(allUsers.map(user => [user.id, user])).values()
    );
    
    console.log(`合并后共有 ${uniqueUsers.length} 个唯一用户`);
    
    // 将用户数据写入PostgreSQL
    for (const user of uniqueUsers) {
      // 格式化日期字段
      const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
      const lastLoginAt = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
      
      try {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            username: user.username,
            password: user.password,
            displayName: user.displayName,
            email: user.email || null,
            lastLoginAt
          },
          create: {
            id: user.id,
            username: user.username,
            password: user.password,
            displayName: user.displayName,
            email: user.email || null,
            createdAt,
            lastLoginAt
          }
        });
        console.log(`用户 ${user.username} (${user.id}) 迁移成功`);
      } catch (error) {
        console.error(`迁移用户 ${user.username} (${user.id}) 失败:`, error);
      }
    }
    
    console.log('用户数据迁移完成');
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUsers(); 
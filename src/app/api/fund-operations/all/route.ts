import { NextRequest, NextResponse } from 'next/server';
import * as vercelBlob from '@vercel/blob';
import { FundOperation } from '@/types/fundOperation';

// 获取用户的所有基金操作记录
export async function GET(request: NextRequest) {
  try {
    // 从请求URL获取用户ID
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }
    
    // 获取所有基金操作相关的Blob文件夹
    const { blobs } = await vercelBlob.list({
      prefix: 'fundOperations/',
    });
    
    // 根据存在操作记录的文件夹
    const fundCodeFolders = new Set<string>();
    
    // 提取所有不同的基金代码文件夹
    blobs.forEach(blob => {
      const pathParts = blob.pathname.split('/');
      if (pathParts.length > 2) { // fundOperations/FUNDCODE/...
        fundCodeFolders.add(pathParts[1]);
      }
    });
    
    // 收集所有基金的操作记录
    let allOperations: FundOperation[] = [];
    
    // 从每个基金代码文件夹中获取记录
    for (const fundCode of Array.from(fundCodeFolders)) {
      // 获取每个基金的Blob文件
      const fundBlobs = blobs.filter(blob => 
        blob.pathname.startsWith(`fundOperations/${fundCode}/`)
      );
      
      if (fundBlobs.length === 0) {
        continue;
      }
      
      // 获取最新的文件
      const latestBlob = fundBlobs.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      
      // 获取文件内容
      const response = await fetch(latestBlob.url);
      if (!response.ok) {
        continue;
      }
      
      const text = await response.text();
      const operations = JSON.parse(text) as FundOperation[];
      
      // 过滤对应用户的操作记录
      const userOperations = operations.filter(op => op.userId === userId);
      allOperations.push(...userOperations);
    }
    
    // 按日期降序排序
    allOperations.sort((a, b) => 
      new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime()
    );
    
    return NextResponse.json(allOperations, { status: 200 });
  } catch (error) {
    console.error('获取所有基金操作记录失败:', error);
    return NextResponse.json({ error: '获取所有基金操作记录失败' }, { status: 500 });
  }
} 
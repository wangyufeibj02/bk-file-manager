/**
 * 检查 .mov 文件的缩略图状态
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 查找所有 .mov 文件
  const movFiles = await prisma.file.findMany({
    where: {
      OR: [
        { path: { endsWith: '.mov' } },
        { path: { endsWith: '.MOV' } },
        { originalName: { endsWith: '.mov' } },
        { originalName: { endsWith: '.MOV' } },
      ],
    },
    select: {
      id: true,
      originalName: true,
      path: true,
      thumbnailPath: true,
      mimeType: true,
      width: true,
      height: true,
    },
    take: 20,
  });

  console.log(`\n找到 ${movFiles.length} 个 .mov 文件:\n`);

  for (const file of movFiles) {
    console.log(`文件名: ${file.originalName}`);
    console.log(`  路径: ${file.path}`);
    console.log(`  MIME: ${file.mimeType}`);
    console.log(`  缩略图: ${file.thumbnailPath || '无'}`);
    console.log(`  尺寸: ${file.width}x${file.height}`);
    console.log('');
  }

  // 统计
  const withThumb = movFiles.filter(f => f.thumbnailPath).length;
  const withoutThumb = movFiles.filter(f => !f.thumbnailPath).length;
  
  console.log(`=== 统计 ===`);
  console.log(`有缩略图: ${withThumb}`);
  console.log(`无缩略图: ${withoutThumb}`);

  await prisma.$disconnect();
}

main().catch(console.error);

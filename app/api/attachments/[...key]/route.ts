import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return new NextResponse('Unauthorized: Please sign in to access expense attachments.', { status: 401 });
    }

    const resolvedParams = await params;
    const keyArray = resolvedParams?.key || [];
    if (keyArray.length === 0) {
      return new NextResponse('Invalid attachment path', { status: 400 });
    }

    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
    // Sanitize any path characters
    const safeSegments = keyArray.map((seg) => seg.replace(/[/\\?%*:|"<>]/g, ''));
    const localFilePath = path.resolve(uploadsDir, ...safeSegments);

    // Strict boundary enforcement: must reside within public/uploads
    if (!localFilePath.startsWith(uploadsDir + path.sep)) {
      return new NextResponse('Access Denied', { status: 403 });
    }

    if (fs.existsSync(localFilePath)) {
      const stat = fs.statSync(localFilePath);
      const fileBuffer = fs.readFileSync(localFilePath);

      const ext = path.extname(localFilePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.pdf') contentType = 'application/pdf';

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': stat.size.toString(),
          'Cache-Control': 'public, max-age=86400, immutable',
        },
      });
    }

    return new NextResponse('Attachment not found', { status: 404 });
  } catch (err: any) {
    console.error('[Attachment Route Error]:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

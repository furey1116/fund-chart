declare module '@vercel/blob' {
  export interface Blob {
    url: string;
    pathname: string;
    contentType: string;
    contentDisposition: string | null;
    uploadedAt: string;
    size: number;
  }

  export interface ListBlobResult {
    blobs: Blob[];
    cursor: string | null;
  }

  export interface PutBlobResult {
    url: string;
    pathname: string;
  }

  export interface PutBlobOptions {
    access?: 'public' | 'private';
    addRandomSuffix?: boolean;
    contentType?: string;
    contentDisposition?: string;
    cacheControlMaxAge?: number;
  }

  export function list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListBlobResult>;

  export function put(
    pathname: string, 
    body: string | ArrayBuffer | Uint8Array | Blob | ReadableStream, 
    options?: PutBlobOptions
  ): Promise<PutBlobResult>;

  export function del(urlOrPathname: string | string[]): Promise<void>;
} 
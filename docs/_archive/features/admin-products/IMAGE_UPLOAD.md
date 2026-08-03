# Image Upload Component

Image upload system with Vercel Blob Storage integration for product images.

## 📌 Overview

The ImageUpload component handles:
- Multi-image uploads to Vercel Blob Storage
- Drag-and-drop file selection
- Image preview and reordering
- Primary thumbnail selection
- Image deletion
- Progress indicators

**File**: `src/components/admin/image-upload.tsx` (~150 lines)

## 🎯 Key Features

1. **Multiple Upload Methods**:
   - File input click
   - Drag and drop
   - Paste from clipboard (future)

2. **Image Management**:
   - Reorder images (drag or arrows)
   - Set primary thumbnail
   - Delete images
   - Preview before upload

3. **Validation**:
   - File type (jpg, png, webp)
   - File size (max 4.5MB)
   - Max images limit

## 🔧 Component Structure

```typescript
interface ImageUploadProps {
  images: string[];          // Array of uploaded image URLs
  thumbnail: string;         // Primary image URL
  onImagesChange: (images: string[]) => void;
  onThumbnailChange: (url: string) => void;
  maxImages?: number;        // Default: 8
}

export function ImageUpload({
  images,
  thumbnail,
  onImagesChange,
  onThumbnailChange,
  maxImages = 8
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Handlers
  const handleFileSelect = async (files: FileList) => { /* ... */ };
  const handleDrop = (e: DragEvent) => { /* ... */ };
  const handleDelete = (url: string) => { /* ... */ };
  const handleReorder = (fromIndex: number, toIndex: number) => { /* ... */ };
  const handleSetThumbnail = (url: string) => { /* ... */ };
  
  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {/* Image Grid */}
    </div>
  );
}
```

## 📤 Upload Process

### 1. File Validation

```typescript
function validateFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 4.5 * 1024 * 1024; // 4.5MB
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPG, PNG, and WebP images are allowed'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image size must be less than 4.5MB'
    };
  }
  
  return { valid: true };
}
```

### 2. Upload to Vercel Blob

```typescript
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  const { url } = await response.json();
  return url;
}
```

### 3. Handle Multiple Files

```typescript
async function handleFileSelect(files: FileList) {
  if (images.length + files.length > maxImages) {
    toast.error(`Maximum ${maxImages} images allowed`);
    return;
  }
  
  setIsUploading(true);
  const uploadedUrls: string[] = [];
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
        continue;
      }
      
      // Upload
      const url = await uploadImage(file);
      uploadedUrls.push(url);
      
      // Update progress
      setUploadProgress(((i + 1) / files.length) * 100);
    }
    
    // Update state
    const newImages = [...images, ...uploadedUrls];
    onImagesChange(newImages);
    
    // Set first image as thumbnail if none set
    if (!thumbnail && uploadedUrls.length > 0) {
      onThumbnailChange(uploadedUrls[0]);
    }
    
    toast.success(`${uploadedUrls.length} image(s) uploaded`);
  } catch (error) {
    toast.error('Upload failed');
  } finally {
    setIsUploading(false);
    setUploadProgress(0);
  }
}
```

## 🎨 UI Implementation

### Upload Area

```typescript
<div
  onDrop={handleDrop}
  onDragOver={(e) => e.preventDefault()}
  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition"
>
  <input
    type="file"
    multiple
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
    className="hidden"
    id="file-upload"
  />
  
  <label htmlFor="file-upload" className="cursor-pointer">
    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
    <p className="text-lg font-medium mb-2">
      Drop images here or click to upload
    </p>
    <p className="text-sm text-gray-500">
      JPG, PNG or WebP (max {maxImages} images, 4.5MB each)
    </p>
  </label>
  
  {isUploading && (
    <div className="mt-4">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-emerald-600 h-2 rounded-full transition-all"
          style={{ width: `${uploadProgress}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 mt-2">
        Uploading... {Math.round(uploadProgress)}%
      </p>
    </div>
  )}
</div>
```

### Image Grid with Reordering

```typescript
<div className="grid grid-cols-4 gap-4">
  {images.map((url, index) => (
    <div
      key={url}
      className={cn(
        "relative group border-2 rounded-lg overflow-hidden",
        thumbnail === url ? "border-emerald-500" : "border-gray-200"
      )}
    >
      {/* Image Preview */}
      <img
        src={url}
        alt={`Product image ${index + 1}`}
        className="w-full h-48 object-cover"
      />
      
      {/* Primary Badge */}
      {thumbnail === url && (
        <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded">
          Primary
        </div>
      )}
      
      {/* Actions Overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
        {/* Set as Primary */}
        {thumbnail !== url && (
          <button
            onClick={() => handleSetThumbnail(url)}
            className="p-2 bg-white rounded-full hover:bg-gray-100"
            title="Set as primary"
          >
            <Star className="w-4 h-4" />
          </button>
        )}
        
        {/* Move Up */}
        {index > 0 && (
          <button
            onClick={() => handleReorder(index, index - 1)}
            className="p-2 bg-white rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        
        {/* Move Down */}
        {index < images.length - 1 && (
          <button
            onClick={() => handleReorder(index, index + 1)}
            className="p-2 bg-white rounded-full hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        
        {/* Delete */}
        <button
          onClick={() => handleDelete(url)}
          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  ))}
</div>
```

## 🗄️ Backend API

**File**: `src/app/api/admin/upload/route.ts`

```typescript
import { put } from '@vercel/blob';
import { getServerSession } from 'next-auth';

export async function POST(req: Request) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    });
    
    return Response.json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

## ⚡ Performance Tips

1. **Optimize Images Before Upload** (future):
```typescript
async function compressImage(file: File): Promise<File> {
  // Use browser-image-compression or similar
  return await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
  });
}
```

2. **Lazy Load Previews**:
```typescript
<img
  src={url}
  loading="lazy"
  alt="Product"
/>
```

3. **Parallel Uploads**:
```typescript
const uploadPromises = Array.from(files).map(uploadImage);
const urls = await Promise.all(uploadPromises);
```

---

**Last Updated**: December 2025


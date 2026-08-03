# Product Form - Create & Edit Products

Complete guide to the product creation and editing form component.

## 📌 Overview

The ProductForm component is a comprehensive form for creating and editing products with:
- Multi-step validation
- Image uploads with preview
- Variant management (sizes, colors)
- Real-time slug generation
- Feature flags
- Tag management

**File**: `src/components/admin/product-form.tsx` (446 lines)

## 🏗️ Form Structure

```typescript
interface ProductFormProps {
  initialData?: AdminProduct; // For edit mode
  mode: "create" | "edit";
}

export function ProductForm({ initialData, mode }: ProductFormProps) {
  // Form state
  const [name, setName] = useState(initialData?.name || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || 0);
  const [salePrice, setSalePrice] = useState(initialData?.salePrice || null);
  const [stock, setStock] = useState(initialData?.stock || 0);
  const [lowStockThreshold, setLowStockThreshold] = useState(initialData?.lowStockThreshold || 10);
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [images, setImages] = useState<string[]>(initialData?.images || []);
  const [thumbnail, setThumbnail] = useState(initialData?.thumbnail || "");
  const [sizes, setSizes] = useState<string[]>(initialData?.sizes || []);
  const [colors, setColors] = useState<string[]>(initialData?.colors || []);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured || false);
  const [isHero, setIsHero] = useState(initialData?.isHero || false);
  const [isOnOffer, setIsOnOffer] = useState(initialData?.isOnOffer || false);
  const [sku, setSku] = useState(initialData?.sku || "");
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // ... handlers and render
}
```

## 📝 Form Fields

### 1. Basic Information

#### Product Name
```typescript
<div>
  <label className="block text-sm font-medium mb-1">
    Product Name *
  </label>
  <input
    type="text"
    value={name}
    onChange={(e) => {
      setName(e.target.value);
      // Auto-generate slug
      if (!slugManuallyEdited) {
        setSlug(generateSlug(e.target.value));
      }
    }}
    className="w-full px-4 py-2 border rounded-lg"
    placeholder="Blue Cotton T-Shirt"
    required
  />
  {errors.name && (
    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
  )}
</div>
```

#### Product Slug
```typescript
<div>
  <label className="block text-sm font-medium mb-1">
    Slug (URL) *
  </label>
  <div className="flex gap-2">
    <input
      type="text"
      value={slug}
      onChange={(e) => {
        setSlug(e.target.value);
        setSlugManuallyEdited(true);
      }}
      className="flex-1 px-4 py-2 border rounded-lg"
      placeholder="blue-cotton-t-shirt"
      required
    />
    <button
      type="button"
      onClick={() => {
        setSlug(generateSlug(name));
        setSlugManuallyEdited(false);
      }}
      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
    >
      <RefreshCw className="w-4 h-4" />
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-1">
    URL: /product/{slug || "slug"}
  </p>
</div>
```

**Slug Generation**:
```typescript
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove consecutive hyphens
}
```

#### Description
```typescript
<div>
  <label className="block text-sm font-medium mb-1">
    Description *
  </label>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    rows={6}
    className="w-full px-4 py-2 border rounded-lg"
    placeholder="Detailed product description..."
    required
  />
</div>
```

### 2. Images Section

```typescript
<div>
  <label className="block text-sm font-medium mb-2">
    Product Images *
  </label>
  
  <ImageUpload
    images={images}
    thumbnail={thumbnail}
    onImagesChange={setImages}
    onThumbnailChange={setThumbnail}
    maxImages={8}
  />
  
  {errors.images && (
    <p className="text-red-500 text-sm mt-1">{errors.images}</p>
  )}
</div>
```

See [IMAGE_UPLOAD.md](./IMAGE_UPLOAD.md) for detailed image upload documentation.

### 3. Pricing & Inventory

```typescript
<div className="grid grid-cols-2 gap-4">
  {/* Regular Price */}
  <div>
    <label className="block text-sm font-medium mb-1">
      Regular Price (₹) *
    </label>
    <input
      type="number"
      value={price}
      onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
      min="0"
      step="0.01"
      className="w-full px-4 py-2 border rounded-lg"
      required
    />
  </div>
  
  {/* Sale Price */}
  <div>
    <label className="block text-sm font-medium mb-1">
      Sale Price (₹)
    </label>
    <input
      type="number"
      value={salePrice || ""}
      onChange={(e) => setSalePrice(parseFloat(e.target.value) || null)}
      min="0"
      step="0.01"
      className="w-full px-4 py-2 border rounded-lg"
      placeholder="Optional"
    />
  </div>
</div>

<div className="grid grid-cols-2 gap-4 mt-4">
  {/* Stock */}
  <div>
    <label className="block text-sm font-medium mb-1">
      Stock Quantity *
    </label>
    <input
      type="number"
      value={stock}
      onChange={(e) => setStock(parseInt(e.target.value) || 0)}
      min="0"
      className="w-full px-4 py-2 border rounded-lg"
      required
    />
  </div>
  
  {/* Low Stock Threshold */}
  <div>
    <label className="block text-sm font-medium mb-1">
      Low Stock Alert At
    </label>
    <input
      type="number"
      value={lowStockThreshold}
      onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 10)}
      min="0"
      className="w-full px-4 py-2 border rounded-lg"
    />
  </div>
</div>
```

**Price Validation**:
```typescript
function validatePricing() {
  if (price <= 0) {
    setErrors(prev => ({ ...prev, price: "Price must be greater than 0" }));
    return false;
  }
  
  if (salePrice && salePrice >= price) {
    setErrors(prev => ({ ...prev, salePrice: "Sale price must be less than regular price" }));
    return false;
  }
  
  return true;
}
```

### 4. Category & Variants

#### Category Selection
```typescript
<div>
  <label className="block text-sm font-medium mb-1">
    Category *
  </label>
  <select
    value={categoryId}
    onChange={(e) => setCategoryId(e.target.value)}
    className="w-full px-4 py-2 border rounded-lg"
    required
  >
    <option value="">Select a category</option>
    {categories.map((category) => (
      <option key={category.id} value={category.id}>
        {category.name}
      </option>
    ))}
  </select>
</div>
```

#### Sizes Selection
```typescript
<div>
  <label className="block text-sm font-medium mb-2">
    Available Sizes
  </label>
  <div className="flex flex-wrap gap-2">
    {AVAILABLE_SIZES.map((size) => (
      <label
        key={size}
        className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50"
      >
        <input
          type="checkbox"
          checked={sizes.includes(size)}
          onChange={(e) => {
            if (e.target.checked) {
              setSizes([...sizes, size]);
            } else {
              setSizes(sizes.filter(s => s !== size));
            }
          }}
        />
        <span>{size}</span>
      </label>
    ))}
  </div>
</div>

// Constants
const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
```

#### Colors Management
```typescript
<div>
  <label className="block text-sm font-medium mb-2">
    Available Colors
  </label>
  
  <div className="flex flex-wrap gap-2 mb-2">
    {colors.map((color, index) => (
      <div
        key={index}
        className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full"
      >
        <span>{color}</span>
        <button
          type="button"
          onClick={() => setColors(colors.filter((_, i) => i !== index))}
          className="text-red-500 hover:text-red-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
  
  <div className="flex gap-2">
    <input
      type="text"
      value={newColor}
      onChange={(e) => setNewColor(e.target.value)}
      placeholder="Enter color name"
      className="flex-1 px-4 py-2 border rounded-lg"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddColor();
        }
      }}
    />
    <button
      type="button"
      onClick={handleAddColor}
      className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
    >
      Add Color
    </button>
  </div>
</div>
```

### 5. Feature Flags

```typescript
<div className="space-y-3">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={isFeatured}
      onChange={(e) => setIsFeatured(e.target.checked)}
      className="w-4 h-4"
    />
    <span className="font-medium">Featured Product</span>
    <span className="text-sm text-gray-600">
      (Show on homepage featured section)
    </span>
  </label>
  
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={isHero}
      onChange={(e) => setIsHero(e.target.checked)}
      className="w-4 h-4"
    />
    <span className="font-medium">Hero Product</span>
    <span className="text-sm text-gray-600">
      (Show in hero section)
    </span>
  </label>
  
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={isOnOffer}
      onChange={(e) => setIsOnOffer(e.target.checked)}
      className="w-4 h-4"
    />
    <span className="font-medium">On Offer</span>
    <span className="text-sm text-gray-600">
      (Show in offers section)
    </span>
  </label>
</div>
```

### 6. Tags

```typescript
<div>
  <label className="block text-sm font-medium mb-2">
    Search Tags
  </label>
  
  <div className="flex flex-wrap gap-2 mb-2">
    {tags.map((tag, index) => (
      <div
        key={index}
        className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
      >
        <span>{tag}</span>
        <button
          type="button"
          onClick={() => setTags(tags.filter((_, i) => i !== index))}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
  
  <div className="flex gap-2">
    <input
      type="text"
      value={newTag}
      onChange={(e) => setNewTag(e.target.value)}
      placeholder="Enter tag (e.g., cotton, casual)"
      className="flex-1 px-4 py-2 border rounded-lg"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddTag();
        }
      }}
    />
    <button
      type="button"
      onClick={handleAddTag}
      className="px-4 py-2 border rounded-lg"
    >
      Add Tag
    </button>
  </div>
</div>
```

## ✅ Form Validation

```typescript
function validateForm(): boolean {
  const newErrors: Record<string, string> = {};
  
  // Required fields
  if (!name.trim()) {
    newErrors.name = "Product name is required";
  }
  
  if (!slug.trim()) {
    newErrors.slug = "Slug is required";
  }
  
  if (!description.trim()) {
    newErrors.description = "Description is required";
  }
  
  if (images.length === 0) {
    newErrors.images = "At least one image is required";
  }
  
  if (!categoryId) {
    newErrors.categoryId = "Please select a category";
  }
  
  // Pricing validation
  if (price <= 0) {
    newErrors.price = "Price must be greater than 0";
  }
  
  if (salePrice && salePrice >= price) {
    newErrors.salePrice = "Sale price must be less than regular price";
  }
  
  // Stock validation
  if (stock < 0) {
    newErrors.stock = "Stock cannot be negative";
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}
```

## 📤 Form Submission

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  
  // Validate
  if (!validateForm()) {
    toast.error("Please fix form errors");
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    const productData = {
      name,
      slug,
      description,
      price,
      salePrice: salePrice || null,
      categoryId,
      tags,
      isFeatured,
      isHero,
      isOnOffer,
      images,
      thumbnail: thumbnail || images[0],
      sizes,
      colors,
      stock,
      lowStockThreshold,
      sku: sku || null,
    };
    
    if (mode === "create") {
      await adminProductService.createProduct(productData);
      toast.success("Product created successfully!");
      router.push("/admin/products");
    } else {
      await adminProductService.updateProduct(initialData!.id, productData);
      toast.success("Product updated successfully!");
      router.push("/admin/products");
    }
  } catch (error) {
    console.error("Submit error:", error);
    toast.error(
      error instanceof Error 
        ? error.message 
        : "Failed to save product"
    );
  } finally {
    setIsSubmitting(false);
  }
}
```

## 🎨 Form Actions

```typescript
<div className="flex justify-end gap-4 pt-6 border-t">
  <button
    type="button"
    onClick={() => router.back()}
    disabled={isSubmitting}
    className="px-6 py-2 border rounded-lg hover:bg-gray-50"
  >
    Cancel
  </button>
  
  <button
    type="submit"
    disabled={isSubmitting}
    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
  >
    {isSubmitting ? (
      <span className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Saving...
      </span>
    ) : (
      mode === "create" ? "Create Product" : "Update Product"
    )}
  </button>
</div>
```

## 🔄 Auto-Save Draft (Future Feature)

```typescript
// Debounced auto-save
useEffect(() => {
  const timer = setTimeout(() => {
    if (isDirty && mode === "edit") {
      saveDraft();
    }
  }, 5000); // Auto-save after 5s of inactivity
  
  return () => clearTimeout(timer);
}, [name, description, price, /* other fields */]);

async function saveDraft() {
  try {
    await localStorage.setItem(
      `product-draft-${initialData?.id || 'new'}`,
      JSON.stringify({ name, description, price, /* ... */ })
    );
  } catch (error) {
    console.error("Failed to save draft:", error);
  }
}
```

---

**Next**: [Image Upload](./IMAGE_UPLOAD.md) - Image management system

**Last Updated**: December 2025


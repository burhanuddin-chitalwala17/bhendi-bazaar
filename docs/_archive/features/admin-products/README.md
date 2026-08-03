# Admin Products Management - Overview

Complete guide to the product management system in the admin panel.

## 📌 Quick Summary

The admin products module provides comprehensive tools for managing the product catalog:
- **Product listing** with advanced filtering and search
- **Create/Edit forms** with image uploads
- **Bulk operations** (delete, feature, offer status)
- **Stock management** and alerts
- **Category assignment**
- **SEO-friendly slugs** auto-generation

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────┐
│            ADMIN PRODUCTS ARCHITECTURE                 │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Admin UI (React Client Components)                   │
│    ├── Products List Page (Data Table)                │
│    ├── Create Product Page (Form)                     │
│    ├── Edit Product Page (Form)                       │
│    └── Image Upload Component                         │
│                     ↓                                  │
│  Client Services                                       │
│    └── adminProductService.ts                         │
│                     ↓                                  │
│  API Routes (Protected)                                │
│    ├── GET  /api/admin/products                       │
│    ├── GET  /api/admin/products/[id]                  │
│    ├── POST /api/admin/products                       │
│    ├── PUT  /api/admin/products/[id]                  │
│    └── DELETE /api/admin/products/[id]                │
│                     ↓                                  │
│  Server Services                                       │
│    └── AdminProductService                            │
│                     ↓                                  │
│  Repositories                                          │
│    └── AdminProductRepository                         │
│                     ↓                                  │
│  Database (Prisma + PostgreSQL)                        │
│                                                        │
└───────────────────────────────────────────────────────┘
```

## 📁 Key Files

### Frontend (UI)
| File | Purpose | Lines |
|------|---------|-------|
| `src/app/(admin)/admin/products/page.tsx` | Products list/table | ~400 |
| `src/app/(admin)/admin/products/new/page.tsx` | Create product | ~16 |
| `src/app/(admin)/admin/products/[id]/page.tsx` | Edit product | ~30 |
| `src/components/admin/product-form.tsx` | Product form | ~446 |
| `src/components/admin/image-upload.tsx` | Image uploader | ~150 |
| `src/components/admin/data-table.tsx` | Reusable table | ~200 |

### Backend
| File | Purpose | Lines |
|------|---------|-------|
| `src/app/api/admin/products/route.ts` | List/Create API | ~100 |
| `src/app/api/admin/products/[id]/route.ts` | Get/Update/Delete | ~120 |
| `src/app/api/admin/upload/route.ts` | Image upload | ~80 |
| `src/server/services/admin/productService.ts` | Business logic | ~250 |
| `src/server/repositories/admin/productRepository.ts` | Database access | ~337 |
| `src/services/admin/productService.ts` | Client service | ~150 |

## 🎯 Core Features

### 1. Product Listing
- Paginated table view
- Search by name, SKU, tags
- Filter by category, status, stock
- Sort by multiple fields
- Bulk selection
- Quick actions (edit, delete, clone)

### 2. Create/Edit Products
- Rich form with validation
- Multiple image uploads
- Drag-and-drop image reordering
- Category selection
- Size/color variants
- Pricing (regular + sale)
- Stock management
- Feature flags (Featured, Hero, On Offer)
- SEO slug auto-generation
- Tags for search

### 3. Image Management
- Upload to Vercel Blob Storage
- Preview before upload
- Drag-and-drop reordering
- Set primary thumbnail
- Delete images
- Automatic optimization

### 4. Stock Management
- Real-time stock levels
- Low stock alerts
- Configurable threshold
- Out of stock indicators
- Stock history (future)

### 5. Bulk Operations
- Multi-select products
- Bulk delete
- Bulk feature toggle
- Bulk offer toggle
- Bulk category change

## 📊 Data Flow Examples

### Creating a Product

```
1. Admin clicks "Add Product"
   ↓
2. Navigate to /admin/products/new
   ↓
3. Fill ProductForm:
   - Name, description
   - Upload images
   - Set prices
   - Choose category
   - Add sizes/colors
   - Set stock
   ↓
4. Submit form
   ↓
5. POST /api/admin/products
   - Validate data
   - Generate slug
   - Create product
   - Log admin action
   ↓
6. Redirect to products list
   ↓
7. Show success toast
```

### Uploading Product Images

```
1. User selects images (file input or drag-drop)
   ↓
2. Images validated (size, type)
   ↓
3. For each image:
   ↓
4. POST /api/admin/upload
   - Upload to Vercel Blob
   - Get CDN URL
   ↓
5. Add URL to form state
   ↓
6. Show preview in ImageUpload component
   ↓
7. Can reorder, delete, set as thumbnail
   ↓
8. URLs submitted with product form
```

### Filtering Products

```
1. Admin selects filters:
   - Category: "Men's Clothing"
   - Stock status: "Low Stock"
   - Search: "shirt"
   ↓
2. Update URL params:
   ?category=men&lowStock=true&search=shirt
   ↓
3. GET /api/admin/products with filters
   ↓
4. Server builds WHERE clause
   ↓
5. Prisma query with conditions
   ↓
6. Return filtered, paginated results
   ↓
7. Update table display
```

## 🎨 User Interface

### Products Table Layout

```
┌─────────────────────────────────────────────────────────┐
│  Products (450)            [Search...] [+ Add Product]   │
├─────────────────────────────────────────────────────────┤
│  Filters:                                                │
│  [Category ▼] [Status ▼] [Stock ▼] [Clear Filters]     │
├─────────────────────────────────────────────────────────┤
│  ☐  Image    Name         Price    Stock   Category     │
│  ☐  [img]    Blue Shirt   ₹999     45      Men         │
│  ☐  [img]    Red Dress    ₹1499    2 ⚠️    Women       │
│  ☐  [img]    Kids Tee     ₹499     0 ❌    Kids        │
│                                                          │
│  ← 1 2 3 ... 10 →                     Showing 1-20 of   │
└─────────────────────────────────────────────────────────┘
```

### Product Form Layout

```
┌─────────────────────────────────────────────────────────┐
│  Create Product                                [Cancel] [Save] │
├─────────────────────────────────────────────────────────┤
│  Basic Information                                       │
│  Name:          [                           ]           │
│  Slug:          [auto-generated            ] 🔄         │
│  Description:   [                           ]           │
│                 [                           ]           │
│                                                          │
│  Images                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  [+ Upload]    │
│  │ Image 1 │  │ Image 2 │  │ Image 3 │                 │
│  │ Primary │  │ [↑][↓] │  │ [↑][↓] │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
│                                                          │
│  Pricing & Inventory                                     │
│  Regular Price:  [        ]  Sale Price:   [        ]   │
│  Stock:          [        ]  Low Stock:    [   10   ]   │
│                                                          │
│  Category & Variants                                     │
│  Category:       [Select ▼]                             │
│  Sizes:          □ S  □ M  □ L  □ XL                    │
│  Colors:         [Red] [Blue] [Green] [+ Add]           │
│                                                          │
│  Options                                                 │
│  ☑ Featured Product    ☑ Hero Product    ☐ On Offer    │
│                                                          │
│  Tags                                                    │
│  [shirt] [casual] [cotton] [+ Add Tag]                  │
└─────────────────────────────────────────────────────────┘
```

## 🔗 Related Documentation

**Detailed Guides:**
- [Product Table](./PRODUCT_TABLE.md) - Data table implementation
- [Product Form](./PRODUCT_FORM.md) - Create/edit form
- [Image Upload](./IMAGE_UPLOAD.md) - Image handling
- [Product API](./PRODUCT_API.md) - Backend integration

**Related Features:**
- [Categories Management](../admin-categories/README.md) - Category setup
- [Dashboard](../admin-dashboard/README.md) - Overview stats
- [User Products View](../../client-side/products/README.md) - Customer view

**Database:**
- [Product Model](../../../database/SCHEMA_OVERVIEW.md#4-product-model) - Schema details

## 🚀 Quick Start for Admins

### Adding Your First Product

1. **Login as Admin**
   - Navigate to `/admin`
   - Use admin credentials

2. **Create Product**
   - Click "Add Product"
   - Fill required fields (name, price, category)
   - Upload at least one image
   - Set stock quantity
   - Click "Save"

3. **Verify Product**
   - Check products list
   - Visit product page on main site
   - Test add to cart

### Managing Stock

1. Go to Products page
2. Find product (use search if needed)
3. Click "Edit"
4. Update "Stock" field
5. Save changes
6. Low stock alert shows if below threshold

## 🐛 Common Issues & Solutions

### Issue: Images not uploading
**Solutions**:
- Check Vercel Blob token in env
- Verify image size (max 4.5MB)
- Check file format (jpg, png, webp)
- Check network connection

### Issue: Slug conflicts
**Solution**: System auto-appends number (e.g., "blue-shirt-2")

### Issue: Product not showing on site
**Check**:
- Product has stock > 0
- Category is active
- Images uploaded successfully
- Product created successfully (check table)

### Issue: Cannot delete product
**Cause**: Product has orders or reviews
**Solution**: Soft delete or hide instead

## 📈 Future Enhancements

- [ ] Bulk import from CSV
- [ ] Product templates
- [ ] Duplicate product feature
- [ ] Product variants (better management)
- [ ] Stock history tracking
- [ ] Price history
- [ ] SEO metadata fields
- [ ] Related products picker
- [ ] Product analytics (views, conversions)
- [ ] Draft/Published status

---

**Last Updated**: December 2025  
**Maintained By**: Bhendi Bazaar Development Team


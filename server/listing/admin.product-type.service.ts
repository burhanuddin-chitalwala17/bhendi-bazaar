import { recordAdminAction } from "@server/shared/audit/audit.service";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";

import type { CreateProductTypeInput, UpdateProductTypeInput } from "./admin.product-type.types";
import { productTypeRepository } from "./product-type.repository";
import type { ProductTypeRecord } from "./product-type.types";

/**
 * Creating and editing the question sets
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) R1).
 *
 * Types are platform-wide (D11), so nothing here is scoped by org — this is an admin surface,
 * like categories. What it adds over the repository is the two rules a database cannot express:
 * a key is taken once and frozen, and a type in use is retired rather than deleted.
 */
export class AdminProductTypeService {
  async list(includeRetired = false): Promise<ProductTypeRecord[]> {
    return productTypeRepository.list(includeRetired);
  }

  async byKey(key: string): Promise<ProductTypeRecord> {
    const type = await productTypeRepository.byKey(key);
    if (!type) throw new NotFoundError("Product type not found");
    return type;
  }

  async create(adminId: string, input: CreateProductTypeInput): Promise<ProductTypeRecord> {
    // Friendlier than the unique-constraint violation the database would raise, and the
    // constraint still arbitrates if two admins race.
    if (await productTypeRepository.byKey(input.key)) {
      throw new ConflictError(`A product type with the key "${input.key}" already exists`, {
        field: "key",
      });
    }

    const created = await productTypeRepository.create(input);
    if (!created) throw new DomainError("Could not create the product type");

    await recordAdminAction({
      adminId,
      action: "PRODUCT_TYPE_CREATED",
      resource: "ProductType",
      resourceId: created.key,
      metadata: { label: created.label, facts: created.facts.length, kinds: created.kinds.length },
    });

    return created;
  }

  /**
   * Editing a type changes which questions are asked next time and rewrites nothing already
   * stored (spec R3) — answers live on the product, so removing a fact stops it being *asked*
   * and leaves every answer where it is.
   */
  async update(key: string, adminId: string, input: UpdateProductTypeInput): Promise<ProductTypeRecord> {
    const updated = await productTypeRepository.update(key, input);
    if (!updated) throw new NotFoundError("Product type not found");

    await recordAdminAction({
      adminId,
      action: "PRODUCT_TYPE_UPDATED",
      resource: "ProductType",
      resourceId: key,
      metadata: { fields: Object.keys(input) },
    });

    return updated;
  }

  /**
   * A type in use is retired, never deleted (spec R4,
   * [ADR-0032](../../docs/adr/0032-records-people-authored-are-retired-not-deleted.md)). The
   * foreign keys refuse the delete anyway; this is what turns that into a sentence somebody can
   * act on, and it names the count because "it is in use" without a number is not actionable.
   */
  async retire(key: string, adminId: string): Promise<{ retired: boolean; usage: { categories: number; products: number } }> {
    await this.byKey(key);
    const usage = await productTypeRepository.usage(key);
    const retired = await productTypeRepository.retire(key);

    await recordAdminAction({
      adminId,
      action: "PRODUCT_TYPE_RETIRED",
      resource: "ProductType",
      resourceId: key,
      metadata: usage,
    });

    return { retired, usage };
  }

  async restore(key: string, adminId: string): Promise<boolean> {
    await this.byKey(key);
    const restored = await productTypeRepository.restore(key);

    await recordAdminAction({
      adminId,
      action: "PRODUCT_TYPE_RESTORED",
      resource: "ProductType",
      resourceId: key,
    });

    return restored;
  }

  /** What the list screen shows beside each type: how much would change if it were edited. */
  async usage(key: string): Promise<{ categories: number; products: number }> {
    return productTypeRepository.usage(key);
  }
}

export const adminProductTypeService = new AdminProductTypeService();

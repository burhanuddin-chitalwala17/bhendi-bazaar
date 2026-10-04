import { DomainError, NotFoundError } from "@server/shared/domain-error";

import { categoryRepository } from "@server/catalog/category.repository";
import { productFamilyRepository, type FamilyRow } from "./product-family.repository";
import { resolveProductType } from "./product-type";
import { productTypeRepository } from "./product-type.repository";

/**
 * Making a family, and adding things to it
 * ([variants](../../docs/specs/listing-vocabulary/variants/) R1, R2, R6).
 *
 * A family is what an abaya in four colours has in common. It carries no price and no stock —
 * that is enforced by the columns not existing — so everything here is about what the siblings
 * share and what makes them differ.
 *
 * The rule a database cannot express: **a family's axis must be something its type asks about.**
 * A family varying on a question nobody answers would group products by a fact none of them has.
 */
export class ProductFamilyService {
  async list(orgId: string, includeRetired = false): Promise<FamilyRow[]> {
    return productFamilyRepository.list(orgId, includeRetired);
  }

  async byId(orgId: string, id: string): Promise<FamilyRow> {
    const family = await productFamilyRepository.byId(orgId, id);
    if (!family) throw new NotFoundError("Family not found");
    return family;
  }

  /**
   * A family made from a category, which is where its type and its axis come from — the same
   * walk the product form does, so a family asks what its members will be asked.
   *
   * The axis is **copied** rather than referenced (variants: `ProductFamily.variantAxis`), so
   * reordering a type's declaration later cannot silently regroup a shop's products.
   */
  async create(
    orgId: string,
    input: { name: string; description?: string | null; categoryId: string },
  ): Promise<FamilyRow> {
    const name = input.name.trim();
    if (!name) throw new DomainError("Give the family a name", { field: "name" });

    const typeKey = resolveProductType(input.categoryId, await categoryRepository.list());
    const type = await productTypeRepository.byKey(typeKey);

    return productFamilyRepository.create({
      orgId,
      name,
      description: input.description ?? null,
      productType: typeKey,
      // No type means no declared axis, which is legitimate: the family still carries a shared
      // description, and its members simply differ in ways nothing has named yet.
      variantAxis: type?.variantAxis ?? [],
    });
  }

  async update(
    orgId: string,
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<FamilyRow> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new DomainError("Give the family a name", { field: "name" });
    }
    const updated = await productFamilyRepository.update(orgId, id, {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.description === undefined ? {} : { description: input.description }),
    });
    if (!updated) throw new NotFoundError("Family not found");
    return updated;
  }

  /**
   * Retiring hides a family from the pickers and changes none of its members
   * ([ADR-0032](../../docs/adr/0032-records-people-authored-are-retired-not-deleted.md)). There
   * is no delete: the foreign key refuses one while anything names it, and the real operation a
   * shop wants is to stop offering it.
   */
  async retire(orgId: string, id: string): Promise<{ retired: boolean; members: number }> {
    await this.byId(orgId, id);
    const members = await productFamilyRepository.memberCount(orgId, id);
    const retired = await productFamilyRepository.retire(orgId, id);
    return { retired, members };
  }

  async restore(orgId: string, id: string): Promise<boolean> {
    await this.byId(orgId, id);
    return productFamilyRepository.restore(orgId, id);
  }

  /** What a screen shows beside a family: the two counts are different numbers (variants D6). */
  async counts(orgId: string): Promise<{ families: number; sellable: number }> {
    return productFamilyRepository.counts(orgId);
  }
}

export const productFamilyService = new ProductFamilyService();

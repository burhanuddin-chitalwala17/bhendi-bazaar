import { brandRepository, type BrandData } from "@server/catalog/brand.repository";
import { toBrandDto, type BrandDto } from "@server/catalog/brand.types";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { isUniqueViolation } from "@server/shared/constraint";

/**
 * The write seam for an org's brands (org-profile trd D7). Every call is scoped by an orgId
 * that came from a verified membership. Nothing here judges completeness: a brand with only a
 * name is a valid brand (spec R5), and a channel's readiness says what is missing, later.
 */
export class BrandService {
  async list(orgId: string): Promise<BrandDto[]> {
    const brands = await brandRepository.listForOrg(orgId);
    return brands.map(toBrandDto);
  }

  async create(orgId: string, data: BrandData): Promise<BrandDto> {
    const brand = await this.settled(data.name, () => brandRepository.create(orgId, data));
    if (data.isDefault) await brandRepository.markDefault(orgId, brand.id);
    return toBrandDto({ ...brand, isDefault: data.isDefault });
  }

  async update(orgId: string, id: string, data: Partial<BrandData>): Promise<BrandDto> {
    const updated = await this.settled(data.name, () => brandRepository.update(orgId, id, data));
    if (!updated) throw new NotFoundError("Brand not found");
    if (data.isDefault) await brandRepository.markDefault(orgId, id);
    return this.read(orgId, id);
  }

  /** Retirement, never deletion (ADR-0032): products that name this brand keep their values. */
  async retire(orgId: string, id: string): Promise<BrandDto> {
    const retired = await brandRepository.retire(orgId, id);
    if (!retired) throw new NotFoundError("Brand not found");
    return this.read(orgId, id);
  }

  private async read(orgId: string, id: string): Promise<BrandDto> {
    const brand = await brandRepository.findById(orgId, id);
    if (!brand) throw new NotFoundError("Brand not found");
    return toBrandDto(brand);
  }

  /** `(orgId, name)` is unique: the database settles a duplicate, and the org hears it as a conflict. */
  private async settled<T>(name: string | undefined, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error, "name")) {
        throw new ConflictError(`You already have a brand called "${name}"`);
      }
      throw error;
    }
  }
}

export const brandService = new BrandService();

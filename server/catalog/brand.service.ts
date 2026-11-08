import { brandRepository, type BrandData, type PartiesData } from "@server/catalog/brand.repository";
import { toBrandDto, type BrandDto } from "@server/catalog/brand.types";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { isUniqueViolation } from "@server/shared/constraint";

/** Marketplaces' word for an unbranded item: it belongs to the shop's default brand (marketplace-facts Q29). */
const GENERIC = /^(generic|unbranded|no brand)$/i;

/** What the brand form sends (dynamic-form R7): the old maker and packer lines now come from the parties. */
export interface BrandFormData {
  name: string;
  countryOfOrigin: string | null;
  isDefault: boolean;
  amazonRegistered: boolean;
  parties: PartiesData;
}

const brandDataOf = (input: BrandFormData): BrandData => ({
  name: input.name,
  countryOfOrigin: input.countryOfOrigin,
  isDefault: input.isDefault,
  manufacturer: input.parties.maker.name,
  packerOrImporter: input.parties.packer.name,
});

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

  /** A brand with its parties and Amazon choice, in one write (listing-model/dynamic-form R7). */
  async create(orgId: string, input: BrandFormData): Promise<BrandDto> {
    const data = brandDataOf(input);
    const brand = await this.settled(data.name, () => brandRepository.create(orgId, data, input.amazonRegistered, input.parties));
    if (data.isDefault) await brandRepository.markDefault(orgId, brand.id);
    return toBrandDto({ ...brand, isDefault: data.isDefault });
  }

  async update(orgId: string, id: string, input: Partial<BrandFormData>): Promise<BrandDto> {
    const { parties, amazonRegistered, ...rest } = input;
    const data: Partial<BrandData> & { amazonRegistered?: boolean } = { ...rest, ...(amazonRegistered === undefined ? {} : { amazonRegistered }) };
    const updated = await this.settled(data.name, () => brandRepository.update(orgId, id, data, parties));
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

  /**
   * A marketplace's label details onto a product's brand (marketplace-facts Q21, Q29): the brand
   * it has, else the shop's brand of that name, else the default brand for a "Generic" listing.
   * No brand is ever made. Returns the brand used, so the product can take it when it had none.
   */
  async fillFromMarketplace(
    orgId: string,
    productBrandId: string | null,
    details: { brand: string | null; manufacturer: string | null; packerOrImporter: string | null; countryOfOrigin: string | null },
  ): Promise<{ brandId: string | null; filled: string[] }> {
    const brandId = productBrandId ?? (await this.brandNamed(orgId, details.brand?.trim() || null));
    if (!brandId) return { brandId: null, filled: [] };
    const filled = await brandRepository.fillEmpty(orgId, brandId, {
      manufacturer: details.manufacturer,
      packerOrImporter: details.packerOrImporter,
      countryOfOrigin: details.countryOfOrigin,
    });
    return { brandId, filled };
  }

  private async brandNamed(orgId: string, name: string | null): Promise<string | null> {
    if (!name) return null;
    const named = await brandRepository.findForMarketplace(orgId, name);
    if (named) return named.id;
    return GENERIC.test(name) ? ((await brandRepository.findForMarketplace(orgId, null))?.id ?? null) : null;
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

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/forms/FormField";
import { ImageUpload } from "@/components/shared/image-upload";
import { shopDetailsApiClient } from "@/components/org/shopDetailsApiClient";
import {
  aboutSectionSchema,
  essentialsSectionSchema,
  personSectionSchema,
  placeSectionSchema,
  promiseSectionSchema,
  socialSectionSchema,
  type AboutSectionInput,
  type EssentialsSectionInput,
  type PersonSectionInput,
  type PlaceSectionInput,
  type PromiseSectionInput,
  type ShopDetailsSectionInput,
  type SocialSectionInput,
} from "@/lib/validation/schemas/shop-details.schema";
import {
  ABOUT_COUNTER_FROM,
  ABOUT_MAX,
  RETURNS_PRESETS,
  RETURNS_PRESET_LABEL,
  SHOP_DETAILS_SECTION,
  type ShopDetailsDto,
} from "@server/catalog/shop-details.types";
import { SOCIAL_NETWORKS, SOCIAL_NETWORK_KEYS } from "@server/catalog/social-networks";
import { SectionForm, SeenBy } from "./section-card";
import { FIELDS, SHOP_DETAILS_COPY, counter } from "./shop-details-copy";
import { useShopDetailsSection, type SectionProblem } from "./useShopDetailsSection";

/** What every section is handed by the page: where it saves, the version, and where to report. */
export interface SectionProps {
  orgId: string;
  details: ShopDetailsDto;
  /** The version the page holds now; read at submit, so a save after another section's is current (Q21). */
  version: () => string;
  onSaved: (details: ShopDetailsDto) => void;
  onLoadLatest: () => void;
  onDraft: (draft: Partial<ShopDetailsDto>) => void;
}

const upload = (orgId: string) => `/api/org/${orgId}/upload`;

/** Every section's save, with the page's current version rather than the one the form opened with. */
function saver<T extends ShopDetailsSectionInput>(props: SectionProps) {
  return (data: T) =>
    shopDetailsApiClient.saveSection(props.orgId, { ...data, expectedUpdatedAt: props.version() });
}

export function EssentialsSection(props: SectionProps) {
  const { details } = props;
  const form = useShopDetailsSection<EssentialsSectionInput>({
    schema: essentialsSectionSchema,
    defaultValues: {
      section: SHOP_DETAILS_SECTION.ESSENTIALS,
      tagline: details.tagline ?? "",
      logoUrl: details.logoUrl ?? "",
      expectedUpdatedAt: details.updatedAt,
    },
    save: saver(props),
    onSaved: props.onSaved,
  });
  const logoUrl = form.watch("logoUrl") ?? "";
  const tagline = form.watch("tagline") ?? "";
  const { onDraft } = props;
  useEffect(() => onDraft({ logoUrl: logoUrl || null, tagline: tagline || null }), [logoUrl, tagline, onDraft]);

  return (
    <SectionForm id="essentials" {...sectionChrome(form, props)}>
      <div className="space-y-1">
        <p className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">{FIELDS.name.label}</p>
        <p className="break-words font-medium">{details.name}</p>
        <p className="text-xs text-muted-foreground"><SeenBy>{FIELDS.name.hint}</SeenBy></p>
      </div>
      <div className="space-y-1">
        <ImageUpload
          label={FIELDS.logo.label}
          value={logoUrl ? [logoUrl] : []}
          onChange={(urls) => form.setValue("logoUrl", urls[0] ?? "", { shouldDirty: true })}
          maxImages={1}
          endpoint={upload(props.orgId)}
        />
        <p className="text-xs text-muted-foreground"><SeenBy>{FIELDS.logo.hint}</SeenBy></p>
        {form.formState.errors.logoUrl?.message && (
          <p role="alert" className="text-xs text-destructive">{form.formState.errors.logoUrl.message}</p>
        )}
      </div>
      <FormInput
        label={FIELDS.tagline.label}
        hint={<SeenBy>{FIELDS.tagline.hint}</SeenBy>}
        placeholder={FIELDS.tagline.placeholder}
        error={form.formState.errors.tagline?.message}
        {...form.register("tagline")}
      />
    </SectionForm>
  );
}

export function AboutSection(props: SectionProps) {
  const { details } = props;
  const form = useShopDetailsSection<AboutSectionInput>({
    schema: aboutSectionSchema,
    defaultValues: {
      section: SHOP_DETAILS_SECTION.ABOUT,
      about: details.about ?? "",
      expectedUpdatedAt: details.updatedAt,
    },
    save: saver(props),
    onSaved: props.onSaved,
  });
  const about = form.watch("about") ?? "";
  const { onDraft } = props;
  useEffect(() => onDraft({ about: about.trim() || null }), [about, onDraft]);

  return (
    <SectionForm id="about" {...sectionChrome(form, props)}>
      {details.aboutJoined && (
        <p className="rounded-card bg-muted px-3 py-2 text-sm">{SHOP_DETAILS_COPY.joinedNote}</p>
      )}
      <FormTextarea
        label={FIELDS.about.label}
        hint={<SeenBy>{FIELDS.about.hint}</SeenBy>}
        placeholder={FIELDS.about.placeholder}
        rows={6}
        error={form.formState.errors.about?.message}
        {...form.register("about")}
      />
      {about.length >= ABOUT_COUNTER_FROM && (
        <p aria-live="polite" className={about.length > ABOUT_MAX ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {counter(about.length, ABOUT_MAX)}
        </p>
      )}
    </SectionForm>
  );
}

export function PlaceSection(props: SectionProps) {
  const { details } = props;
  const form = useShopDetailsSection<PlaceSectionInput>({
    schema: placeSectionSchema,
    defaultValues: {
      section: SHOP_DETAILS_SECTION.PLACE,
      location: details.location ?? "",
      expectedUpdatedAt: details.updatedAt,
    },
    save: saver(props),
    onSaved: props.onSaved,
  });
  const location = form.watch("location") ?? "";
  const { onDraft } = props;
  useEffect(() => onDraft({ location: location.trim() || null }), [location, onDraft]);

  return (
    <SectionForm id="place" {...sectionChrome(form, props)}>
      <FormInput
        label={FIELDS.location.label}
        hint={<SeenBy>{FIELDS.location.hint}</SeenBy>}
        placeholder={FIELDS.location.placeholder}
        error={form.formState.errors.location?.message}
        {...form.register("location")}
      />
    </SectionForm>
  );
}

export function PersonSection(props: SectionProps) {
  const { details } = props;
  const form = useShopDetailsSection<PersonSectionInput>({
    schema: personSectionSchema,
    defaultValues: {
      section: SHOP_DETAILS_SECTION.PERSON,
      ownerName: details.ownerName ?? "",
      ownerRole: details.ownerRole ?? "",
      ownerQuote: details.ownerQuote ?? "",
      ownerPhotoUrl: details.ownerPhotoUrl ?? "",
      expectedUpdatedAt: details.updatedAt,
    },
    save: saver(props),
    onSaved: props.onSaved,
  });
  const [ownerName, ownerRole, ownerQuote, ownerPhotoUrl] = form.watch(["ownerName", "ownerRole", "ownerQuote", "ownerPhotoUrl"]);
  const { onDraft } = props;
  useEffect(
    () =>
      onDraft({
        ownerName: ownerName?.trim() || null,
        ownerRole: ownerRole?.trim() || null,
        ownerQuote: ownerQuote?.trim() || null,
        ownerPhotoUrl: ownerPhotoUrl || null,
      }),
    [ownerName, ownerRole, ownerQuote, ownerPhotoUrl, onDraft],
  );
  const errors = form.formState.errors;

  return (
    <SectionForm id="person" {...sectionChrome(form, props)}>
      <FormInput label={FIELDS.ownerName.label} hint={<SeenBy>{FIELDS.ownerName.hint}</SeenBy>} placeholder={FIELDS.ownerName.placeholder} error={errors.ownerName?.message} {...form.register("ownerName")} />
      <FormInput label={FIELDS.ownerRole.label} hint={<SeenBy>{FIELDS.ownerRole.hint}</SeenBy>} placeholder={FIELDS.ownerRole.placeholder} error={errors.ownerRole?.message} {...form.register("ownerRole")} />
      <FormTextarea label={FIELDS.ownerQuote.label} hint={<SeenBy>{FIELDS.ownerQuote.hint}</SeenBy>} placeholder={FIELDS.ownerQuote.placeholder} rows={3} error={errors.ownerQuote?.message} {...form.register("ownerQuote")} />
      <div className="space-y-1">
        <ImageUpload
          label={FIELDS.ownerPhoto.label}
          value={ownerPhotoUrl ? [ownerPhotoUrl] : []}
          onChange={(urls) => form.setValue("ownerPhotoUrl", urls[0] ?? "", { shouldDirty: true })}
          maxImages={1}
          endpoint={upload(props.orgId)}
        />
        <p className="text-xs text-muted-foreground"><SeenBy>{FIELDS.ownerPhoto.hint}</SeenBy></p>
        {errors.ownerPhotoUrl?.message && <p role="alert" className="text-xs text-destructive">{errors.ownerPhotoUrl.message}</p>}
      </div>
    </SectionForm>
  );
}

export function SocialSection(props: SectionProps) {
  const { details } = props;
  const form = useShopDetailsSection<SocialSectionInput>({
    schema: socialSectionSchema,
    defaultValues: {
      section: SHOP_DETAILS_SECTION.SOCIAL,
      social: Object.fromEntries(SOCIAL_NETWORK_KEYS.map((network) => [network, details.social[network] ?? ""])),
      expectedUpdatedAt: details.updatedAt,
    },
    save: saver(props),
    onSaved: props.onSaved,
  });

  return (
    <SectionForm id="social" {...sectionChrome(form, props)}>
      {SOCIAL_NETWORK_KEYS.map((network) => (
        <FormInput
          key={network}
          label={SOCIAL_NETWORKS[network].label}
          hint={<SeenBy>{FIELDS.social.hint}</SeenBy>}
          placeholder={FIELDS.social.placeholder}
          error={form.formState.errors.social?.[network]?.message}
          {...form.register(`social.${network}` as const)}
        />
      ))}
    </SectionForm>
  );
}

export function PromiseSection(props: SectionProps) {
  const { details } = props;
  const form = useShopDetailsSection<PromiseSectionInput>({
    schema: promiseSectionSchema,
    defaultValues: {
      section: SHOP_DETAILS_SECTION.PROMISE,
      returnsPreset: details.returnsPreset,
      promiseNote: details.promiseNote ?? "",
      expectedUpdatedAt: details.updatedAt,
    },
    save: saver(props),
    onSaved: props.onSaved,
  });
  const errors = form.formState.errors;
  const oldText = [details.oldDeliveryPolicy, details.oldReturnsPolicy].filter(Boolean).join("\n\n");

  return (
    <SectionForm id="promise" {...sectionChrome(form, props)}>
      <FormSelect
        label={FIELDS.returnsPreset.label}
        hint={<SeenBy>{FIELDS.returnsPreset.hint}</SeenBy>}
        error={errors.returnsPreset?.message}
        {...form.register("returnsPreset")}
      >
        {RETURNS_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {RETURNS_PRESET_LABEL[preset]}
          </option>
        ))}
      </FormSelect>
      <FormTextarea
        label={FIELDS.promiseNote.label}
        hint={<SeenBy>{FIELDS.promiseNote.hint}</SeenBy>}
        placeholder={FIELDS.promiseNote.placeholder}
        rows={3}
        error={errors.promiseNote?.message}
        {...form.register("promiseNote")}
      />
      {oldText && (
        <div className="space-y-2 rounded-card border border-border/60 bg-muted/40 p-3">
          <p className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">{FIELDS.oldText}</p>
          <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{oldText}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue("promiseNote", oldText, { shouldDirty: true, shouldValidate: true })}
          >
            {SHOP_DETAILS_COPY.copyIntoNote}
          </Button>
        </div>
      )}
    </SectionForm>
  );
}

/** The chrome every section passes to `SectionForm`. */
function sectionChrome(
  form: {
    submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
    slow: boolean;
    problem: SectionProblem;
    formError: string | null;
  },
  props: SectionProps,
) {
  return {
    onSubmit: form.submit,
    isSubmitting: form.isSubmitting,
    slow: form.slow,
    problem: form.problem,
    formError: form.formError,
    onLoadLatest: props.onLoadLatest,
  };
}

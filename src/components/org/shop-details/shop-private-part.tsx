"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormInput, FormPhoneInput } from "@/components/shared/forms/FormField";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { HandleChangeDialog } from "@/components/org/handle-change-dialog";
import { shopDetailsApiClient } from "@/components/org/shopDetailsApiClient";
import { shopContactSchema, type ShopContactInput } from "@/lib/validation/schemas/shop-details.schema";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { SectionForm, SeenBy } from "./section-card";
import { FIELDS, NAME_SHEET_COPY, SHOP_DETAILS_COPY } from "./shop-details-copy";
import { useShopDetailsSection } from "./useShopDetailsSection";
import { useShopNameChange } from "./useShopNameChange";
import { useSaveAll } from "./useSaveBar";
import { ROUTES } from "@server/shared/routes";

/** What the owner-only rows are handed: the org's version, read at submit (Q21), and where to report. */
export interface ContactProps {
  orgId: string;
  details: ShopDetailsDto;
  contactVersion: () => string;
  onSaved: (details: ShopDetailsDto) => void;
  onLoadLatest: () => void;
}

const store = (handle: string) => ROUTES.store(handle);

/** Shop name, with the confirming sheet (org-profile D7, Q15; ux Name change sheet). */
export function ShopNameRow(props: ContactProps) {
  const { details } = props;
  const saveAll = useSaveAll();
  const { form, pending, changing, slow, problem, confirm, keep } = useShopNameChange({
    current: details.name,
    save: (name) =>
      shopDetailsApiClient.saveContact(props.orgId, { name, expectedUpdatedAt: props.contactVersion() }),
    onSaved: props.onSaved,
  });

  return (
    <>
      <form id="shop-name" onSubmit={saveAll} noValidate className="space-y-3">
        <FormInput
          label={FIELDS.name.label}
          hint={<SeenBy>{FIELDS.name.hint}</SeenBy>}
          placeholder={FIELDS.name.placeholder}
          autoComplete="organization"
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />
        {form.formError && <p role="alert" className="text-xs text-destructive">{form.formError}</p>}
      </form>

      <FormDialog open={pending !== null} onOpenChange={(open) => !open && keep()} title={NAME_SHEET_COPY.title}>
        <div className="space-y-4">
          <p className="break-words text-sm">{NAME_SHEET_COPY.confirm(pending ?? "", store(details.handle))}</p>
          {problem?.kind === "retry" && (
            <p role="alert" className="text-sm text-destructive">{NAME_SHEET_COPY.retry}</p>
          )}
          {(problem?.kind === "refused" || problem?.kind === "stale") && (
            <p role="alert" className="text-sm text-destructive">{problem.message}</p>
          )}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            {problem?.kind === "stale" ? (
              // The sheet's question is answered by the same reload the section banners use (Q21).
              <Button type="button" className="h-11" onClick={props.onLoadLatest}>
                {SHOP_DETAILS_COPY.loadLatest}
              </Button>
            ) : problem?.kind === "refused" ? (
              <Button type="button" variant="outline" className="h-11" onClick={keep}>
                {NAME_SHEET_COPY.close}
              </Button>
            ) : (
              <Button type="button" className="h-11" aria-busy={changing} onClick={confirm}>
                {changing
                  ? slow
                    ? NAME_SHEET_COPY.stillChanging
                    : NAME_SHEET_COPY.changing
                  : problem?.kind === "retry"
                    ? NAME_SHEET_COPY.tryAgain
                    : NAME_SHEET_COPY.change}
              </Button>
            )}
            {problem?.kind !== "refused" && problem?.kind !== "stale" && (
              <Button type="button" variant="outline" className="h-11" onClick={keep}>
                {NAME_SHEET_COPY.keep}
              </Button>
            )}
          </div>
        </div>
      </FormDialog>
    </>
  );
}

/** Your shop link: the existing owner-only handle change (D7, R5). */
export function ShopLinkRow({
  orgId,
  handle,
  oldAddressWorksUntil,
}: {
  orgId: string;
  handle: string;
  oldAddressWorksUntil: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">{FIELDS.link.label}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-all font-medium">{store(handle)}</p>
        <HandleChangeDialog orgId={orgId} currentHandle={handle} oldAddressWorksUntil={oldAddressWorksUntil} />
      </div>
      <p className="text-xs text-muted-foreground"><SeenBy>{FIELDS.link.hint}</SeenBy></p>
    </div>
  );
}

function sectionChrome(
  form: ReturnType<typeof useShopDetailsSection<ShopContactInput>>,
  onLoadLatest: () => void,
) {
  return { problem: form.problem, formError: form.formError, onLoadLatest };
}

function PhoneRow(props: ContactProps) {
  const form = useShopDetailsSection<ShopContactInput>({
    id: "contact-phone",
    schema: shopContactSchema,
    defaultValues: { phone: props.details.phone ?? "", expectedUpdatedAt: props.details.contactUpdatedAt },
    save: ({ phone }) =>
      shopDetailsApiClient.saveContact(props.orgId, { phone, expectedUpdatedAt: props.contactVersion() }),
    onSaved: props.onSaved,
    successMessage: SHOP_DETAILS_COPY.phoneSaved,
  });
  return (
    <SectionForm id="contact-phone" {...sectionChrome(form, props.onLoadLatest)}>
      <FormPhoneInput
        name="phone"
        control={form.control}
        label={FIELDS.phone.label}
        hint={<SeenBy>{FIELDS.phone.hint}</SeenBy>}
        placeholder={FIELDS.phone.placeholder}
      />
    </SectionForm>
  );
}

function EmailRow(props: ContactProps) {
  const form = useShopDetailsSection<ShopContactInput>({
    id: "contact-email",
    schema: shopContactSchema,
    defaultValues: { email: props.details.email, expectedUpdatedAt: props.details.contactUpdatedAt },
    save: ({ email }) =>
      shopDetailsApiClient.saveContact(props.orgId, { email, expectedUpdatedAt: props.contactVersion() }),
    onSaved: props.onSaved,
    successMessage: SHOP_DETAILS_COPY.emailSaved,
  });
  return (
    <SectionForm id="contact-email" {...sectionChrome(form, props.onLoadLatest)}>
      <FormInput
        label={FIELDS.email.label}
        hint={<SeenBy>{FIELDS.email.hint}</SeenBy>}
        placeholder={FIELDS.email.placeholder}
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
    </SectionForm>
  );
}

/**
 * "Only Bhendi Bazaar sees this" (org-profile U3; D7; R5, R6): mobile and email, saved by the page's one bar (Q30),
 * and the tax card saying it waits for the first payout.
 */
export function ShopPrivatePart(props: ContactProps) {
  return (
    <section id="private-part" className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">{SHOP_DETAILS_COPY.privatePart}</h2>
      <Card>
        <CardContent className="space-y-6 pt-6">
          <PhoneRow {...props} />
          <EmailRow {...props} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{SHOP_DETAILS_COPY.taxTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{SHOP_DETAILS_COPY.taxBody}</p>
        </CardContent>
      </Card>
    </section>
  );
}

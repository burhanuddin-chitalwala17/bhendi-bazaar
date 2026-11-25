import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { APP_NAME, APP_SUPPORT_EMAIL, LEGAL, SUPPORT_WHATSAPP } from "@/lib/config";
import { whatsappSupportUrl } from "@/lib/support-contact";
import { STORE_POLICIES_COPY } from "./support-copy";

/**
 * The store's policies as one page of anchored sections (`planning-archive-2026-11-25:docs/specs/store-policies/`). Every claim
 * here describes what the store does today; where there is no feature, it says how a person does it.
 */

const SECTIONS = [
  { id: "about", title: STORE_POLICIES_COPY.whoWe },
  { id: "orders", title: STORE_POLICIES_COPY.ordersPayment },
  { id: "shipping", title: STORE_POLICIES_COPY.shipping },
  { id: "cancellation", title: STORE_POLICIES_COPY.cancellation },
  { id: "returns", title: STORE_POLICIES_COPY.returns },
  { id: "refunds", title: STORE_POLICIES_COPY.refunds },
  { id: "reviews", title: STORE_POLICIES_COPY.reviews },
  { id: "bidding", title: STORE_POLICIES_COPY.bidding },
  { id: "privacy", title: STORE_POLICIES_COPY.privacy },
  { id: "terms", title: STORE_POLICIES_COPY.termsUse },
  { id: "grievance", title: STORE_POLICIES_COPY.grievances },
  { id: "contact", title: STORE_POLICIES_COPY.contactUs },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const LINK = "text-primary underline-offset-4 hover:underline";

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    // The sticky header is 56px on a phone and 80px from `sm:`; the offset keeps a jump from hiding the heading.
    <section id={id} className="scroll-mt-20 space-y-3 sm:scroll-mt-24">
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function ReachUs() {
  return (
    <>
      WhatsApp us on{" "}
      <a href={whatsappSupportUrl()} target="_blank" rel="noopener noreferrer" className={LINK}>
        {SUPPORT_WHATSAPP.display}
      </a>{" "}
      or email{" "}
      <a href={`mailto:${APP_SUPPORT_EMAIL}`} className={LINK}>
        {APP_SUPPORT_EMAIL}
      </a>
    </>
  );
}

export function StorePolicies({
  holdMinutes,
  updatedOn,
}: {
  /** How long an unpaid checkout holds its goods (checkout-abandonment). */
  holdMinutes: number;
  updatedOn: string;
}) {
  return (
    <div className="space-y-10">
      <nav aria-label={STORE_POLICIES_COPY.policySections} className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button key={s.id} asChild variant="outline" size="sm" className="h-10">
            <Link href={`#${s.id}`}>{s.title}</Link>
          </Button>
        ))}
      </nav>

      <p className="text-xs text-muted-foreground">Last updated {updatedOn}.</p>

      <Section id="about">
        <p>
          {APP_NAME} is an online marketplace. Products are listed and sold by independent shops;
          each product page names its shop under &ldquo;Sold by&rdquo;. The marketplace is operated
          by {LEGAL.entityName}, {LEGAL.address}.
        </p>
        <p>{STORE_POLICIES_COPY.weTakeYourPayment}</p>
      </Section>

      <Section id="orders">
        <Bullets
          items={[
            STORE_POLICIES_COPY.pricesIndianRupeesInr,
            STORE_POLICIES_COPY.weTakePaymentOnline,
            `Your order is placed once payment succeeds. If you leave checkout without paying, the items are held for you for ${holdMinutes} minutes and then released, and the unpaid order is closed.`,
            STORE_POLICIES_COPY.ifPaymentFailsCan,
            STORE_POLICIES_COPY.orderItemsFromSeveral,
          ]}
        />
      </Section>

      <Section id="shipping">
        <Bullets
          items={[
            STORE_POLICIES_COPY.weShipWithinIndia,
            STORE_POLICIES_COPY.ordersDeliveredCourierPartners,
            STORE_POLICIES_COPY.shippingChargedPerParcel,
            STORE_POLICIES_COPY.deliveryEstimatesComeFrom,
            STORE_POLICIES_COPY.onceParcelShipsCan,
            STORE_POLICIES_COPY.ifParcelLostDamaged,
          ]}
        />
      </Section>

      <Section id="cancellation">
        <p>{STORE_POLICIES_COPY.canCancelOrderUntil}<ReachUs />{STORE_POLICIES_COPY.orderCodeWeWill}</p>
        <p>{STORE_POLICIES_COPY.onceOrderHasShipped}<Link href="#returns" className={LINK}>{STORE_POLICIES_COPY.returnsPolicy}</Link>.
        </p>
        <p>{STORE_POLICIES_COPY.weMayCancelOrder}</p>
      </Section>

      <Section id="returns">
        <p>{STORE_POLICIES_COPY.canReturnItemWithin}<strong className="text-foreground">7 days of delivery</strong>.
        </p>
        <Bullets
          items={[
            <>
              {STORE_POLICIES_COPY.startReturn}<ReachUs />{STORE_POLICIES_COPY.orderCodeItemReason}</>,
            STORE_POLICIES_COPY.itemMustUnusedUnwashed,
            STORE_POLICIES_COPY.changeMindPayReturn,
            STORE_POLICIES_COPY.ifItemArrivesDamaged,
            STORE_POLICIES_COPY.hygieneReasonsWeCannot,
            STORE_POLICIES_COPY.itemsMadeAlteredOrder,
          ]}
        />
      </Section>

      <Section id="refunds">
        <Bullets
          items={[
            STORE_POLICIES_COPY.weStartRefundWithin,
            STORE_POLICIES_COPY.refundsGoBackOriginal,
            STORE_POLICIES_COPY.shippingRefundedWhenWe,
            <>
              {STORE_POLICIES_COPY.ifRefundHasNot}<ReachUs />.
            </>,
          ]}
        />
      </Section>

      <Section id="reviews">
        <Bullets
          items={[
            STORE_POLICIES_COPY.anySignedShopperCan,
            STORE_POLICIES_COPY.canEditDeleteOwn,
            STORE_POLICIES_COPY.weMayRemoveReview,
          ]}
        />
      </Section>

      <Section id="bidding">
        <Bullets
          items={[
            STORE_POLICIES_COPY.whileItemUpBidding,
            STORE_POLICIES_COPY.eventSTermsCannot,
            STORE_POLICIES_COPY.eventEndsTimeShown,
            STORE_POLICIES_COPY.whenEventEndsWe,
            STORE_POLICIES_COPY.bidOfferBuyPrice,
          ]}
        />
      </Section>

      <Section id="privacy">
        <p>{STORE_POLICIES_COPY.weCollectOnlyWhat}</p>
        <Bullets
          items={[
            STORE_POLICIES_COPY.accountNameEmailAddress,
            STORE_POLICIES_COPY.deliveryAddressesRecipientS,
            STORE_POLICIES_COPY.ordersReviewsWishlist,
            STORE_POLICIES_COPY.ifBidWithoutAccount,
          ]}
        />
        <p>{STORE_POLICIES_COPY.weShareDataOnly}</p>
        <Bullets
          items={[
            STORE_POLICIES_COPY.razorpayTakePaymentsWe,
            STORE_POLICIES_COPY.shiprocketCourierPartnersDeliver,
            STORE_POLICIES_COPY.resendSendOrderAccount,
            STORE_POLICIES_COPY.googleIfChooseSign,
            STORE_POLICIES_COPY.vercelHostingAnonymousVisit,
            STORE_POLICIES_COPY.shopSellingItemBuy,
          ]}
        />
        <p>{STORE_POLICIES_COPY.weDoNotSell}</p>
        <p>{STORE_POLICIES_COPY.seeCorrectCloseAccount}<ReachUs />. A closed account is deactivated rather
          than erased, because order and payment records must be kept for accounting and tax law.
        </p>
      </Section>

      <Section id="terms">
        <Bullets
          items={[
            STORE_POLICIES_COPY.usingSitePlacingOrder,
            STORE_POLICIES_COPY.keepAccountDetailsAccurate,
            STORE_POLICIES_COPY.weTryDescribeEvery,
            STORE_POLICIES_COPY.productPhotosTextSite,
            STORE_POLICIES_COPY.weMayUpdateThese,
            `These terms are governed by the laws of India, and the courts of ${LEGAL.jurisdiction} have jurisdiction.`,
          ]}
        />
      </Section>

      <Section id="grievance">
        <p>{STORE_POLICIES_COPY.ifWeHaveNot}</p>
        <address className="not-italic text-foreground">
          {LEGAL.grievanceOfficer.name}, {LEGAL.grievanceOfficer.designation}
          <br />
          {LEGAL.entityName}
          <br />
          {LEGAL.address}
          <br />
          Email: {LEGAL.grievanceOfficer.email}
        </address>
        <p>{STORE_POLICIES_COPY.weAcknowledgeEveryComplaint}</p>
      </Section>

      <Section id="contact">
        <p>{STORE_POLICIES_COPY.anythingAboutOrderReturn}<ReachUs />. WhatsApp is the fastest way
          to reach us.
        </p>
      </Section>
    </div>
  );
}

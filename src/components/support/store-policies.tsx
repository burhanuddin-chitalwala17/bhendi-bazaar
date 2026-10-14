import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { APP_NAME, APP_SUPPORT_EMAIL, LEGAL, SUPPORT_WHATSAPP } from "@/lib/config";
import { whatsappSupportUrl } from "@/lib/support-contact";

/**
 * The store's policies as one page of anchored sections (docs/specs/store-policies/). Every claim
 * here describes what the store does today; where there is no feature, it says how a person does it.
 */

const SECTIONS = [
  { id: "about", title: "Who we are" },
  { id: "orders", title: "Orders and payment" },
  { id: "shipping", title: "Shipping" },
  { id: "cancellation", title: "Cancellation" },
  { id: "returns", title: "Returns" },
  { id: "refunds", title: "Refunds" },
  { id: "reviews", title: "Reviews" },
  { id: "bidding", title: "Bidding" },
  { id: "privacy", title: "Privacy" },
  { id: "terms", title: "Terms of use" },
  { id: "grievance", title: "Grievances" },
  { id: "contact", title: "Contact us" },
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
      <nav aria-label="Policy sections" className="flex flex-wrap gap-2">
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
        <p>
          We take your payment, arrange delivery and handle every cancellation, return and refund
          request, whichever shop the item came from. Write to us, not to the shop.
        </p>
      </Section>

      <Section id="orders">
        <Bullets
          items={[
            "Prices are in Indian rupees (INR). The shipping charge is shown separately at checkout, before you pay.",
            "We take payment online through Razorpay: UPI, cards, net banking and wallets, as Razorpay offers them. Cash on delivery is not available.",
            `Your order is placed once payment succeeds. If you leave checkout without paying, the items are held for you for ${holdMinutes} minutes and then released, and the unpaid order is closed.`,
            "If a payment fails, you can try again from the order. If money left your account but the order shows as failed, contact us and we will confirm or refund it.",
            "An order with items from several shops, or from several warehouses, may arrive in more than one parcel.",
          ]}
        />
      </Section>

      <Section id="shipping">
        <Bullets
          items={[
            "We ship within India only, to addresses with a valid 6-digit pincode. Checkout tells you if a courier cannot reach your pincode.",
            "Orders are delivered by courier partners through Shiprocket.",
            "Shipping is charged per parcel, based on its weight and the delivery option you choose at checkout. You see the charge and the courier's estimated delivery time before you pay.",
            "Delivery estimates come from the courier and are not guaranteed. Delays caused by the courier, weather or local restrictions can happen.",
            "Once a parcel ships, you can follow it from your order page.",
            "If a parcel is lost or damaged in transit, or comes back to us undelivered, we refund you for the affected items.",
          ]}
        />
      </Section>

      <Section id="cancellation">
        <p>
          You can cancel an order until it ships. <ReachUs /> with your order code, and we will cancel
          it and refund the full amount you paid, shipping included.
        </p>
        <p>
          Once an order has shipped it can no longer be cancelled. You can return it after delivery
          under our <Link href="#returns" className={LINK}>returns policy</Link>.
        </p>
        <p>
          We may cancel an order ourselves if an item turns out to be out of stock or was listed at a
          clearly wrong price. If we do, we refund you in full.
        </p>
      </Section>

      <Section id="returns">
        <p>
          You can return an item within <strong className="text-foreground">7 days of delivery</strong>.
        </p>
        <Bullets
          items={[
            <>
              To start a return, <ReachUs /> with your order code, the item and the reason. We will
              tell you where to send it, or arrange a pickup where the courier offers one.
            </>,
            "The item must be unused, unwashed and undamaged, with its tags and original packaging.",
            "For a change of mind, you pay the return shipping.",
            "If an item arrives damaged, defective or not as described, or you received the wrong item, tell us within 48 hours of delivery and send photos. We cover the return shipping and refund you in full, or replace the item if you prefer and it is in stock.",
            "For hygiene reasons we cannot accept returns of opened fragrances (attar, bakhoor, incense), socks or innerwear, unless the item arrived damaged or wrong.",
            "Items made or altered to your order cannot be returned unless they arrive damaged or wrong.",
          ]}
        />
      </Section>

      <Section id="refunds">
        <Bullets
          items={[
            "We start a refund within 2 business days of approving it: when we cancel your order, or when your returned item reaches us and passes inspection.",
            "Refunds go back to the original payment method through Razorpay. Your bank usually credits it within 5 to 7 business days, so you should see the money within 7 business days of approval.",
            "Shipping is refunded when we cancel before dispatch, or when the return is our fault (damaged, defective, wrong or not as described). It is not refunded on a change-of-mind return.",
            <>
              If a refund has not arrived after 7 business days, <ReachUs />.
            </>,
          ]}
        />
      </Section>

      <Section id="reviews">
        <Bullets
          items={[
            "Any signed-in shopper can review a product. Reviews from people who bought the item through us carry a “Verified purchase” badge.",
            "You can edit or delete your own review.",
            "We may remove a review that is abusive, off-topic, spam, or shares someone's personal details.",
          ]}
        />
      </Section>

      <Section id="bidding">
        <Bullets
          items={[
            "While an item is up for bidding, it cannot be bought through the cart.",
            "An event's terms cannot change once the first bid is placed. Each bid has a limit on how far it can raise the price.",
            "The event ends at the time shown, by our clock.",
            "When the event ends, we contact the highest bidder to complete the sale and arrange payment and delivery.",
            "A bid is an offer to buy at that price; please bid only if you mean to buy.",
          ]}
        />
      </Section>

      <Section id="privacy">
        <p>We collect only what it takes to sell to you and deliver your order:</p>
        <Bullets
          items={[
            "Your account: name, email address, password (stored only as a one-way hash), and your profile picture if you sign in with Google.",
            "Your delivery addresses and the recipient's name, phone number and email.",
            "Your orders, reviews and wishlist.",
            "If you bid without an account, your name and phone number, and email if you give it.",
          ]}
        />
        <p>We share data only with the services that run the store, and only what each one needs:</p>
        <Bullets
          items={[
            "Razorpay, to take payments. We never see or store your card details.",
            "Shiprocket and its courier partners, to deliver your order: your name, address and phone number.",
            "Resend, to send order and account emails.",
            "Google, if you choose to sign in with Google.",
            "Vercel (hosting and anonymous visit statistics), Cloudflare (image storage) and Upstash (protecting the site from abuse).",
            "The shop selling an item you buy, to pack and send it.",
          ]}
        />
        <p>
          We do not sell your personal data. We set no advertising cookies; the only cookie keeps you
          signed in. Checkout remembers what you typed in your browser&apos;s own storage so a refresh does
          not lose it.
        </p>
        <p>
          To see, correct or close your account, <ReachUs />. A closed account is deactivated rather
          than erased, because order and payment records must be kept for accounting and tax law.
        </p>
      </Section>

      <Section id="terms">
        <Bullets
          items={[
            "By using this site or placing an order, you accept these policies.",
            "Keep your account details accurate and your password private. You are responsible for orders placed from your account.",
            "We try to describe every product accurately. Colours can look slightly different on different screens.",
            "Product photos, text and the site's design belong to us or the shops that list them. Do not copy them without permission.",
            "We may update these policies. The version on this page when you place an order applies to that order.",
            `These terms are governed by the laws of India, and the courts of ${LEGAL.jurisdiction} have jurisdiction.`,
          ]}
        />
      </Section>

      <Section id="grievance">
        <p>
          If we have not resolved a complaint, write to our Grievance Officer, as provided by the
          Consumer Protection (E-Commerce) Rules, 2020:
        </p>
        <address className="not-italic text-foreground">
          {LEGAL.grievanceOfficer.name}, {LEGAL.grievanceOfficer.designation}
          <br />
          {LEGAL.entityName}
          <br />
          {LEGAL.address}
          <br />
          Email: {LEGAL.grievanceOfficer.email}
        </address>
        <p>
          We acknowledge every complaint within 48 hours and resolve it within one month of receiving it.
        </p>
      </Section>

      <Section id="contact">
        <p>
          For anything about an order, a return or this page, <ReachUs />. WhatsApp is the fastest way
          to reach us.
        </p>
      </Section>
    </div>
  );
}

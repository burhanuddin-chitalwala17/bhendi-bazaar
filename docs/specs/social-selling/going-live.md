# Going live — social-selling on Meta

- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [INTEGRATIONS.md](../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> How Bhendi Bazaar gets Meta's permission to act for other shops, what can be proven before that,
> and the switch-on checklist. One document covers before and after approval; nothing else is needed
> to start building, because every subfeature is built and tested on our own accounts first (Q2).

## Is it possible?
Yes. Meta lets a business act for other businesses' Instagram and WhatsApp once it passes two
checks: **Business Verification** (who we are) and **App Review** (what each permission is for).
Access Verification, a third step, was retired by Meta on 9 October 2026. A sole proprietorship
registered for GST qualifies (Q14); an unregistered individual would not.

The conditions:
- The legal name on the GST appears on the website in the footer, privacy policy and terms as
  "Farida Abbas Chitalwala, proprietor of BHENDI-BAZAAR.COM" (Q14). Names must match exactly.
- The data-deletion page promises deletion within 30 days of a request (Q34).
- The website is live on HTTPS on our own domain, with an email address on that domain.
- Each shop pays Meta for its own WhatsApp messages from its own account (Q8); we hold no credit line.
- New WhatsApp shops are limited to 10 a rolling week until review passes, then 200 (Q2).

## The owner's steps, in order
| # | Step | Where | Takes | Done when |
|---|---|---|---|---|
| 1 | Gather GST certificate (and Udyam if it carries the trade name), plus a business bank statement or utility bill in the same name | — | a day | Names identical across all |
| 2 | Publish the policy additions (policy-drafts.md, once approved) and the "operated by" line | Our site | build | Pages live at stable URLs |
| 3 | Create a Meta business portfolio in the legal name; add the website | business.facebook.com | minutes | Portfolio exists |
| 4 | Verify the domain (DNS TXT on Cloudflare, or a meta tag) | Business settings → Brand safety → Domains | minutes | Domain shows Verified |
| 5 | Start Business Verification with the documents | Security centre | up to 14 business days | "Verified" badge |
| 6 | Create one **Business**-type app; add WhatsApp and Instagram (API with Instagram login) | developers.facebook.com | minutes | App id and secret exist |
| 7 | Basic settings: 1024×1024 icon, category, contact email, privacy URL, terms URL, data-deletion URL | App dashboard → Settings → Basic | minutes | All fields saved |
| 8 | Instagram login settings: OAuth redirect, deauthorize callback and data-deletion callback URLs (given by the TRD) | Instagram → API setup | minutes | URLs saved |
| 9 | Give our own Instagram professional account (public) and our own WhatsApp number a role on the app | App roles | minutes | Both listed |
| 10 | WhatsApp → choose **Onboard without a partner** to become a Tech Provider | WhatsApp use case | minutes | Tech Provider status |
| 11 | Hand app id, secret and webhook verify token to Claude for dev env | — | — | Dev connects our own accounts |

Steps 1–10 can start today; none waits for code except step 8's URLs, which exist after
connect-instagram's first unit.

## What we ask for, exactly
Ask only for what the app uses; an unused permission is a common rejection.

| Permission | Used by | Subfeature |
|---|---|---|
| `instagram_business_basic` | Account name and type; renewing the token | connect-instagram |
| `instagram_business_content_publish` | Posts, carousels, reels, stories | instagram-publishing |
| `instagram_business_manage_comments` | Reading comments, private replies, hiding (Q36) | inbox-instagram, comment-automations |
| `instagram_business_manage_messages` | DMs in the inbox | inbox-instagram |
| Human Agent (feature) | Replying to a DM up to 7 days later (Q36) | inbox-instagram |
| `whatsapp_business_management` | Number, templates, webhooks subscription | connect-whatsapp, whatsapp-templates |
| `whatsapp_business_messaging` | Sending and receiving messages | inbox-whatsapp, whatsapp-campaigns |
| `catalog_management` | Creating and syncing the shop's catalogue | whatsapp-catalogue |
| `business_management` | Only if the TRD for connect-whatsapp proves Embedded Signup needs it; otherwise not asked | connect-whatsapp |

Each permission must have at least one successful call on record in the 30 days before submitting.

## The review kit
Every screencast: 1080p or better, English interface, no sound, captions where a step is not
obvious, showing a person granting the permission and then the feature using it. Reviewers get a
test shop login (never a personal account) and these steps on a page of their own.

| Permission | Screencast shows | Reviewer steps |
|---|---|---|
| `instagram_business_basic` | Channels → Connect Instagram → Instagram's consent → back, card shows username | Sign in as the test shop, open Channels, tap Connect Instagram, use the test Instagram login |
| `instagram_business_content_publish` | Schedule a story and a feed post now → both appear on the Instagram account | Posts → New post → choose a photo → Instagram story → Publish now; open the account |
| `instagram_business_manage_comments` | Comment SHOP on a post → DM arrives with the link; Hide a comment in the inbox | Comment SHOP on the test account's latest post from any account; open Inbox → Instagram |
| `instagram_business_manage_messages` | DM the account → appears in Inbox → reply from Bhendi Bazaar → arrives in Instagram | Send a DM to the test account; open Inbox, reply |
| Human Agent | A DM older than 24 hours answered from the inbox, marked as a person's reply | Use the seeded 2-day-old conversation in Inbox; reply |
| `whatsapp_business_management` | Connect WhatsApp pop-up → number connected; create a template → shows Meta's status | Channels → Connect WhatsApp (sandbox account); Templates → New |
| `whatsapp_business_messaging` | A campaign sent from Bhendi Bazaar arriving on a phone in WhatsApp | Campaigns → choose the test list → Send; the message shows on the reviewer number listed |
| `catalog_management` | Products appear in the WhatsApp catalogue at the store's price; a price change follows | Open the test number's catalogue in WhatsApp; change a price in Products; reopen |

## What is proven before approval, and what only after
App roles grant every permission on our own accounts without review, so each subfeature is built
and accepted on those (Q2). Some things cannot be seen until approval:

| Cannot be proven before approval | How it is covered meanwhile | Checked after approval by |
|---|---|---|
| A shop with no role on our app connecting Instagram or WhatsApp | Our own accounts, then the Embedded Signup sandbox | Connecting a second shop's real account |
| Instagram comment and DM webhooks (Meta says Instagram login needs Advanced Access for them; tested on day one) | Recorded webhook payloads replayed in tests | A live comment and DM reaching the inbox |
| Some WhatsApp webhooks Meta withholds in development | Recorded payloads | Each listed field arriving live |
| The human-agent reply after 24 hours | A unit test of the window rule | One 2-day-old DM answered |
| Real per-message billing on a shop's account | Cost estimate tests against Meta's published rates | The shop's Meta invoice matching our recorded cost |
| Contact sync for a third-party shop under coexistence (no history is imported, Q12) | Coexistence verified on day one on the owner's number (Q12); a number that cannot use it moves fully to Bhendi Bazaar | A second shop's number |
| The 200-a-week onboarding limit | The limit read from Meta; "Full for now" tested at 10 | Meta showing the higher limit |

## Switch-on checklist
Done once review passes, in this order; each line is checkable.

| # | Check |
|---|---|
| 1 | Production env holds the Meta app id, app secret, webhook verify token and the Embedded Signup configuration id |
| 2 | Production webhooks subscribed: Instagram `comments`, `messages`; WhatsApp `messages`, `message_template_status_update`, `account_update`, `history`, `smb_app_state_sync`, `smb_message_echoes` |
| 3 | A test event of each field reaches production and appears once |
| 4 | Data-deletion and deauthorize callbacks answer a signed test request |
| 5 | The owner's shop connects both in production and every after-approval check above passes |
| 6 | `CHANNELS_CONNECT` gains `instagram` and `whatsapp` (Q1, Q2) |
| 7 | CHANGELOG entry; this document's Verified date bumped |

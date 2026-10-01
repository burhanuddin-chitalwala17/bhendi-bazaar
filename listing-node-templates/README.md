# Listing node templates

- **Verified:** 2026-10-01
- **Covers:** `listing-node-templates/`

The bulk-upload templates each platform publishes for the categories this store sells. They are
the evidence the channel mappings are derived from
([ADR-0045](../docs/adr/0045-channel-mappings-are-versioned-data.md)), which is why the list below
records a checksum and a date rather than only a filename.

## Why the files themselves are not committed

Nineteen megabytes of binary spreadsheets, which git cannot diff and never forgets. A template
re-downloaded next quarter would add its whole weight again, and the history would carry every
version for ever while showing nothing about what changed. They are also another company's
templates, and this repository is on an account that is not ours to publish them from.

What is worth versioning is the data extracted from them — field names, requirement levels and
permitted values — because that is reviewable in a diff. This manifest is what ties that data
back to the file it came from.

## Getting them again

Amazon: Seller Central, Catalogue, Add Products via Upload, Download Product Spreadsheet, with
every product type selected at once — one workbook covers them all. Flipkart: Seller Hub, Add
Listings in Bulk, one file per vertical. Meesho: Supplier Panel, Bulk Catalog Upload, one file
per category.

## The extracted data

`extracted/` holds what was read out of the files above, one JSON per platform. It is committed
because it is reviewable in a diff and because the mappings are derived from it.

- `amazon.json` — 390 field definitions across the ten product types, each with its requirement
  level. Amazon publishes one workbook for every type, so the product types are listed once at
  the top rather than per file.
- `flipkart.json` — per node: the mandatory, conditionally mandatory and recommended field names,
  the variant axes that node allows, and the permitted values for every field that restricts them.
  Requirement level is carried in the spreadsheet as a cell colour, decoded against the legend on
  each file's summary sheet.
- `flipkart-shared-lists.json` — the two lists Flipkart repeats in every node, stored once.
- `meesho.json` — per node: every field and whether it is compulsory.

Regenerating it needs the binaries, which are not here; get them as described above. Reading
Flipkart's legacy `.xls` needs `xlrd`, which is not a project dependency and belongs in a
throwaway virtualenv rather than in `package.json`.

## What is here

| Platform | File | Bytes | SHA-256 (first 16) |
|---|---|---|---|
| amazon | `ETHNIC_WEAR_PANTS_RUG_SOCKS_TOTE_BAG.xlsm` | 1,502,927 | `92cb7697b1647c26` |
| flipkart | `C_abaya-burqa_9f000ee393424e5a_0110-1638FK_REQXQ6LQKQI8H.xls` | 1,569,280 | `bc884ee9ffc65a65` |
| flipkart | `C_bag_9f000ee393424e5a_0110-1647FK_REQIAXHOXXQAQ.xls` | 737,280 | `2bc07f480a733135` |
| flipkart | `C_hand-messenger-bag_9f000ee393424e5a_0110-1650FK_REQE6YXXL36QF.xls` | 771,584 | `f6a36e3c963fb414` |
| flipkart | `C_incense-stick_9f000ee393424e5a_0110-1655FK_REQX9LQOQQEJ6.xls` | 708,096 | `86d88183a093dda6` |
| flipkart | `C_mat_9f000ee393424e5a_0110-1642FK_REQQ9FTVTTOTL.xls` | 753,664 | `df0015c3ef9c5693` |
| flipkart | `C_ring_9f000ee393424e5a_0110-1653FK_REQHYE2AVE68Q.xls` | 887,808 | `833ed820ac332ebc` |
| flipkart | `C_salwar_9f000ee393424e5a_0110-1640FK_REQOYIT2Q3HQF.xls` | 1,563,648 | `08de41cee1ed07a7` |
| flipkart | `C_sling-bag_9f000ee393424e5a_0110-1646FK_REQXQQHQQIF6I.xls` | 750,080 | `c3d013927fe47af1` |
| flipkart | `C_sock_9f000ee393424e5a_0110-1654FK_REQLEEHQHFXQY.xls` | 1,540,608 | `3a2e36e1637b4c44` |
| flipkart | `C_travel-pouch_9f000ee393424e5a_0110-1651FK_REQFT63ONKKY8.xls` | 729,088 | `d6b92cb79368a1de` |
| flipkart | `C_travel-toiletry-kit_9f000ee393424e5a_0110-1651FK_REQJH6LNYQ2NV.xls` | 727,040 | `4615b646422eb057` |
| flipkart | `C_trouser_9f000ee393424e5a_0110-1641FK_REQVKAQ66XEYX.xls` | 1,574,912 | `8243f22c8f9ee09a` |
| meesho | `Abayas-11307-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 81,202 | `bf30f110f352c037` |
| meesho | `Attar-11496-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 94,470 | `ba6771eb233c7871` |
| meesho | `Backpacks-10041-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 86,652 | `6c877c8e86b8e93d` |
| meesho | `Burqa-19263-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 91,155 | `01023eef0a7ab231` |
| meesho | `Cross-Body-Bags---Sling-Bags-10215-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 89,996 | `be42ca964f69eccf` |
| meesho | `Deodorant---Fragrances-10171-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 96,918 | `0eb7ce2d082bf7b0` |
| meesho | `Deodorant---Fragrances-10527-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 93,012 | `c3e5ea4581a4e70e` |
| meesho | `Floormats---Dhurries-10118-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 72,910 | `5060772bf894f7fb` |
| meesho | `Gifting-Combo-18513-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 76,151 | `6ca22468f19802f5` |
| meesho | `Handbags-10130-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 91,530 | `0aa105713c075b1c` |
| meesho | `Hijab-11221-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 77,319 | `07e0208f8d2a6af1` |
| meesho | `Medium-Weight-Carpets-11042-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 74,023 | `c17e641afc9af68f` |
| meesho | `Niqab-11220-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 75,514 | `beffb71432b40f06` |
| meesho | `Other-Islamic-Wear-19264-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 89,102 | `5211a3c0886ee0a1` |
| meesho | `Palazzos-10190-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 97,473 | `380d65166bd21445` |
| meesho | `Pouches-12412-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 80,037 | `990a93fbb75e4940` |
| meesho | `Real-Silver-Rings-18443-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 78,401 | `c0813debcaa56d8d` |
| meesho | `Rings-10017-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 91,328 | `0109dc0a9342c4d5` |
| meesho | `Socks-10217-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 80,287 | `b901b5f536cc9447` |
| meesho | `Socks-10218-EXTERNAL-MeeshoTemplate2PricesGSTIN.xlsx` | 77,549 | `99a4e4c4789cd000` |

33 files, downloaded 2026-10-01.

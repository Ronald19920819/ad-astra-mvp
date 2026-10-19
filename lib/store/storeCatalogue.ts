// AD Astra Store -- Stage A fixed catalogue (catalogue/navigation only).
//
// This is deliberately a static, typed config array (mirroring
// lib/subjects/subjectConfig.ts's own static-config precedent), not a
// database table -- Stage A has no purchasing, so there is nothing yet
// that needs to be queried, mutated, or made admin-editable. A future
// stage that adds redemption availability/affordability/admin management
// can migrate this into a real table without this module's shape
// changing for its existing six items.
//
// Each `id` is a stable slug that a future redemption-request stage must
// be able to reference unchanged -- never renumber or repurpose an id.
export type StoreRewardProvider = "KFC" | "Mr D SnackMe";

export type StoreRewardRedemptionMethod =
  | "in_store_voucher"
  | "app_claim";

export type StoreCatalogueItem = {
  id: string;
  provider: StoreRewardProvider;
  title: string;
  randValue: number;
  coinCost: number;
  redemptionMethod: StoreRewardRedemptionMethod;
  description: string;
  // Short, honest fine print shown on the card -- never a promise this
  // codebase can't keep (free delivery, full-meal coverage, universal
  // branch acceptance, an official partnership).
  fulfilmentNote: string;
};

export const STORE_CATALOGUE: StoreCatalogueItem[] = [
  {
    id: "kfc-r20",
    provider: "KFC",
    title: "KFC R20 Voucher",
    randValue: 20,
    coinCost: 2000,
    redemptionMethod: "in_store_voucher",
    description: "A digital KFC food voucher.",
    fulfilmentNote: "Potential in-store redemption, subject to final provider confirmation.",
  },
  {
    id: "kfc-r50",
    provider: "KFC",
    title: "KFC R50 Voucher",
    randValue: 50,
    coinCost: 5000,
    redemptionMethod: "in_store_voucher",
    description: "A digital KFC food voucher.",
    fulfilmentNote: "Potential in-store redemption, subject to final provider confirmation.",
  },
  {
    id: "kfc-r100",
    provider: "KFC",
    title: "KFC R100 Voucher",
    randValue: 100,
    coinCost: 10000,
    redemptionMethod: "in_store_voucher",
    description: "A digital KFC food voucher.",
    fulfilmentNote: "Potential in-store redemption, subject to final provider confirmation.",
  },
  {
    id: "mrd-snackme-r20",
    provider: "Mr D SnackMe",
    title: "Mr D SnackMe R20 Gift",
    randValue: 20,
    coinCost: 2000,
    redemptionMethod: "app_claim",
    description: "A digital Mr D SnackMe food gift.",
    fulfilmentNote: "Requires the recipient to use the Mr D app to claim and spend it, according to provider rules.",
  },
  {
    id: "mrd-snackme-r50",
    provider: "Mr D SnackMe",
    title: "Mr D SnackMe R50 Gift",
    randValue: 50,
    coinCost: 5000,
    redemptionMethod: "app_claim",
    description: "A digital Mr D SnackMe food gift.",
    fulfilmentNote: "Requires the recipient to use the Mr D app to claim and spend it, according to provider rules.",
  },
  {
    id: "mrd-snackme-r100",
    provider: "Mr D SnackMe",
    title: "Mr D SnackMe R100 Gift",
    randValue: 100,
    coinCost: 10000,
    redemptionMethod: "app_claim",
    description: "A digital Mr D SnackMe food gift.",
    fulfilmentNote: "Requires the recipient to use the Mr D app to claim and spend it, according to provider rules.",
  },
];

import { prisma } from "@server/shared/prisma";
import type { PaymentDetailsDto } from "@server/payouts/credit.types";

/**
 * The one reader and writer of `PlatformPaymentDetails` (ADR-0003; shop-credits D7): where a shop
 * sends a top-up. One row, addressed by a constant id; absent means nothing has been saved yet.
 */
const PLATFORM = "platform";

const EMPTY: PaymentDetailsDto = { upiId: null, qrRef: null, accountName: null, accountNumber: null, ifsc: null, bankName: null };

export class PaymentDetailsRepository {
  async read(): Promise<PaymentDetailsDto> {
    const row = await prisma.platformPaymentDetails.findUnique({
      where: { id: PLATFORM },
      select: { upiId: true, qrRef: true, accountName: true, accountNumber: true, ifsc: true, bankName: true },
    });
    return row ?? EMPTY;
  }

  async save(details: PaymentDetailsDto, updatedByUserId: string): Promise<void> {
    await prisma.platformPaymentDetails.upsert({
      where: { id: PLATFORM },
      create: { id: PLATFORM, ...details, updatedByUserId },
      update: { ...details, updatedByUserId },
    });
  }
}

export const paymentDetailsRepository = new PaymentDetailsRepository();

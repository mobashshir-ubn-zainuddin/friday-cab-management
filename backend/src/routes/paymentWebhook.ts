import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { verifyWebhookSignature } from '../utils/razorpay';

const router = Router();

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        status?: string;
        amount?: number;
      };
    };
    order?: {
      entity: {
        id: string;
        status?: string;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
      };
    };
  };
}

// Idempotent: mark a payment COMPLETED. Safe to call multiple times.
const completePayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string
) => {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId }
  });

  if (!payment) {
    console.warn(`[Webhook] No local payment found for Razorpay order ${razorpayOrderId}`);
    return null;
  }

  if (payment.status === 'COMPLETED') {
    console.log(`[Webhook] Payment ${payment.id} already COMPLETED — skipping duplicate event`);
    return payment;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      razorpayPaymentId,
      paidAt: new Date()
    }
  });

  console.log(`[Webhook] Payment ${payment.id} marked COMPLETED (Razorpay order: ${razorpayOrderId}, payment: ${razorpayPaymentId})`);
  return updated;
};

// Idempotent: mark a payment FAILED. Will not overwrite COMPLETED.
const failPayment = async (razorpayOrderId: string, razorpayPaymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId }
  });

  if (!payment) {
    console.warn(`[Webhook] No local payment found for Razorpay order ${razorpayOrderId}`);
    return null;
  }

  // Never downgrade a COMPLETED payment
  if (payment.status === 'COMPLETED') {
    console.warn(`[Webhook] payment.failed received for already-COMPLETED payment ${payment.id} — ignoring`);
    return payment;
  }

  if (payment.status === 'FAILED') {
    console.log(`[Webhook] Payment ${payment.id} already FAILED — skipping duplicate event`);
    return payment;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      razorpayPaymentId
    }
  });

  console.log(`[Webhook] Payment ${payment.id} marked FAILED (Razorpay order: ${razorpayOrderId}, payment: ${razorpayPaymentId})`);
  return updated;
};

router.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature || typeof signature !== 'string') {
    console.warn('[Webhook] Request missing x-razorpay-signature header');
    return res.status(400).json({ success: false, error: 'Missing webhook signature' });
  }

  const rawBody = req.body as Buffer;

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    console.warn('[Webhook] Empty or non-buffer body received');
    return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[Webhook] Signature verification failed — possible replay or misconfigured secret');
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  let event: RazorpayWebhookPayload;

  try {
    event = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }

  // Log the event name and safe identifiers — never log secrets or sensitive payment data
  const safeOrderId = event.payload.order?.entity.id || event.payload.payment?.entity.order_id || 'unknown';
  const safePaymentId = event.payload.payment?.entity.id || 'unknown';
  console.log(`[Webhook] Received event: ${event.event} | order: ${safeOrderId} | payment: ${safePaymentId}`);

  try {
    switch (event.event) {
      case 'payment.captured': {
        // Most common: automatic capture enabled on merchant account
        const paymentEntity = event.payload.payment?.entity;
        if (paymentEntity?.order_id && paymentEntity.id) {
          await completePayment(paymentEntity.order_id, paymentEntity.id);
        }
        break;
      }

      case 'payment.authorized': {
        // Payment authorized but not yet captured (manual capture mode)
        // Do NOT mark COMPLETED here — wait for payment.captured
        console.log(`[Webhook] payment.authorized received for order ${safeOrderId} — awaiting capture`);
        break;
      }

      case 'order.paid': {
        // Fired when the full order amount is paid (combines well with QR flows)
        const orderId = event.payload.order?.entity.id;
        const paymentId = event.payload.payment?.entity.id;
        if (orderId && paymentId) {
          await completePayment(orderId, paymentId);
        }
        break;
      }

      case 'payment.failed': {
        const paymentEntity = event.payload.payment?.entity;
        if (paymentEntity?.order_id && paymentEntity.id) {
          await failPayment(paymentEntity.order_id, paymentEntity.id);
        }
        break;
      }

      case 'refund.created': {
        const refundEntity = event.payload.refund?.entity;
        if (refundEntity?.payment_id) {
          const payment = await prisma.payment.findFirst({
            where: { razorpayPaymentId: refundEntity.payment_id }
          });
          if (payment && payment.status !== 'REFUNDED') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'REFUNDED' }
            });
            console.log(`[Webhook] Payment ${payment.id} marked REFUNDED (refund: ${refundEntity.id})`);
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.event}`);
        break;
    }

    // Always return 200 to acknowledge receipt — prevents Razorpay retries on our processing errors
    res.json({ success: true });
  } catch (error) {
    console.error(`[Webhook] Error processing event ${event.event}:`, error);
    // Return 500 so Razorpay retries the webhook
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;

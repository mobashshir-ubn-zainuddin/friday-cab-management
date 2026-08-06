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
      };
    };
    order?: {
      entity: {
        id: string;
      };
    };
  };
}

const completePayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string
) => {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId }
  });

  if (!payment) {
    console.warn(`Webhook: no payment found for order ${razorpayOrderId}`);
    return;
  }

  if (payment.status === 'COMPLETED') {
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      razorpayPaymentId,
      paidAt: new Date()
    }
  });
};

const failPayment = async (razorpayOrderId: string, razorpayPaymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId }
  });

  if (!payment) {
    console.warn(`Webhook: no payment found for order ${razorpayOrderId}`);
    return;
  }

  if (payment.status === 'COMPLETED') {
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      razorpayPaymentId
    }
  });
};

router.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing webhook signature' });
  }

  const rawBody = req.body as Buffer;

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  let event: RazorpayWebhookPayload;

  try {
    event = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }

  try {
    switch (event.event) {
      case 'payment.captured': {
        const paymentEntity = event.payload.payment?.entity;
        if (paymentEntity?.order_id && paymentEntity.id) {
          await completePayment(paymentEntity.order_id, paymentEntity.id);
        }
        break;
      }
      case 'order.paid': {
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
      default:
        break;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;

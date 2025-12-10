// Stripe webhook handlers - connection:conn_stripe_01KC58QQV1T82GN4BC0PVYGJBK
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { stripeService } from './stripeService';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    const stripe = await getUncachableStripeClient();
    const webhookSecret = await sync.getWebhookSecret(uuid);
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[stripe] Webhook signature verification failed:', err.message);
      throw err;
    }
    
    await sync.processWebhook(payload, signature, uuid);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: { userId?: string; lookupKey?: string } | null;
        payment_intent?: string;
        amount_total?: number | null;
      };
      
      console.log('[stripe] Processing checkout.session.completed for user:', session.metadata?.userId);
      const result = await stripeService.processCheckoutCompleted(session);
      
      if (result.success) {
        console.log('[stripe] Credits added successfully:', result);
      } else {
        console.error('[stripe] Failed to process credits:', result);
      }
    }
  }
}

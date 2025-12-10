// Stripe service - connection:conn_stripe_01KC58QQV1T82GN4BC0PVYGJBK
import { getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { PRODUCT_CATALOG, CREDIT_TYPE_TO_LOOKUP_KEY } from '@shared/schema';

export class StripeService {
  async createCustomer(email: string, userId: string, name?: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
  }

  async createCheckoutSession(
    customerId: string, 
    creditType: 'transcription' | 'analysis',
    successUrl: string, 
    cancelUrl: string,
    userId: string
  ) {
    const stripe = await getUncachableStripeClient();
    
    const lookupKey = CREDIT_TYPE_TO_LOOKUP_KEY[creditType];
    if (!lookupKey) {
      throw new Error(`Invalid credit type: ${creditType}`);
    }
    
    const product = PRODUCT_CATALOG[lookupKey];

    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: product.name,
            description: product.description,
            metadata: {
              lookupKey: product.lookupKey,
            },
          },
          unit_amount: product.priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        lookupKey: product.lookupKey,
      },
    });
  }

  async verifyCheckoutSession(sessionId: string) {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid' && session.metadata?.lookupKey) {
      const lookupKey = session.metadata.lookupKey as keyof typeof PRODUCT_CATALOG;
      const product = PRODUCT_CATALOG[lookupKey];
      if (!product) {
        return { success: false };
      }
      return { 
        success: true, 
        creditType: product.creditType, 
        creditsAmount: product.credits,
        message: `${product.credits} crédito(s) de ${product.creditType === 'transcription' ? 'transcrição' : 'análise'} serão adicionados em breve.`
      };
    }
    
    return { success: false };
  }

  async processCheckoutCompleted(session: {
    metadata?: { userId?: string; lookupKey?: string } | null;
    payment_intent?: string;
    amount_total?: number | null;
  }) {
    if (!session.metadata?.userId || !session.metadata?.lookupKey) {
      return { success: false, error: 'Missing metadata' };
    }

    const userId = session.metadata.userId;
    const lookupKey = session.metadata.lookupKey as keyof typeof PRODUCT_CATALOG;
    
    const product = PRODUCT_CATALOG[lookupKey];
    if (!product) {
      return { success: false, error: 'Invalid lookup key' };
    }
    
    const expectedAmount = product.priceInCents;
    
    if (session.amount_total !== expectedAmount) {
      console.error(`[stripe] Amount mismatch: expected ${expectedAmount}, got ${session.amount_total}`);
      return { success: false, error: 'Amount mismatch' };
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const stripePaymentId = session.payment_intent as string;
    
    try {
      const created = await storage.createPaymentIdempotent({
        userId,
        stripePaymentId,
        amount: expectedAmount,
        currency: 'BRL',
        creditType: product.creditType,
        creditsAmount: product.credits,
        status: 'completed',
      });
      
      if (!created) {
        console.log('[stripe] Payment already processed (idempotent)');
        return { success: true, message: 'Payment already processed' };
      }
      
      if (product.creditType === 'transcription') {
        await storage.updateUserCredits(
          userId,
          (user.transcriptionCredits || 0) + product.credits,
          user.analysisCredits || 0
        );
      } else {
        await storage.updateUserCredits(
          userId,
          user.transcriptionCredits || 0,
          (user.analysisCredits || 0) + product.credits
        );
      }

      return { success: true, creditType: product.creditType, creditsAmount: product.credits };
    } catch (error: any) {
      if (error.code === '23505') {
        console.log('[stripe] Payment already processed (unique constraint)');
        return { success: true, message: 'Payment already processed' };
      }
      throw error;
    }
  }
}

export const stripeService = new StripeService();

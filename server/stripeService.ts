// Stripe service - connection:conn_stripe_01KC58QQV1T82GN4BC0PVYGJBK
import { getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

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
    
    const productName = creditType === 'transcription' 
      ? 'Pacote Transcrição - 100 páginas'
      : 'Pacote Análise Bardin - 1 análise';
    
    const creditsAmount = creditType === 'transcription' ? 100 : 1;

    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: productName,
            description: creditType === 'transcription'
              ? '100 páginas de transcrição automática com IA'
              : '1 análise qualitativa completa baseada em Bardin',
          },
          unit_amount: 3500, // R$ 35.00 in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        creditType,
        creditsAmount: creditsAmount.toString(),
      },
    });
  }

  async handlePaymentSuccess(sessionId: string) {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid' && session.metadata) {
      const userId = session.metadata.userId;
      const creditType = session.metadata.creditType as 'transcription' | 'analysis';
      const creditsAmount = parseInt(session.metadata.creditsAmount || '0');
      
      const user = await storage.getUser(userId);
      if (user) {
        if (creditType === 'transcription') {
          await storage.updateUserCredits(
            userId,
            (user.transcriptionCredits || 0) + creditsAmount,
            user.analysisCredits || 0
          );
        } else {
          await storage.updateUserCredits(
            userId,
            user.transcriptionCredits || 0,
            (user.analysisCredits || 0) + creditsAmount
          );
        }

        await storage.createPayment({
          userId,
          stripePaymentId: session.payment_intent as string,
          amount: session.amount_total || 3500,
          currency: 'BRL',
          creditType,
          creditsAmount,
          status: 'completed',
        });

        return { success: true, creditType, creditsAmount };
      }
    }
    
    return { success: false };
  }
}

export const stripeService = new StripeService();

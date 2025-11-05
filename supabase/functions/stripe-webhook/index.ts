import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  try {
    const body = await req.text()

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(supabase, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id
  const status = subscription.status
  const periodEnd = new Date(subscription.current_period_end * 1000)

  // Determine plan based on price ID
  let plan = 'free'
  const priceId = subscription.items.data[0]?.price.id

  // You'll need to replace these with your actual Stripe price IDs
  if (priceId === Deno.env.get('STRIPE_PRO_MONTHLY_PRICE_ID') || priceId === Deno.env.get('STRIPE_PRO_YEARLY_PRICE_ID')) {
    plan = 'pro'
  } else if (priceId === Deno.env.get('STRIPE_PREMIUM_MONTHLY_PRICE_ID') || priceId === Deno.env.get('STRIPE_PREMIUM_YEARLY_PRICE_ID')) {
    plan = 'premium'
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_status: status,
      subscription_period_end: periodEnd.toISOString(),
      plan: status === 'active' || status === 'trialing' ? plan : 'free',
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  console.log(`Updated subscription for customer ${customerId}`)
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: null,
      subscription_status: 'canceled',
      plan: 'free',
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    throw new Error(`Failed to delete subscription: ${error.message}`)
  }

  console.log(`Deleted subscription for customer ${customerId}`)
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  // Update subscription status to active
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error(`Failed to update payment status: ${error.message}`)
  }

  console.log(`Payment succeeded for customer ${customerId}`)
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  // Update subscription status to past_due
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'past_due',
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error(`Failed to update payment status: ${error.message}`)
  }

  console.log(`Payment failed for customer ${customerId}`)
}

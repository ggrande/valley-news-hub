import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createNetworkCheckoutSession } from "@/lib/network-payments.functions";

interface Props {
  priceId: string;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
  tier: "self_host_license" | "managed_mirror";
}

export function StripeEmbeddedCheckout({ priceId, customerEmail, userId, returnUrl, tier }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createNetworkCheckoutSession({
      data: {
        priceId,
        tier,
        customerEmail,
        userId,
        returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

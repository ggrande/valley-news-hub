import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createMerchCheckoutSession } from "@/lib/merch.functions";

interface Props {
  syncVariantId: number;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  image?: string;
  customerEmail?: string;
  userId?: string;
}

export function MerchEmbeddedCheckout(props: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createMerchCheckoutSession({
      data: {
        ...props,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
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

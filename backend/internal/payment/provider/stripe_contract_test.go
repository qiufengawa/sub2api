//go:build unit

package provider

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
	stripe "github.com/stripe/stripe-go/v85"
	"github.com/stripe/stripe-go/v85/webhook"
)

// stripeLifecycleBackend exercises the SDK boundary without opening a socket.
// It intentionally records the request path and typed params so the provider
// contract remains visible even when external Stripe credentials are absent.
type stripeLifecycleBackend struct {
	paths         []string
	createdParams *stripe.PaymentIntentCreateParams
	refundParams  *stripe.RefundCreateParams
}

func (b *stripeLifecycleBackend) Call(method, path, _ string, params stripe.ParamsContainer, v stripe.LastResponseSetter) error {
	b.paths = append(b.paths, method+" "+path)
	switch {
	case method == http.MethodPost && path == "/v1/payment_intents":
		b.createdParams = params.(*stripe.PaymentIntentCreateParams)
		pi := v.(*stripe.PaymentIntent)
		pi.ID = "pi_contract"
		pi.ClientSecret = "pi_contract_secret"
		pi.Amount = 1234
		pi.Currency = stripe.CurrencyCNY
		pi.Status = stripe.PaymentIntentStatusRequiresPaymentMethod
		pi.Metadata = map[string]string{"orderId": "order_contract"}
	case method == http.MethodGet && path == "/v1/payment_intents/pi_contract":
		pi := v.(*stripe.PaymentIntent)
		pi.ID = "pi_contract"
		pi.Amount = 1234
		pi.Currency = stripe.CurrencyCNY
		pi.Status = stripe.PaymentIntentStatusSucceeded
	case method == http.MethodPost && path == "/v1/payment_intents/pi_contract/cancel":
		pi := v.(*stripe.PaymentIntent)
		pi.ID = "pi_contract"
		pi.Status = stripe.PaymentIntentStatusCanceled
	case method == http.MethodPost && path == "/v1/refunds":
		b.refundParams = params.(*stripe.RefundCreateParams)
		refund := v.(*stripe.Refund)
		refund.ID = "re_contract"
		refund.Status = stripe.RefundStatusSucceeded
	case method == http.MethodGet && path == "/v1/refunds/re_contract":
		refund := v.(*stripe.Refund)
		refund.ID = "re_contract"
		refund.Status = stripe.RefundStatusSucceeded
	default:
		return errors.New("unexpected Stripe contract request: " + method + " " + path)
	}
	return nil
}

func (*stripeLifecycleBackend) CallStreaming(string, string, string, stripe.ParamsContainer, stripe.StreamingLastResponseSetter) error {
	return nil
}

func (*stripeLifecycleBackend) CallRaw(string, string, string, []byte, *stripe.Params, stripe.LastResponseSetter) error {
	return errors.New("unexpected raw Stripe contract request")
}

func (*stripeLifecycleBackend) CallMultipart(string, string, string, string, *bytes.Buffer, *stripe.Params, stripe.LastResponseSetter) error {
	return errors.New("unexpected multipart Stripe contract request")
}

func (*stripeLifecycleBackend) SetMaxNetworkRetries(int64) {}

func newStripeContractProvider(backend stripe.Backend) *Stripe {
	return &Stripe{
		config:      map[string]string{"secretKey": "sk_test_contract", "webhookSecret": "whsec_contract", "currency": "CNY"},
		initialized: true,
		sc:          stripe.NewClient("sk_test_contract", stripe.WithBackends(&stripe.Backends{API: backend})),
	}
}

func TestStripePaymentLifecycleUsesTypedSDKContract(t *testing.T) {
	backend := &stripeLifecycleBackend{}
	provider := newStripeContractProvider(backend)

	created, err := provider.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID:            "order_contract",
		Amount:             "12.34",
		Subject:            "Contract subject",
		InstanceSubMethods: "wxpay,card",
	})
	require.NoError(t, err)
	require.Equal(t, "pi_contract", created.TradeNo)
	require.Equal(t, "pi_contract_secret", created.ClientSecret)
	require.Equal(t, "CNY", created.Currency)
	require.NotNil(t, backend.createdParams)
	require.Equal(t, int64(1234), *backend.createdParams.Amount)
	require.Equal(t, "cny", string(*backend.createdParams.Currency))
	require.Equal(t, "pi-order_contract", *backend.createdParams.IdempotencyKey)
	require.Equal(t, "order_contract", backend.createdParams.Metadata["orderId"])
	require.Len(t, backend.createdParams.PaymentMethodTypes, 2)
	require.Equal(t, "wechat_pay", *backend.createdParams.PaymentMethodTypes[0])
	require.Equal(t, "card", *backend.createdParams.PaymentMethodTypes[1])
	require.NotNil(t, backend.createdParams.PaymentMethodOptions)
	require.Equal(t, "web", *backend.createdParams.PaymentMethodOptions.WeChatPay.Client)

	queried, err := provider.QueryOrder(context.Background(), "pi_contract")
	require.NoError(t, err)
	require.Equal(t, payment.ProviderStatusPaid, queried.Status)
	require.Equal(t, 12.34, queried.Amount)
	require.Equal(t, "CNY", queried.Metadata["currency"])

	refund, err := provider.Refund(context.Background(), payment.RefundRequest{
		TradeNo: "pi_contract",
		OrderID: "order_contract",
		Amount:  "1.23",
	})
	require.NoError(t, err)
	require.Equal(t, "re_contract", refund.RefundID)
	require.Equal(t, payment.ProviderStatusSuccess, refund.Status)
	require.NotNil(t, backend.refundParams)
	require.Equal(t, int64(123), *backend.refundParams.Amount)
	require.Equal(t, "re-order_contract-123", *backend.refundParams.IdempotencyKey)

	refundStatus, err := provider.QueryRefund(context.Background(), payment.RefundQueryRequest{RefundID: "re_contract"})
	require.NoError(t, err)
	require.Equal(t, payment.ProviderStatusSuccess, refundStatus.Status)
	require.NoError(t, provider.CancelPayment(context.Background(), "pi_contract"))
	require.Equal(t, []string{
		"POST /v1/payment_intents",
		"GET /v1/payment_intents/pi_contract",
		"POST /v1/refunds",
		"GET /v1/refunds/re_contract",
		"POST /v1/payment_intents/pi_contract/cancel",
	}, backend.paths)
}

func TestStripeVerifyNotificationChecksSignatureAndMapsPaymentIntent(t *testing.T) {
	provider := newStripeContractProvider(&stripeLifecycleBackend{})
	raw := `{"id":"evt_contract","object":"event","api_version":"` + stripe.APIVersion + `","created":1778241600,"data":{"object":{"id":"pi_contract","object":"payment_intent","amount":1234,"currency":"cny","metadata":{"orderId":"order_contract"}}},"livemode":false,"pending_webhooks":1,"type":"payment_intent.succeeded"}`
	signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload:   []byte(raw),
		Secret:    "whsec_contract",
		Timestamp: time.Now(),
	})

	notification, err := provider.VerifyNotification(context.Background(), raw, map[string]string{"stripe-signature": signed.Header})
	require.NoError(t, err)
	require.NotNil(t, notification)
	require.Equal(t, "pi_contract", notification.TradeNo)
	require.Equal(t, "order_contract", notification.OrderID)
	require.Equal(t, payment.ProviderStatusSuccess, notification.Status)
	require.Equal(t, 12.34, notification.Amount)
	require.Equal(t, "CNY", notification.Metadata["currency"])

	badHeaders := map[string]string{"stripe-signature": strings.Replace(signed.Header, "v1=", "v1=00", 1)}
	_, err = provider.VerifyNotification(context.Background(), raw, badHeaders)
	require.ErrorContains(t, err, "verify notification")

	unknownRaw := strings.Replace(raw, `"payment_intent.succeeded"`, `"charge.succeeded"`, 1)
	unknownSigned := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{Payload: []byte(unknownRaw), Secret: "whsec_contract"})
	unknown, err := provider.VerifyNotification(context.Background(), unknownRaw, map[string]string{"stripe-signature": unknownSigned.Header})
	require.NoError(t, err)
	require.Nil(t, unknown)
}

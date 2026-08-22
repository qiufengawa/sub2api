//go:build unit

package provider

import (
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
)

// makeWxpaySignedNotification builds the same APIv3 envelope that WeChat Pay
// sends, using an in-memory RSA key and AES-GCM payload.  It exercises the
// provider's actual notify.Handler path without a network or merchant secret.
func makeWxpaySignedNotification(t *testing.T, privateKey *rsa.PrivateKey, apiV3Key, eventType string) (string, map[string]string) {
	t.Helper()
	plain := map[string]any{
		"appid":            "wx-app-contract",
		"mchid":            "mch-contract",
		"out_trade_no":     "order_wx_contract",
		"transaction_id":   "wx_tx_contract",
		"trade_state":      "SUCCESS",
		"trade_state_desc": "支付成功",
		"amount":           map[string]any{"total": 1234, "currency": "CNY"},
	}
	plaintext, err := json.Marshal(plain)
	require.NoError(t, err)

	nonce := []byte("0123456789ab")
	block, err := aes.NewCipher([]byte(apiV3Key))
	require.NoError(t, err)
	gcm, err := cipher.NewGCM(block)
	require.NoError(t, err)
	associatedData := "transaction"
	ciphertext := gcm.Seal(nil, nonce, plaintext, []byte(associatedData))

	envelope := map[string]any{
		"id":            "evt-wx-contract",
		"create_time":   time.Now().UTC().Format(time.RFC3339),
		"resource_type": "encrypt-resource",
		"event_type":    eventType,
		"summary":       "支付成功",
		"resource": map[string]string{
			"original_type":   "transaction",
			"algorithm":       "AEAD_AES_256_GCM",
			"ciphertext":      base64.StdEncoding.EncodeToString(ciphertext),
			"associated_data": associatedData,
			"nonce":           string(nonce),
		},
	}
	body, err := json.Marshal(envelope)
	require.NoError(t, err)

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	nonceHeader := "nonce-contract"
	message := timestamp + "\n" + nonceHeader + "\n" + string(body) + "\n"
	digest := sha256.Sum256([]byte(message))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	require.NoError(t, err)
	return string(body), map[string]string{
		"Wechatpay-Timestamp": timestamp,
		"Wechatpay-Nonce":     nonceHeader,
		"Wechatpay-Signature": base64.StdEncoding.EncodeToString(signature),
		"Wechatpay-Serial":    "PUB_KEY_CONTRACT",
		"Content-Type":        "application/json",
	}
}

func TestWxpayVerifyNotificationChecksAPIV3SignatureAndDecryptsTransaction(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	require.NoError(t, err)
	pubDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)
	config := map[string]string{
		"appId":       "wx-app-contract",
		"mchId":       "mch-contract",
		"privateKey":  string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privDER})),
		"apiV3Key":    "01234567890123456789012345678901",
		"publicKey":   string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})),
		"publicKeyId": "PUB_KEY_CONTRACT",
		"certSerial":  "MERCHANT_SERIAL",
	}
	provider, err := NewWxpay("wx-contract", config)
	require.NoError(t, err)

	raw, headers := makeWxpaySignedNotification(t, privateKey, config["apiV3Key"], wxpayEventTransactionSuccess)
	notification, err := provider.VerifyNotification(context.Background(), raw, headers)
	require.NoError(t, err)
	require.NotNil(t, notification)
	require.Equal(t, "wx_tx_contract", notification.TradeNo)
	require.Equal(t, "order_wx_contract", notification.OrderID)
	require.Equal(t, float64(12.34), notification.Amount)
	require.Equal(t, "CNY", notification.Metadata[wxpayMetadataCurrency])
	require.Equal(t, payment.ProviderStatusSuccess, notification.Status)

	badHeaders := cloneWxHeaders(headers)
	badHeaders["Wechatpay-Signature"] = strings.Repeat("0", len(headers["Wechatpay-Signature"]))
	_, err = provider.VerifyNotification(context.Background(), raw, badHeaders)
	require.Error(t, err)

	unknownRaw, unknownHeaders := makeWxpaySignedNotification(t, privateKey, config["apiV3Key"], "REFUND.SUCCESS")
	unknown, err := provider.VerifyNotification(context.Background(), unknownRaw, unknownHeaders)
	require.NoError(t, err)
	require.Nil(t, unknown)
}

func cloneWxHeaders(src map[string]string) map[string]string {
	dst := make(map[string]string, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

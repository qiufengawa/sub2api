//go:build unit

package service

import (
	"context"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
)

func TestPaymentServiceRefreshProvidersPreservesRegistryOnDatabaseFailure(t *testing.T) {
	ctx := context.Background()
	client := newPaymentConfigServiceTestClient(t)
	registry := payment.NewRegistry()
	registry.Register(refundProviderTestDouble{})
	svc := &PaymentService{entClient: client, registry: registry}

	// Close the underlying client to force the provider-instance query to fail
	// without opening a listener or requiring a live database.
	require.NoError(t, client.Close())
	svc.RefreshProviders(ctx)

	provider, err := registry.GetProviderByKey(payment.TypeStripe)
	require.NoError(t, err)
	require.NotNil(t, provider, "a failed refresh must not publish an empty registry")
	require.False(t, svc.providersLoaded)

	// Initialisation remains retryable after a transient failure.
	svc.EnsureProviders(ctx)
	require.False(t, svc.providersLoaded)
	provider, err = registry.GetProviderByKey(payment.TypeStripe)
	require.NoError(t, err)
	require.NotNil(t, provider)
}

package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRevocationVersionMatchesLegacyAndBumpedTokens(t *testing.T) {
	user := &User{RevocationVersion: 0}
	legacy := &JWTClaims{}
	modernZero := int64(0)
	modern := &JWTClaims{RevocationVersion: &modernZero}

	require.True(t, RevocationVersionMatches(legacy, user), "legacy tokens remain compatible before first bump")
	require.True(t, RevocationVersionMatches(modern, user))

	user.RevocationVersion = 1
	require.False(t, RevocationVersionMatches(legacy, user), "first durable bump invalidates legacy claims")
	require.False(t, RevocationVersionMatches(modern, user))

	modernOne := int64(1)
	modern.RevocationVersion = &modernOne
	require.True(t, RevocationVersionMatches(modern, user))
}

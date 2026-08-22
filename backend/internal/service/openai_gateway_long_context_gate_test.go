package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOpenAILongContextBillingGateIsOpenAIOnly(t *testing.T) {
	grok := &Account{Platform: PlatformGrok}
	require.Nil(t, openAILongContextBillingGate(grok), "Grok must follow group/channel policy without an OpenAI account gate")

	openai := &Account{Platform: PlatformOpenAI}
	require.NotNil(t, openAILongContextBillingGate(openai))
	require.False(t, *openAILongContextBillingGate(openai))
}

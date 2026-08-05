//go:build unit

package service

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"regexp"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/emailhtml"
	"github.com/stretchr/testify/require"
)

func TestBuildSMTPMessageProducesStandardsCompliantMIME(t *testing.T) {
	config := &SMTPConfig{
		Host:     "smtp.example.com",
		From:     "reply@example.com",
		FromName: "Sub2API 通知",
	}
	body := "<html>\n<body>验证码：123456 &amp; ready</body>\n</html>"

	message, err := buildSMTPMessage(config, "User <user@example.net>", "邮箱验证码", body)
	require.NoError(t, err)
	require.Equal(t, "reply@example.com", message.envelopeFrom)
	require.Equal(t, "user@example.net", message.envelopeTo)

	parsed, err := mail.ReadMessage(bytes.NewReader(message.data))
	require.NoError(t, err)

	from, err := mail.ParseAddress(parsed.Header.Get("From"))
	require.NoError(t, err)
	require.Equal(t, "Sub2API 通知", from.Name)
	require.Equal(t, "reply@example.com", from.Address)

	recipient, err := mail.ParseAddress(parsed.Header.Get("To"))
	require.NoError(t, err)
	require.Equal(t, "User", recipient.Name)
	require.Equal(t, "user@example.net", recipient.Address)

	decodedSubject, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
	require.NoError(t, err)
	require.Equal(t, "邮箱验证码", decodedSubject)
	require.NotEmpty(t, parsed.Header.Get("Date"))
	_, err = mail.ParseDate(parsed.Header.Get("Date"))
	require.NoError(t, err)
	require.Regexp(t, regexp.MustCompile(`^<[0-9a-f]{32}@example\.com>$`), parsed.Header.Get("Message-ID"))
	require.Equal(t, "1.0", parsed.Header.Get("MIME-Version"))
	require.Equal(t, "quoted-printable", parsed.Header.Get("Content-Transfer-Encoding"))

	mediaType, params, err := mime.ParseMediaType(parsed.Header.Get("Content-Type"))
	require.NoError(t, err)
	require.Equal(t, "text/html", mediaType)
	require.Equal(t, "UTF-8", params["charset"])

	decodedBody, err := io.ReadAll(quotedprintable.NewReader(parsed.Body))
	require.NoError(t, err)
	require.Equal(t, strings.ReplaceAll(body, "\n", "\r\n"), string(decodedBody))
}

func TestBuildSMTPMessageEmbedsReferencedIllustrationAsRelatedCIDPart(t *testing.T) {
	config := &SMTPConfig{Host: "smtp.example.com", From: "reply@example.com"}
	body := emailhtml.Render(emailhtml.Message{
		Lang:         "en",
		SiteName:     "Qiu API",
		Category:     "Account security",
		Title:        "Verify your email",
		Tone:         emailhtml.TonePrimary,
		Illustration: emailhtml.IllustrationVerification,
		BodyHTML:     emailhtml.Intro("Complete verification."),
	})
	assets := emailhtml.InlineAssetsForHTML(body)
	require.Len(t, assets, 1)

	message, err := buildSMTPMessageWithInlineAssets(config, "user@example.net", "Security notice", body, assets)
	require.NoError(t, err)
	parsed, err := mail.ReadMessage(bytes.NewReader(message.data))
	require.NoError(t, err)
	require.Empty(t, parsed.Header.Get("Content-Transfer-Encoding"))

	mediaType, params, err := mime.ParseMediaType(parsed.Header.Get("Content-Type"))
	require.NoError(t, err)
	require.Equal(t, "multipart/related", mediaType)
	require.Equal(t, "text/html", params["type"])
	require.NotEmpty(t, params["boundary"])
	require.Regexp(t, regexp.MustCompile(`^<html\.[0-9a-f]{32}@assets\.qiu\.invalid>$`), params["start"])

	reader := multipart.NewReader(parsed.Body, params["boundary"])
	htmlPart, err := reader.NextRawPart()
	require.NoError(t, err)
	require.Equal(t, "text/html; charset=UTF-8", htmlPart.Header.Get("Content-Type"))
	require.Equal(t, "quoted-printable", htmlPart.Header.Get("Content-Transfer-Encoding"))
	require.Equal(t, params["start"], htmlPart.Header.Get("Content-ID"))
	decodedBody, err := io.ReadAll(quotedprintable.NewReader(htmlPart))
	require.NoError(t, err)
	personalizedBody := string(decodedBody)
	require.NotEqual(t, strings.ReplaceAll(body, "\n", "\r\n"), personalizedBody)
	for _, asset := range assets {
		require.NotContains(t, personalizedBody, "cid:"+asset.ContentID)
	}

	for index, asset := range assets {
		imagePart, err := reader.NextRawPart()
		require.NoError(t, err)
		require.Regexp(t, regexp.MustCompile(`^<asset-1\.[0-9a-f]{32}@assets\.qiu\.invalid>$`), imagePart.Header.Get("Content-ID"))
		require.Contains(t, personalizedBody, "cid:"+strings.Trim(imagePart.Header.Get("Content-ID"), "<>"))
		require.Equal(t, "base64", imagePart.Header.Get("Content-Transfer-Encoding"))
		imageMediaType, imageParams, err := mime.ParseMediaType(imagePart.Header.Get("Content-Type"))
		require.NoError(t, err)
		require.Equal(t, "image/png", imageMediaType)
		require.Equal(t, asset.Filename, imageParams["name"])
		decodedImage, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, imagePart))
		require.NoError(t, err)
		require.Equal(t, asset.Data, decodedImage, "inline image part %d does not match its source asset", index+1)
	}
	_, err = reader.NextRawPart()
	require.ErrorIs(t, err, io.EOF)
}

func TestBuildSMTPMessageRejectsUnsafeInlineAssetMetadata(t *testing.T) {
	config := &SMTPConfig{Host: "smtp.example.com", From: "reply@example.com"}
	tests := []emailhtml.InlineAsset{
		{ContentID: "image\r\nBcc: hidden@example.com", Filename: "image.png", MediaType: "image/png", Data: []byte("png")},
		{ContentID: "image", Filename: "image\r\n.png", MediaType: "image/png", Data: []byte("png")},
		{ContentID: "image", Filename: "image.png", MediaType: "text/html", Data: []byte("html")},
		{ContentID: "image", Filename: "image.png", MediaType: "image/png"},
	}
	for _, asset := range tests {
		_, err := buildSMTPMessageWithInlineAssets(config, "user@example.net", "subject", "body", []emailhtml.InlineAsset{asset})
		require.Error(t, err)
	}
	duplicate := emailhtml.InlineAsset{ContentID: "same", Filename: "image.png", MediaType: "image/png", Data: []byte("png")}
	_, err := buildSMTPMessageWithInlineAssets(config, "user@example.net", "subject", "body", []emailhtml.InlineAsset{duplicate, duplicate})
	require.ErrorContains(t, err, "duplicate inline asset")
}

func TestBuildSMTPMessagePreventsHeaderInjection(t *testing.T) {
	config := &SMTPConfig{
		Host:     "smtp.example.com",
		From:     "reply@example.com",
		FromName: "Sender\r\nBcc: hidden@example.com",
	}

	message, err := buildSMTPMessage(config, "user@example.net", "Subject\r\nCc: hidden@example.com", "body")
	require.NoError(t, err)

	parsed, err := mail.ReadMessage(bytes.NewReader(message.data))
	require.NoError(t, err)
	require.Empty(t, parsed.Header.Get("Bcc"))
	require.Empty(t, parsed.Header.Get("Cc"))

	decodedSubject, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
	require.NoError(t, err)
	require.Equal(t, "SubjectCc: hidden@example.com", decodedSubject)
}

func TestBuildSMTPMessageRejectsInvalidConfiguration(t *testing.T) {
	_, err := buildSMTPMessage(nil, "user@example.net", "subject", "body")
	require.ErrorContains(t, err, "missing SMTP configuration")

	_, err = buildSMTPMessage(&SMTPConfig{Host: "smtp.example.com"}, "user@example.net", "subject", "body")
	require.ErrorContains(t, err, "invalid SMTP from address")

	_, err = buildSMTPMessage(&SMTPConfig{
		Host: "smtp.example.com",
		From: "reply@example.com",
	}, "invalid recipient <>", "subject", "body")
	require.ErrorContains(t, err, "invalid SMTP recipient address")

	_, err = buildSMTPMessage(&SMTPConfig{
		Host: "smtp.example.com",
		From: "reply@example.com",
	}, "user@example.net\r\nBcc: hidden@example.net", "subject", "body")
	require.ErrorContains(t, err, "invalid SMTP recipient address")
}

func TestBuildSMTPMessageUsesUniqueMessageIDs(t *testing.T) {
	config := &SMTPConfig{Host: "smtp.example.com", From: "reply@example.com"}

	first, err := buildSMTPMessage(config, "user@example.net", "subject", "body")
	require.NoError(t, err)
	second, err := buildSMTPMessage(config, "user@example.net", "subject", "body")
	require.NoError(t, err)

	firstParsed, err := mail.ReadMessage(bytes.NewReader(first.data))
	require.NoError(t, err)
	secondParsed, err := mail.ReadMessage(bytes.NewReader(second.data))
	require.NoError(t, err)
	require.NotEqual(t, firstParsed.Header.Get("Message-ID"), secondParsed.Header.Get("Message-ID"))
}

func TestBuildSMTPMessageUsesUniqueRelatedContentIDs(t *testing.T) {
	config := &SMTPConfig{Host: "smtp.example.com", From: "reply@example.com"}
	body := emailhtml.Render(emailhtml.Message{
		SiteName:     "Qiu API",
		Title:        "Verify your email",
		Illustration: emailhtml.IllustrationVerification,
		BodyHTML:     emailhtml.Intro("Complete verification."),
	})
	assets := emailhtml.InlineAssetsForHTML(body)

	first, err := buildSMTPMessageWithInlineAssets(config, "user@example.net", "subject", body, assets)
	require.NoError(t, err)
	second, err := buildSMTPMessageWithInlineAssets(config, "user@example.net", "subject", body, assets)
	require.NoError(t, err)

	firstParsed, err := mail.ReadMessage(bytes.NewReader(first.data))
	require.NoError(t, err)
	secondParsed, err := mail.ReadMessage(bytes.NewReader(second.data))
	require.NoError(t, err)
	_, firstParams, err := mime.ParseMediaType(firstParsed.Header.Get("Content-Type"))
	require.NoError(t, err)
	_, secondParams, err := mime.ParseMediaType(secondParsed.Header.Get("Content-Type"))
	require.NoError(t, err)
	require.NotEqual(t, firstParams["start"], secondParams["start"])

	firstReader := multipart.NewReader(firstParsed.Body, firstParams["boundary"])
	secondReader := multipart.NewReader(secondParsed.Body, secondParams["boundary"])
	_, err = firstReader.NextRawPart()
	require.NoError(t, err)
	_, err = secondReader.NextRawPart()
	require.NoError(t, err)
	firstImage, err := firstReader.NextRawPart()
	require.NoError(t, err)
	secondImage, err := secondReader.NextRawPart()
	require.NoError(t, err)
	require.NotEqual(t, firstImage.Header.Get("Content-ID"), secondImage.Header.Get("Content-ID"))
}

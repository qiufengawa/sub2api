package service

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"net/textproto"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/emailhtml"
)

type smtpMessage struct {
	envelopeFrom string
	envelopeTo   string
	data         []byte
}

func buildSMTPMessage(config *SMTPConfig, to, subject, body string) (smtpMessage, error) {
	return buildSMTPMessageWithInlineAssets(config, to, subject, body, nil)
}

func buildSMTPMessageWithInlineAssets(config *SMTPConfig, to, subject, body string, inlineAssets []emailhtml.InlineAsset) (smtpMessage, error) {
	if config == nil {
		return smtpMessage{}, errors.New("missing SMTP configuration")
	}

	fromAddress, err := parseSMTPAddress(config.From, "from")
	if err != nil {
		return smtpMessage{}, err
	}
	recipientAddress, err := parseSMTPAddress(to, "recipient")
	if err != nil {
		return smtpMessage{}, err
	}
	messageID, err := generateEmailMessageID(fromAddress.Address, config.Host)
	if err != nil {
		return smtpMessage{}, fmt.Errorf("generate message ID: %w", err)
	}

	fromName := sanitizeEmailHeader(config.FromName)
	if strings.TrimSpace(fromName) == "" {
		fromName = fromAddress.Name
	}
	fromHeader := (&mail.Address{
		Name:    fromName,
		Address: fromAddress.Address,
	}).String()
	toHeader := (&mail.Address{
		Name:    recipientAddress.Name,
		Address: recipientAddress.Address,
	}).String()
	subjectHeader := mime.QEncoding.Encode("UTF-8", sanitizeEmailHeader(subject))

	var message bytes.Buffer
	fmt.Fprintf(&message, "From: %s\r\n", fromHeader)
	fmt.Fprintf(&message, "To: %s\r\n", toHeader)
	fmt.Fprintf(&message, "Date: %s\r\n", time.Now().UTC().Format(time.RFC1123Z))
	fmt.Fprintf(&message, "Message-ID: %s\r\n", messageID)
	fmt.Fprintf(&message, "Subject: %s\r\n", subjectHeader)
	if len(inlineAssets) > 0 {
		if err := writeRelatedEmailBody(&message, body, inlineAssets, messageID); err != nil {
			return smtpMessage{}, err
		}
	} else {
		fmt.Fprint(&message, "MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=UTF-8\r\n"+
			"Content-Transfer-Encoding: quoted-printable\r\n\r\n")

		bodyWriter := quotedprintable.NewWriter(&message)
		if _, err := bodyWriter.Write([]byte(body)); err != nil {
			return smtpMessage{}, fmt.Errorf("encode email body: %w", err)
		}
		if err := bodyWriter.Close(); err != nil {
			return smtpMessage{}, fmt.Errorf("close email body encoder: %w", err)
		}
	}

	return smtpMessage{
		envelopeFrom: fromAddress.Address,
		envelopeTo:   recipientAddress.Address,
		data:         message.Bytes(),
	}, nil
}

func writeRelatedEmailBody(message *bytes.Buffer, body string, inlineAssets []emailhtml.InlineAsset, messageID string) error {
	if err := validateInlineAssets(inlineAssets); err != nil {
		return err
	}
	body, inlineAssets, rootContentID, err := personalizeRelatedContentIDs(body, inlineAssets, messageID)
	if err != nil {
		return err
	}

	relatedWriter := multipart.NewWriter(message)
	contentType := mime.FormatMediaType("multipart/related", map[string]string{
		"boundary": relatedWriter.Boundary(),
		"start":    "<" + rootContentID + ">",
		"type":     "text/html",
	})
	fmt.Fprintf(message, "MIME-Version: 1.0\r\nContent-Type: %s\r\n\r\n", contentType)

	htmlHeader := make(textproto.MIMEHeader)
	htmlHeader.Set("Content-Type", "text/html; charset=UTF-8")
	htmlHeader.Set("Content-Transfer-Encoding", "quoted-printable")
	htmlHeader.Set("Content-ID", "<"+rootContentID+">")
	htmlPart, err := relatedWriter.CreatePart(htmlHeader)
	if err != nil {
		return fmt.Errorf("create HTML MIME part: %w", err)
	}
	bodyWriter := quotedprintable.NewWriter(htmlPart)
	if _, err := bodyWriter.Write([]byte(body)); err != nil {
		return fmt.Errorf("encode email body: %w", err)
	}
	if err := bodyWriter.Close(); err != nil {
		return fmt.Errorf("close email body encoder: %w", err)
	}

	for _, asset := range inlineAssets {
		partHeader := make(textproto.MIMEHeader)
		partHeader.Set("Content-Type", mime.FormatMediaType(asset.MediaType, map[string]string{"name": asset.Filename}))
		partHeader.Set("Content-Transfer-Encoding", "base64")
		partHeader.Set("Content-ID", "<"+asset.ContentID+">")
		partHeader.Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": asset.Filename}))
		part, err := relatedWriter.CreatePart(partHeader)
		if err != nil {
			return fmt.Errorf("create inline MIME part %q: %w", asset.ContentID, err)
		}
		if err := writeMIMEBase64(part, asset.Data); err != nil {
			return fmt.Errorf("encode inline MIME part %q: %w", asset.ContentID, err)
		}
	}
	if err := relatedWriter.Close(); err != nil {
		return fmt.Errorf("close related MIME writer: %w", err)
	}
	return nil
}

func personalizeRelatedContentIDs(body string, assets []emailhtml.InlineAsset, messageID string) (string, []emailhtml.InlineAsset, string, error) {
	messageIDValue := strings.TrimSpace(messageID)
	if len(messageIDValue) < 3 || messageIDValue[0] != '<' || messageIDValue[len(messageIDValue)-1] != '>' {
		return "", nil, "", fmt.Errorf("invalid message ID for related MIME body %q", messageID)
	}
	messageIDValue = messageIDValue[1 : len(messageIDValue)-1]
	separator := strings.LastIndexByte(messageIDValue, '@')
	if separator <= 0 {
		return "", nil, "", fmt.Errorf("invalid message ID for related MIME body %q", messageID)
	}
	messageToken := messageIDValue[:separator]
	if strings.ContainsAny(messageToken, "\r\n<>@\t ") {
		return "", nil, "", fmt.Errorf("invalid message ID token for related MIME body %q", messageID)
	}

	rootContentID := "html." + messageToken + "@assets.qiu.invalid"
	personalized := make([]emailhtml.InlineAsset, len(assets))
	for index, asset := range assets {
		contentID := fmt.Sprintf("asset-%d.%s@assets.qiu.invalid", index+1, messageToken)
		body = replaceRelatedContentID(body, asset.ContentID, contentID)
		personalized[index] = asset
		personalized[index].ContentID = contentID
	}
	return body, personalized, rootContentID, nil
}

func replaceRelatedContentID(body, currentContentID, nextContentID string) string {
	for _, reference := range []string{
		`src="cid:` + currentContentID + `"`,
		`background="cid:` + currentContentID + `"`,
		`url('cid:` + currentContentID + `')`,
		`url("cid:` + currentContentID + `")`,
	} {
		body = strings.ReplaceAll(body, reference, strings.Replace(reference, "cid:"+currentContentID, "cid:"+nextContentID, 1))
	}
	return body
}

func validateInlineAssets(assets []emailhtml.InlineAsset) error {
	seen := make(map[string]struct{}, len(assets))
	for _, asset := range assets {
		contentID := strings.TrimSpace(asset.ContentID)
		if contentID == "" || strings.ContainsAny(contentID, "\r\n<>\t ") {
			return fmt.Errorf("invalid inline asset content ID %q", asset.ContentID)
		}
		if _, ok := seen[contentID]; ok {
			return fmt.Errorf("duplicate inline asset content ID %q", contentID)
		}
		seen[contentID] = struct{}{}
		if strings.TrimSpace(asset.Filename) == "" || strings.ContainsAny(asset.Filename, "\r\n") {
			return fmt.Errorf("invalid inline asset filename for %q", contentID)
		}
		mediaType, _, err := mime.ParseMediaType(asset.MediaType)
		if err != nil || !strings.HasPrefix(strings.ToLower(mediaType), "image/") {
			return fmt.Errorf("invalid inline asset media type for %q", contentID)
		}
		if len(asset.Data) == 0 {
			return fmt.Errorf("inline asset %q is empty", contentID)
		}
	}
	return nil
}

func writeMIMEBase64(writer interface{ Write([]byte) (int, error) }, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	for offset := 0; offset < len(encoded); offset += 76 {
		end := offset + 76
		if end > len(encoded) {
			end = len(encoded)
		}
		if offset > 0 {
			if _, err := writer.Write([]byte("\r\n")); err != nil {
				return err
			}
		}
		if _, err := writer.Write([]byte(encoded[offset:end])); err != nil {
			return err
		}
	}
	return nil
}

func parseSMTPAddress(value, field string) (*mail.Address, error) {
	if strings.ContainsAny(value, "\r\n") {
		return nil, fmt.Errorf("invalid SMTP %s address: contains a line break", field)
	}

	cleaned := strings.TrimSpace(value)
	address, err := mail.ParseAddress(cleaned)
	if err != nil || strings.TrimSpace(address.Address) == "" {
		if err == nil {
			err = fmt.Errorf("address is empty")
		}
		return nil, fmt.Errorf("invalid SMTP %s address: %w", field, err)
	}
	return address, nil
}

func generateEmailMessageID(fromAddress, smtpHost string) (string, error) {
	randomID := make([]byte, 16)
	if _, err := rand.Read(randomID); err != nil {
		return "", err
	}

	domain := strings.TrimSpace(sanitizeEmailHeader(smtpHost))
	if at := strings.LastIndexByte(fromAddress, '@'); at >= 0 && at < len(fromAddress)-1 {
		domain = fromAddress[at+1:]
	}
	domain = strings.Trim(domain, "[]<>")
	if domain == "" {
		domain = "localhost"
	}

	return fmt.Sprintf("<%s@%s>", hex.EncodeToString(randomID), domain), nil
}

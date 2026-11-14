package mail

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"net"
	stdmail "net/mail"
	"net/smtp"
	"strings"
	"time"
)

// Validate rejects incomplete or unsafe SMTP settings before accepting requests.
// An absent password is allowed during setup: New disables delivery until supplied.
func (cfg Config) Validate() error {
	if cfg.Provider != "" && cfg.Provider != "resend" && cfg.Provider != "smtp" {
		return errors.New("EMAIL_PROVIDER: ожидается smtp или resend")
	}
	if cfg.Provider != "smtp" {
		return nil
	}
	if cfg.SMTPHost == "" || strings.ContainsAny(cfg.SMTPHost, "\r\n /:") {
		return errors.New("SMTP_HOST: укажите имя SMTP-сервера")
	}
	if cfg.SMTPPort != "587" && cfg.SMTPPort != "465" {
		return errors.New("SMTP_PORT: используйте 587 (STARTTLS) или 465 (TLS)")
	}
	if cfg.SMTPUsername == "" || strings.ContainsAny(cfg.SMTPUsername, "\r\n") {
		return errors.New("SMTP_USERNAME: укажите почту отправителя")
	}
	if _, err := parseAddress(cfg.From); err != nil {
		return errors.New("EMAIL_FROM: неверный адрес отправителя")
	}
	return nil
}

func parseAddress(value string) (*stdmail.Address, error) {
	if strings.ContainsAny(value, "\r\n") {
		return nil, errors.New("invalid email address")
	}
	return stdmail.ParseAddress(value)
}

func codeMessage(from, to, code string) ([]byte, string, string, error) {
	sender, err := parseAddress(from)
	if err != nil {
		return nil, "", "", errors.New("invalid sender")
	}
	recipient, err := parseAddress(to)
	if err != nil {
		return nil, "", "", errors.New("invalid recipient")
	}
	// Keep the SMTP DATA payload ASCII except for the explicitly UTF-8 body.
	body := fmt.Sprintf("Famigo: %s\r\nКод подтверждения / Verification code. Действует 10 минут / Valid for 10 minutes.\r\nЕсли вы не запрашивали код, проигнорируйте письмо.\r\n", code)
	message := "From: " + sender.String() + "\r\nTo: " + recipient.String() +
		"\r\nSubject: " + mime.QEncoding.Encode("utf-8", "Famigo — код подтверждения / verification code") +
		"\r\nDate: " + time.Now().Format(time.RFC1123Z) +
		"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + body
	return []byte(message), sender.Address, recipient.Address, nil
}

func (s *Sender) sendSMTP(ctx context.Context, to, code string) error {
	message, from, recipient, err := codeMessage(s.cfg.From, to, code)
	if err != nil {
		return err
	}
	return retrySMTP(ctx, func() error { return s.smtpSession(ctx, message, from, recipient) })
}

// Retry only before MAIL/DATA: once delivery starts its outcome can be ambiguous,
// and retrying could send duplicate emails. All attempts use the same code.
type smtpConnectError struct{ error }

func retrySMTP(ctx context.Context, attempt func() error) error {
	var err error
	for i := 0; i < 3; i++ {
		err = attempt()
		var transient smtpConnectError
		if err == nil || !errors.As(err, &transient) || i == 2 {
			return err
		}
		timer := time.NewTimer(250 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
	return err
}

// CheckSMTP verifies TLS and authentication without sending an email.
func (s *Sender) CheckSMTP(ctx context.Context) error {
	if s.cfg.Provider != "smtp" {
		return errors.New("SMTP provider is not selected")
	}
	return s.smtpSession(ctx, nil, "", "")
}

func (s *Sender) smtpSession(ctx context.Context, message []byte, from, recipient string) error {
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	address := net.JoinHostPort(s.cfg.SMTPHost, s.cfg.SMTPPort)
	dialer := &net.Dialer{}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return smtpConnectError{errors.New("smtp connection failed")}
	}
	defer conn.Close()
	deadline, _ := ctx.Deadline()
	if err := conn.SetDeadline(deadline); err != nil {
		return errors.New("smtp deadline failed")
	}
	rawConn := conn
	stop := context.AfterFunc(ctx, func() { rawConn.Close() })
	defer stop()
	tlsConfig := &tls.Config{ServerName: s.cfg.SMTPHost, MinVersion: tls.VersionTLS12}
	if s.cfg.SMTPPort == "465" {
		secure := tls.Client(conn, tlsConfig)
		if err := secure.HandshakeContext(ctx); err != nil {
			return smtpConnectError{errors.New("smtp TLS failed")}
		}
		conn = secure
	}
	client, err := smtp.NewClient(conn, s.cfg.SMTPHost)
	if err != nil {
		return smtpConnectError{fmt.Errorf("smtp greeting failed: %w", err)}
	}
	defer client.Close()
	if s.cfg.SMTPPort != "465" {
		if err := client.StartTLS(tlsConfig); err != nil {
			return smtpConnectError{errors.New("smtp STARTTLS failed")}
		}
	}
	// Credentials are sent only after TLS with certificate verification.
	if err := client.Auth(smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)); err != nil {
		return errors.New("smtp authentication failed: check app password")
	}
	if message == nil {
		_ = client.Quit()
		return nil
	}
	if err := client.Mail(from); err != nil {
		return errors.New("smtp sender rejected")
	}
	if err := client.Rcpt(recipient); err != nil {
		return errors.New("smtp recipient rejected")
	}
	writer, err := client.Data()
	if err != nil {
		return errors.New("smtp DATA failed")
	}
	if _, err := writer.Write(message); err != nil {
		return errors.New("smtp write failed")
	}
	if err := writer.Close(); err != nil {
		return errors.New("smtp delivery failed")
	}
	// DATA acceptance means delivery was queued; a failed QUIT must not trigger a resend.
	_ = client.Quit()
	return nil
}

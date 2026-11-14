package mail

import (
	"bufio"
	"context"
	"errors"
	"net"
	"strings"
	"testing"
	"time"
)

func TestSMTPRetriesConnectionOnly(t *testing.T) {
	for _, tc := range []struct {
		name      string
		failures  int
		transient bool
		want      int
		success   bool
	}{
		{"second connection succeeds", 1, true, 2, true},
		{"connection retry bounded", 3, true, 3, false},
		{"do not duplicate ambiguous delivery", 1, false, 1, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			err := retrySMTP(context.Background(), func() error {
				calls++
				if calls > tc.failures {
					return nil
				}
				failure := errors.New("test delivery error")
				if tc.transient {
					return smtpConnectError{failure}
				}
				return failure
			})
			if calls != tc.want || (err == nil) != tc.success {
				t.Fatalf("calls=%d err=%v", calls, err)
			}
		})
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := retrySMTP(ctx, func() error { return smtpConnectError{errors.New("connect failed")} }); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation ignored: %v", err)
	}
}

func TestSMTPRejectsHeaderInjection(t *testing.T) {
	for _, recipient := range []string{"bad\r\nBcc: victim@example.com", "not-an-email"} {
		if _, _, _, err := codeMessage("Famigo <sender@gmail.com>", recipient, "123456"); err == nil {
			t.Fatal("invalid recipient accepted")
		}
	}
	msg, from, to, err := codeMessage("Famigo <sender@gmail.com>", "recipient@example.com", "123456")
	if err != nil || from != "sender@gmail.com" || to != "recipient@example.com" || !strings.Contains(string(msg), "123456") || !strings.Contains(string(msg), "charset=UTF-8") {
		t.Fatalf("invalid message: %v", err)
	}
}

func TestSMTPRequiresTLSBeforeCredentials(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	commands := make(chan string, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			commands <- ""
			return
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(3 * time.Second))
		conn.Write([]byte("220 localhost ESMTP\r\n"))
		reader := bufio.NewReader(conn)
		var seen strings.Builder
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				break
			}
			seen.WriteString(line)
			if strings.HasPrefix(line, "EHLO") {
				conn.Write([]byte("250-localhost\r\n250 AUTH PLAIN\r\n"))
			} else {
				conn.Write([]byte("502 TLS unavailable\r\n"))
			}
		}
		commands <- seen.String()
	}()
	host, port, _ := net.SplitHostPort(listener.Addr().String())
	sender := New(Config{Provider: "smtp", SMTPHost: host, SMTPPort: port, SMTPUsername: "sender@gmail.com", SMTPPassword: "secret", From: "sender@gmail.com"})
	if err := sender.smtpSession(context.Background(), []byte("test"), "sender@gmail.com", "recipient@example.com"); err == nil {
		t.Fatal("unencrypted server accepted")
	}
	if seen := <-commands; strings.Contains(seen, "AUTH ") || strings.Contains(seen, "secret") {
		t.Fatal("credentials sent before TLS")
	}
}

func TestSMTPConfiguration(t *testing.T) {
	valid := Config{Provider: "smtp", SMTPHost: "smtp.gmail.com", SMTPPort: "587", SMTPUsername: "sender@gmail.com", From: "Famigo <sender@gmail.com>"}
	if err := valid.Validate(); err != nil {
		t.Fatal(err)
	}
	if New(valid) != nil {
		t.Fatal("sender enabled without password")
	}
	for _, mutate := range []func(*Config){
		func(c *Config) { c.Provider = "unknown" },
		func(c *Config) { c.SMTPHost = "" },
		func(c *Config) { c.SMTPPort = "25" },
		func(c *Config) { c.SMTPUsername = "" },
		func(c *Config) { c.From = "bad\r\nBcc: other@example.com" },
	} {
		cfg := valid
		mutate(&cfg)
		if err := cfg.Validate(); err == nil {
			t.Fatal("invalid SMTP configuration accepted")
		}
	}
}

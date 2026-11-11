package httpx

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestClientKeyGroupsIPv6Network(t *testing.T) {
	key := func(remote string) string {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/", nil)
		c.Request.RemoteAddr = remote
		return ClientKey(c)
	}

	// Разные адреса из одной сети /64 — один абонент, один ключ.
	if a, b := key("[2001:db8:1:2::5]:1000"), key("[2001:db8:1:2:ffff::9]:2000"); a != b {
		t.Errorf("одна сеть /64 даёт разные ключи: %s и %s", a, b)
	}
	if a, b := key("[2001:db8:1:2::5]:1000"), key("[2001:db8:1:3::5]:1000"); a == b {
		t.Errorf("разные сети /64 дают один ключ: %s", a)
	}
	if got := key("192.0.2.7:5000"); got != "192.0.2.7" {
		t.Errorf("IPv4: %s", got)
	}
	// IPv4, записанный как IPv6 (::ffff:192.0.2.7), — тот же клиент, что и 192.0.2.7.
	if got := key("[::ffff:192.0.2.7]:5000"); got != "192.0.2.7" {
		t.Errorf("IPv4 внутри IPv6: %s", got)
	}
}

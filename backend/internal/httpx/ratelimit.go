package httpx

import (
	"net/netip"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiter ограничивает частоту запросов по ключу (IP, почта и т. п.).
// Алгоритм «ведро с жетонами»: в ведре burst жетонов, каждый запрос забирает один,
// жетоны пополняются с заданной скоростью. Пустое ведро — запрос отклоняется.
// Это защита от подбора паролей и кодов приглашения и от заваливания сервера запросами.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	every    rate.Limit
	burst    int
	cleaned  time.Time
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// Записи о тех, кто давно не заходил, удаляются, чтобы карта не росла бесконечно.
const visitorTTL = 10 * time.Minute

// NewRateLimiter: perMinute запросов в минуту в среднем, но не больше burst подряд.
func NewRateLimiter(perMinute float64, burst int) *RateLimiter {
	return &RateLimiter{
		visitors: map[string]*visitor{},
		every:    rate.Limit(perMinute / 60),
		burst:    burst,
		cleaned:  time.Now(),
	}
}

// Allow отвечает, можно ли пропустить запрос с этим ключом.
func (l *RateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	if now.Sub(l.cleaned) > time.Minute {
		for k, v := range l.visitors {
			if now.Sub(v.lastSeen) > visitorTTL {
				delete(l.visitors, k)
			}
		}
		l.cleaned = now
	}

	v, ok := l.visitors[key]
	if !ok {
		v = &visitor{limiter: rate.NewLimiter(l.every, l.burst)}
		l.visitors[key] = v
	}
	v.lastSeen = now
	return v.limiter.Allow()
}

// ByIP — middleware, ограничивающий запросы с одного IP.
// IP берётся через c.ClientIP(), которому верить можно только если в сервере
// настроены доверенные прокси (см. TRUSTED_PROXIES), иначе заголовок X-Forwarded-For подделают.
func (l *RateLimiter) ByIP(prefix string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !l.Allow(prefix + ClientKey(c)) {
			c.Header("Retry-After", strconv.Itoa(60))
			Respond(c, TooManyRequests())
			return
		}
		c.Next()
	}
}

// ClientKey — ключ клиента для лимитов. Для IPv4 это сам адрес. Для IPv6 — сеть /64:
// провайдер выдаёт абоненту целую сеть /64, и, перебирая адреса внутри неё, можно было бы
// обойти лимит и раздуть таблицу посетителей.
func ClientKey(c *gin.Context) string {
	addr, err := netip.ParseAddr(c.ClientIP())
	if err != nil {
		return c.ClientIP()
	}
	addr = addr.Unmap()
	if addr.Is6() {
		prefix, _ := addr.Prefix(64)
		return prefix.String()
	}
	return addr.String()
}

package families

import "testing"

func TestCanRemove(t *testing.T) {
	cases := []struct {
		actor, target string
		self, want    bool
	}{
		{RoleOwner, RoleAdmin, false, true},
		{RoleOwner, RoleMember, false, true},
		{RoleAdmin, RoleMember, false, true},
		{RoleAdmin, RoleAdmin, false, false},
		{RoleAdmin, RoleOwner, false, false},
		{RoleMember, RoleMember, false, false},
		{RoleOwner, RoleOwner, true, false}, // себя — только через «покинуть семью»
	}
	for _, tc := range cases {
		if got := canRemove(tc.actor, tc.target, tc.self); got != tc.want {
			t.Errorf("canRemove(%s → %s, self=%v) = %v, want %v", tc.actor, tc.target, tc.self, got, tc.want)
		}
	}
}

func TestCanChangeRole(t *testing.T) {
	cases := []struct {
		actor, target, role string
		self, want          bool
	}{
		{RoleOwner, RoleMember, RoleAdmin, false, true},
		{RoleOwner, RoleAdmin, RoleMember, false, true},
		{RoleAdmin, RoleMember, RoleAdmin, false, true},
		{RoleAdmin, RoleAdmin, RoleMember, false, false}, // равному нельзя
		{RoleAdmin, RoleOwner, RoleMember, false, false},
		{RoleMember, RoleMember, RoleAdmin, false, false},
		{RoleOwner, RoleMember, RoleOwner, false, false}, // владельцем — только передачей прав
		{RoleAdmin, RoleAdmin, RoleAdmin, true, false},   // себе нельзя
		{RoleOwner, RoleMember, "superuser", false, false},
	}
	for _, tc := range cases {
		if got := canChangeRole(tc.actor, tc.target, tc.role, tc.self); got != tc.want {
			t.Errorf("canChangeRole(%s → %s = %s) = %v, want %v", tc.actor, tc.target, tc.role, got, tc.want)
		}
	}
}

func TestInviteCodes(t *testing.T) {
	seen := map[string]bool{}
	for range 200 {
		code := newInviteCode()
		if _, ok := normalizeInviteCode(code); !ok {
			t.Fatalf("сгенерирован неверный код %q", code)
		}
		seen[code] = true
	}
	if len(seen) < 195 {
		t.Fatalf("коды повторяются слишком часто: %d уникальных из 200", len(seen))
	}
	if code, ok := normalizeInviteCode(" k7mpx "); !ok || code != "K7MPX" {
		t.Fatalf("нормализация: %q %v", code, ok)
	}
	for _, bad := range []string{"K7MP", "K7MPX1", "K0MPX", "'; --", ""} {
		if _, ok := normalizeInviteCode(bad); ok {
			t.Errorf("код %q должен отклоняться", bad)
		}
	}
}

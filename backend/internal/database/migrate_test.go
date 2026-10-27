package database

import (
	"testing"
	"testing/fstest"
)

func TestMigrationNamesSorted(t *testing.T) {
	files := fstest.MapFS{
		"migrations/0002_b.sql": {Data: []byte("")},
		"migrations/0001_a.sql": {Data: []byte("")},
		"migrations/readme.txt": {Data: []byte("")},
		"migrations/0010_c.sql": {Data: []byte("")},
	}
	names, err := migrationNames(files)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"0001_a.sql", "0002_b.sql", "0010_c.sql"}
	if len(names) != len(want) {
		t.Fatalf("names = %v, want %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("names = %v, want %v", names, want)
		}
	}
}

func TestEmbeddedMigrationsExist(t *testing.T) {
	names, err := migrationNames(migrationFiles)
	if err != nil {
		t.Fatal(err)
	}
	if len(names) == 0 || names[0] != "0001_create_users.sql" {
		t.Fatalf("первая миграция должна быть 0001_create_users.sql, есть: %v", names)
	}
}

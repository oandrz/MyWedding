package service

import (
	"testing"
	"time"
)

func TestCacheSetAndGet(t *testing.T) {
	c := NewCache(30 * time.Second)
	c.Set("key1", "value1")

	val, ok := c.Get("key1")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if val.(string) != "value1" {
		t.Errorf("expected value1, got %v", val)
	}
}

func TestCacheMiss(t *testing.T) {
	c := NewCache(30 * time.Second)

	_, ok := c.Get("nonexistent")
	if ok {
		t.Error("expected cache miss")
	}
}

func TestCacheExpiry(t *testing.T) {
	c := NewCache(1 * time.Millisecond)
	c.Set("key1", "value1")

	time.Sleep(5 * time.Millisecond)

	_, ok := c.Get("key1")
	if ok {
		t.Error("expected cache miss for expired entry")
	}
}

func TestCacheInvalidate(t *testing.T) {
	c := NewCache(30 * time.Second)
	c.Set("key1", "value1")

	c.Invalidate("key1")

	_, ok := c.Get("key1")
	if ok {
		t.Error("expected cache miss after invalidation")
	}
}

func TestCacheInvalidateAll(t *testing.T) {
	c := NewCache(30 * time.Second)
	c.Set("key1", "value1")
	c.Set("key2", "value2")

	c.InvalidateAll()

	_, ok1 := c.Get("key1")
	_, ok2 := c.Get("key2")
	if ok1 || ok2 {
		t.Error("expected all cache entries to be invalidated")
	}
}

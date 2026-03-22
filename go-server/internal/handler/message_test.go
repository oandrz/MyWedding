package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMessage_EmptyList_ReturnsPaginatedEmpty(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/messages", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	messages := result["messages"].([]interface{})
	if len(messages) != 0 {
		t.Fatalf("expected empty array, got %d items", len(messages))
	}
	total := result["total"].(float64)
	if total != 0 {
		t.Fatalf("expected total=0, got %v", total)
	}
}

func TestMessage_EmptyName_Returns400(t *testing.T) {
	env := newTestEnv()
	body := jsonBody(map[string]interface{}{"name": "", "content": "hello"})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestMessage_PaginationOffsetBeyondTotal(t *testing.T) {
	env := newTestEnv()

	// Create one message
	body := jsonBody(map[string]interface{}{"name": "Bob", "content": "Hi"})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusCreated)

	// Request with offset beyond total
	req2 := httptest.NewRequest(http.MethodGet, "/api/messages?limit=20&offset=100", nil)
	result := contractResponse(t, env, req2, http.StatusOK)

	messages := result["messages"].([]interface{})
	if len(messages) != 0 {
		t.Fatalf("expected empty array for offset beyond total, got %d", len(messages))
	}
	total := result["total"].(float64)
	if total != 1 {
		t.Fatalf("expected total=1, got %v", total)
	}
}
